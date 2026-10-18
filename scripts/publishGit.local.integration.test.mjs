import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublishLocalLock } from './publishGitLocalLock.mjs';
import { dispatch } from '../tools/lima/sessionVm.mjs';
import { saveOwnerRef } from '../tools/lima/session.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_FILES = [
  'publishGit.mjs',
  'publishGitDeps.mjs',
  'publishGitAuth.mjs',
  'publishGitLogin.mjs',
  'publishGitLocalLock.mjs',
  'syncTsconfigPaths.mjs',
  'validateClientConfig.mjs',
];
const GIT = '/usr/bin/git';
const MARKER_OK = /##gitBackend build=ok release=20261015120000 project=mls-(\d+)##/;

function git(cwd, args, env = baseGitEnv()) {
  const result = spawnSync(GIT, args, { cwd, encoding: 'utf8', env });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || '').trim();
}

function baseGitEnv(extra = {}) {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    ...extra,
  };
}

function writeExec(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function makeBench() {
  const root = mkdtempSync(join(tmpdir(), 'rt73-'));
  const remotes = join(root, 'remotes');
  const bin = join(root, 'bin');
  const events = join(root, 'events.log');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(remotes, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(events, '');
  for (const name of CLI_FILES) copyFileSync(join(HERE, name), join(root, 'scripts', name));
  mkdirSync(join(root, 'tools', 'lima'), { recursive: true });
  copyFileSync(join(HERE, '../tools/lima/session.mjs'), join(root, 'tools', 'lima', 'session.mjs'));
  copyFileSync(join(HERE, '../tools/lima/sessionVm.mjs'), join(root, 'tools', 'lima', 'sessionVm.mjs'));
  const sshConfig = join(root, 'ssh.config');
  writeFileSync(sshConfig, 'Host lima-ubuntu24\n  HostName 127.0.0.1\n');
  writeFileSync(join(root, '.env'), `PUBLISH_LOCAL_SSH_HOST=bench\nPUBLISH_LOCAL_REMOTE_BASE=/unused\nPUBLISH_LOCAL_SSH_CONFIG=${sshConfig}\n`);
  writeExec(join(bin, 'git'), `#!/bin/sh
if [ "\${COLLAB_ACTOR:-}" != "" ]; then
  printf '%s %s\\n' "\$COLLAB_ACTOR" "\$*" >> "\$COLLAB_GIT_LOG"
fi
if [ "\${COLLAB_PUSH_GATE:-}" != "" ] && [ "\$1" = "push" ] && [ ! -f "\$COLLAB_PUSH_GATE" ]; then
  echo "\$COLLAB_ACTOR push-waiting" >> "\$COLLAB_GIT_LOG"
  while [ ! -f "\$COLLAB_PUSH_GATE" ]; do sleep 0.05; done
fi
exec ${GIT} "\$@"
`);
  writeExec(join(bin, 'ssh'), `#!/bin/sh
text="\$*"
case "\$text" in
  *--input-type=module*)
    json=\$(printf '%s' "\$text" | sed -n "s/.* '\\(.*\\)'\$/\\1/p")
    op=\$(printf '%s' "\$json" | sed -n 's/.*"op":"\\([^"]*\\)".*/\\1/p')
    if [ -n "\$COLLAB_LIMA_LOG" ]; then
      printf '%s\\n' "\$op" >> "\$COLLAB_LIMA_LOG"
    fi
    if [ -n "\$COLLAB_LIMA_FAIL_OP" ] && [ "\$op" = "\$COLLAB_LIMA_FAIL_OP" ]; then
      echo "lima ssh dropped" >&2
      exit 255
    fi
    exec "\$COLLAB_NODE" --input-type=module - "\$json"
    ;;
  *git-receive-pack*) sub=receive-pack ;;
  *git-upload-pack*) sub=upload-pack ;;
  *) echo "ssh shim: \$*" >&2; exit 1 ;;
esac
path=\$(printf '%s' "\$text" | sed -n "s/.*'\\([^']*\\)'.*/\\1/p")
if [ -z "\$path" ]; then
  path="\${text##* }"
fi
exec ${GIT} "\$sub" "\$path"
`);
  return { root, remotes, bin, events };
}

function lockDir(root) {
  return createPublishLocalLock({ installExit: false }).lockDir(root);
}

function pair(bench, id, { hook = true } = {}) {
  const remote = join(bench.remotes, `mls-${id}`);
  const local = join(bench.root, `mls-${id}`);
  mkdirSync(remote, { recursive: true });
  git(remote, ['init', '-q', '-b', 'main']);
  git(remote, ['config', 'user.email', 't@t']);
  git(remote, ['config', 'user.name', 't']);
  git(remote, ['config', 'commit.gpgsign', 'false']);
  git(remote, ['config', 'receive.denyCurrentBranch', 'updateInstead']);
  git(remote, ['config', 'receive.advertisePushOptions', 'true']);
  writeFileSync(join(remote, 'README.md'), `remote ${id}\n`);
  git(remote, ['add', '-A']);
  git(remote, ['commit', '-q', '-m', 'seed']);
  git(bench.root, ['clone', '-q', remote, local]);
  git(local, ['config', 'user.email', 't@t']);
  git(local, ['config', 'user.name', 't']);
  git(local, ['config', 'commit.gpgsign', 'false']);
  git(local, ['checkout', '-q', '-B', 'main']);
  if (hook) installHook(bench, remote, id);
  return { local, remote };
}

function installHook(bench, remote, id) {
  const hold = join(bench.root, `hold-${id}`);
  const red = join(bench.root, `red-${id}`);
  const hookDir = join(remote, '.git', 'hooks');
  mkdirSync(hookDir, { recursive: true });
  writeExec(join(hookDir, 'post-receive'), `#!/bin/sh
input=$(cat)
newrev=$(printf '%s\\n' "$input" | awk '$3=="refs/heads/main" { print $2; exit }')
opts=""
i=0
count="\${GIT_PUSH_OPTION_COUNT:-0}"
while [ "$i" -lt "$count" ]; do
  eval "opt=\\$GIT_PUSH_OPTION_$i"
  opts="$opts $opt"
  i=$((i + 1))
done
case "$opts" in
  *skip-build*)
    echo "dep-skip mls-${id} $newrev" >> "${bench.events}"
    exit 0
    ;;
esac
echo "hook-start mls-${id} $newrev" >> "${bench.events}"
while [ -f "${hold}" ]; do sleep 0.05; done
if [ -f "${red}" ]; then
  echo "##gitBackend build=error project=mls-${id}##"
  echo "hook-end mls-${id} $newrev error" >> "${bench.events}"
  exit 0
fi
echo "##gitBackend build=ok release=20261015120000 project=mls-${id}##"
echo "hook-end mls-${id} $newrev ok" >> "${bench.events}"
exit 0
`);
  return { hold, red };
}

function commitFile(repo, name, body, message) {
  writeFileSync(join(repo, name), body);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function head(repo) {
  return git(repo, ['rev-parse', 'HEAD']);
}

function eventsOf(bench) {
  return readFileSync(bench.events, 'utf8').trim().split('\n').filter(Boolean);
}

function cliEnv(bench, actor, extra = {}) {
  const env = baseGitEnv({
    PATH: `${bench.bin}:${process.env.PATH}`,
    GIT_SSH_COMMAND: join(bench.bin, 'ssh'),
    COLLAB_ACTOR: actor,
    COLLAB_GIT_LOG: join(bench.root, 'git.log'),
    COLLAB_LIMA_LOG: join(bench.root, 'lima.log'),
    COLLAB_NODE: process.execPath,
    LIMA_LOCK_PATH: join(bench.root, 'lima.lock'),
    LIMA_STATE_DIR: join(bench.root, 'lima-state'),
    ...extra,
  });
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function spawnCli(bench, args, { actor = 'cli', extraEnv = {}, stdio = ['pipe', 'pipe', 'pipe'] } = {}) {
  const script = realpathSync(join(bench.root, 'scripts', 'publishGit.mjs'));
  return spawn('/bin/bash', ['-c', 'exec /usr/bin/env -u NODE_TEST_CONTEXT "$0" "$@"', process.execPath, script, ...args], {
    cwd: bench.root,
    env: cliEnv(bench, actor, extraEnv),
    stdio,
  });
}

function startCli(bench, args, { actor = 'cli', stdin, extraEnv = {}, timeoutMs = 20000 } = {}) {
  writeFileSync(join(bench.root, 'git.log'), '', { flag: 'a' });
  const child = spawnCli(bench, args, { actor, extraEnv });
  const state = { out: '', err: '' };
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  child.stdout.on('data', (buf) => { state.out += buf; });
  child.stderr.on('data', (buf) => { state.err += buf; });
  if (stdin != null) child.stdin.end(stdin);
  else child.stdin.end();
  const done = new Promise((resolve) => {
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out: state.out, err: state.err });
    });
  });
  return { child, done, state };
}

function runCli(bench, args, options) {
  return startCli(bench, args, options).done;
}

function flags(bench) {
  return ['--ssh-host=bench', `--remote-base=${bench.remotes}`];
}

async function waitFor(fn, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('timed out waiting for bench condition');
}

function limaLog(bench) {
  const path = join(bench.root, 'lima.log');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean);
}

function limaProfile(bench) {
  return {
    sshConfig: join(bench.root, 'ssh.config'),
    alias: 'lima-ubuntu24',
    root: bench.root,
    stateDir: join(bench.root, 'lima-state'),
  };
}

function gitLog(bench, actor) {
  const path = join(bench.root, 'git.log');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.startsWith(`${actor} `));
}

test('local CLI aligns ahead, same, amend, reset, diverged and unrelated; remote keeps its refusals', { timeout: 60000 }, async () => {
  const bench = makeBench();
  try {
    const id = '910001';
    const { local, remote } = pair(bench, id);
    const shaA = head(local);

    const shaAhead = commitFile(local, 'a.txt', 'ahead\n', 'ahead');
    let result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'ahead' });
    assert.equal(result.code, 0, result.err);
    assert.equal(head(remote), shaAhead);
    assert.match(result.err, MARKER_OK);
    assert.equal(eventsOf(bench).at(-1), `hook-end mls-${id} ${shaAhead} ok`);

    const beforeSame = eventsOf(bench).length;
    result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'same' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /Nothing to publish/);
    assert.equal(head(remote), shaAhead);
    assert.equal(eventsOf(bench).length, beforeSame);

    git(local, ['commit', '-q', '--amend', '-m', 'amended']);
    const shaAmend = head(local);
    assert.notEqual(shaAmend, shaAhead);
    result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'amend' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /aligning local diverged/);
    assert.match(result.err, /force-with-lease/);
    assert.equal(head(remote), shaAmend);
    assert.doesNotMatch(result.err, /Continue\?/);

    git(local, ['reset', '-q', '--hard', 'HEAD~1']);
    assert.equal(head(local), shaA);
    result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'reset' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /aligning local behind/);
    assert.equal(head(remote), shaA);

    const shaLocal = commitFile(local, 'left.txt', 'left\n', 'local side');
    const shaRemoteOnly = commitFile(remote, 'right.txt', 'right\n', 'lima side');
    result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'diverged' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /aligning local diverged/);
    assert.equal(head(remote), shaLocal);
    assert.notEqual(head(remote), shaRemoteOnly);

    git(local, ['checkout', '-q', '--orphan', 'rewritten']);
    writeFileSync(join(local, 'orphan.txt'), 'unrelated\n');
    git(local, ['add', '-A']);
    git(local, ['commit', '-q', '-m', 'unrelated']);
    git(local, ['branch', '-M', 'main']);
    const shaUnrelated = head(local);
    result = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'unrelated' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /aligning local unrelated/);
    assert.doesNotMatch(result.err, /Continue\?/);
    assert.equal(head(remote), shaUnrelated);

    const remoteId = '910008';
    const remotePair = pair(bench, remoteId);
    const remoteSha = commitFile(remotePair.remote, 'only-vm.txt', 'vm\n', 'vm only');
    const localBehind = head(remotePair.local);
    result = await runCli(bench, [remoteId, 'remote', ...flags(bench)], { actor: 'remote-behind' });
    assert.notEqual(result.code, 0);
    assert.match(result.err, /pull\/rebase/);
    assert.equal(head(remotePair.remote), remoteSha);
    assert.equal(head(remotePair.local), localBehind);

    const divergedId = '910009';
    const diverged = pair(bench, divergedId);
    commitFile(diverged.local, 'L.txt', 'L\n', 'L');
    const divergedRemote = commitFile(diverged.remote, 'R.txt', 'R\n', 'R');
    const divergedLocal = head(diverged.local);
    result = await runCli(bench, [divergedId, 'remote', ...flags(bench)], { actor: 'remote-diverged' });
    assert.notEqual(result.code, 0);
    assert.match(result.err, /pull\/rebase/);
    assert.equal(head(diverged.remote), divergedRemote);
    assert.equal(head(diverged.local), divergedLocal);

    const unrelatedId = '910007';
    const unrelated = pair(bench, unrelatedId);
    const kept = head(unrelated.remote);
    git(unrelated.local, ['checkout', '-q', '--orphan', 'other']);
    writeFileSync(join(unrelated.local, 'other.txt'), 'other\n');
    git(unrelated.local, ['add', '-A']);
    git(unrelated.local, ['commit', '-q', '-m', 'other']);
    git(unrelated.local, ['branch', '-M', 'main']);
    result = await runCli(bench, [unrelatedId, 'remote', ...flags(bench)], { actor: 'remote-unrelated' });
    assert.notEqual(result.code, 0);
    assert.match(result.err, /refusing automatic force/);
    assert.equal(head(unrelated.remote), kept);

    result = await runCli(bench, [unrelatedId, 'remote', '--align', ...flags(bench)], {
      actor: 'remote-no',
      stdin: 'n\n',
    });
    assert.notEqual(result.code, 0);
    assert.match(result.err, /alignment cancelled/);
    assert.equal(head(unrelated.remote), kept);

    result = await runCli(bench, [unrelatedId, 'remote', '--align', ...flags(bench)], {
      actor: 'remote-yes',
      stdin: 'y\n',
    });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /force-with-lease/);
    assert.equal(head(unrelated.remote), head(unrelated.local));
  } finally {
    rmSync(bench.root, { recursive: true, force: true });
  }
});

test('two local CLIs of one ROOT serialize, then the waiter publishes the SHA it reads after the wait', { timeout: 60000 }, async () => {
  const bench = makeBench();
  const heldLock = lockDir(bench.root);
  try {
    const depId = '910010';
    const appA = '910011';
    const appB = '910012';
    const dep = pair(bench, depId);
    const a = pair(bench, appA);
    const b = pair(bench, appB);
    for (const repo of [a.local, b.local]) {
      writeFileSync(join(repo, 'mlsDep.json'), JSON.stringify({ workspaceDependencies: [depId] }));
      git(repo, ['add', '-A']);
      git(repo, ['commit', '-q', '-m', 'declare dep']);
    }
    await runCli(bench, [appA, 'local', ...flags(bench)], { actor: 'seed-a' });
    await runCli(bench, [appB, 'local', ...flags(bench)], { actor: 'seed-b' });
    assert.equal(head(a.local), head(a.remote));
    assert.equal(head(b.local), head(b.remote));
    assert.equal(head(dep.local), head(dep.remote));

    writeFileSync(join(bench.root, 'git.log'), '');
    writeFileSync(bench.events, '');
    const v1 = commitFile(dep.local, 'lib.txt', 'v1\n', 'dep v1');
    const hold = join(bench.root, `hold-${appA}`);
    writeFileSync(hold, '1');
    const captured = head(a.local);

    const first = startCli(bench, [appA, 'local', ...flags(bench)], { actor: 'A', timeoutMs: 30000 });
    await waitFor(() => eventsOf(bench).some((line) => line.startsWith(`hook-start mls-${appA} `)));
    const hookLine = eventsOf(bench).find((line) => line.startsWith(`hook-start mls-${appA} `));
    const pushed = hookLine.split(' ')[2];
    assert.equal(readFileSync(join(dep.remote, 'lib.txt'), 'utf8'), 'v1\n');

    const moved = commitFile(a.local, 'later.txt', 'later\n', 'after capture');
    const v2 = commitFile(dep.local, 'lib.txt', 'v2\n', 'dep v2');
    assert.notEqual(moved, captured);
    assert.notEqual(head(a.local), pushed);
    assert.notEqual(v2, v1);

    const second = startCli(bench, [appB, 'local', ...flags(bench)], { actor: 'B', timeoutMs: 30000 });
    const refusedB = await second.done;
    assert.notEqual(refusedB.code, 0);
    assert.match(refusedB.err, /occupied/);
    assert.doesNotMatch(refusedB.err, /publish local busy/);
    assert.deepEqual(gitLog(bench, 'B'), [], 'the other publisher must not fetch or push while the reservation is held');
    const owner = JSON.parse(readFileSync(join(heldLock, 'owner.json'), 'utf8'));
    assert.equal(owner.phase, 'push/hook');
    assert.equal(readFileSync(join(dep.remote, 'lib.txt'), 'utf8'), 'v1\n');

    rmSync(hold);
    const doneA = await first.done;
    assert.equal(doneA.code, 0, doneA.err);
    assert.equal(head(a.remote), pushed);
    assert.notEqual(head(a.remote), moved);
    assert.match(doneA.err, new RegExp(`release 20261015120000`));

    const doneB = await runCli(bench, [appB, 'local', ...flags(bench)], { actor: 'B2', timeoutMs: 30000 });
    assert.equal(doneB.code, 0, doneB.err);
    assert.match(doneB.err, /marker commit/);
    assert.equal(readFileSync(join(dep.remote, 'lib.txt'), 'utf8'), 'v2\n');
    assert.notEqual(head(dep.remote), v1);
    const bHook = eventsOf(bench).find((line) => line.startsWith(`hook-start mls-${appB} `));
    assert.equal(bHook.split(' ')[2], head(b.remote));
    assert.ok(eventsOf(bench).some((line) => line.startsWith('dep-skip mls-910010 ')));
    assert.equal(existsSync(heldLock), false);
  } finally {
    rmSync(heldLock, { recursive: true, force: true });
    rmSync(bench.root, { recursive: true, force: true });
  }
});

test('a third writer expires the lease; the next attempt does not reuse a retained lock', { timeout: 40000 }, async () => {
  const bench = makeBench();
  const heldLock = lockDir(bench.root);
  const gate = join(bench.root, 'gate');
  try {
    const id = '910021';
    const { local, remote } = pair(bench, id);
    const localSha = commitFile(local, 'L.txt', 'L\n', 'L');
    const remoteSha = commitFile(remote, 'R.txt', 'R\n', 'R');
    const running = runCli(bench, [id, 'local', ...flags(bench)], {
      actor: 'lease',
      extraEnv: { COLLAB_PUSH_GATE: gate },
      timeoutMs: 30000,
    });
    await waitFor(() => gitLog(bench, 'lease').some((line) => line.includes('push-waiting')));
    const third = commitFile(remote, 'R2.txt', 'R2\n', 'third writer');
    assert.notEqual(third, remoteSha);
    writeFileSync(gate, 'go');
    const result = await running;
    assert.notEqual(result.code, 0);
    assert.match(result.err, /lease refused/);
    assert.match(result.err, /not retrying/);
    assert.equal(head(remote), third);
    assert.equal(head(local), localSha);
    assert.equal(existsSync(heldLock), false);

    const again = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'again' });
    assert.equal(again.code, 0, again.err);
    assert.match(again.err, /aligning local diverged/);
    assert.equal(head(remote), localSha);
  } finally {
    rmSync(heldLock, { recursive: true, force: true });
    rmSync(bench.root, { recursive: true, force: true });
  }
});

test('red build, pre-push failure, and an uncertain interrupt', { timeout: 40000 }, async () => {
  const bench = makeBench();
  const heldLock = lockDir(bench.root);
  try {
    const redId = '910031';
    const red = pair(bench, redId);
    writeFileSync(join(bench.root, `red-${redId}`), '1');
    const sha = commitFile(red.local, 'x.txt', 'x\n', 'x');
    let result = await runCli(bench, [redId, 'local', ...flags(bench)], { actor: 'red' });
    assert.equal(result.code, 1, result.err);
    assert.match(result.err, /build vermelho/);
    assert.match(result.err, /build=error/);
    assert.equal(head(red.remote), sha);
    assert.equal(existsSync(heldLock), false);

    const dirtyId = '910032';
    const dirty = pair(bench, dirtyId);
    const stayed = head(dirty.remote);
    writeFileSync(join(dirty.local, 'dirty.txt'), 'dirty\n');
    result = await runCli(bench, [dirtyId, 'local', ...flags(bench)], { actor: 'dirty' });
    assert.equal(result.code, 1);
    assert.match(result.err, /dirty local worktree/);
    assert.equal(head(dirty.remote), stayed);
    assert.equal(head(dirty.local), stayed);
    assert.equal(existsSync(heldLock), false);

    const cutId = '910033';
    const cut = pair(bench, cutId);
    commitFile(cut.local, 'z.txt', 'z\n', 'z');
    const hold = join(bench.root, `hold-${cutId}`);
    writeFileSync(hold, '1');
    const child = spawnCli(bench, [cutId, 'local', ...flags(bench)], { actor: 'cut', stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (buf) => { err += buf; });
    await waitFor(() => eventsOf(bench).some((line) => line.startsWith(`hook-start mls-${cutId} `)));
    child.kill('SIGTERM');
    const code = await new Promise((resolve) => child.on('close', resolve));
    assert.notEqual(code, 0);
    assert.match(err, /lock retained/);
    assert.equal(existsSync(heldLock), true);
    const meta = JSON.parse(readFileSync(join(heldLock, 'owner.json'), 'utf8'));
    assert.equal(meta.retained, true);

    const thief = await runCli(bench, [cutId, 'local', ...flags(bench)], { actor: 'thief', timeoutMs: 8000 });
    assert.notEqual(thief.code, 0);
    assert.match(thief.err, /occupied/);
    assert.deepEqual(gitLog(bench, 'thief'), []);
    assert.equal(existsSync(heldLock), true);
    const limaHeld = JSON.parse(readFileSync(join(bench.root, 'lima.lock'), 'utf8'));
    assert.equal(limaHeld.operations.length, 1);
    assert.notEqual(limaHeld.phase, 'ready');
    rmSync(hold);
    await waitFor(() => eventsOf(bench).some((line) => line.startsWith(`hook-end mls-${cutId} `)));
  } finally {
    rmSync(heldLock, { recursive: true, force: true });
    rmSync(bench.root, { recursive: true, force: true });
  }
});

test('equal app and equal dep is a no-op; a changed dep cuts one project release', { timeout: 40000 }, async () => {
  const bench = makeBench();
  const heldLock = lockDir(bench.root);
  try {
    const depId = '910041';
    const appId = '910042';
    const dep = pair(bench, depId);
    const app = pair(bench, appId);
    writeFileSync(join(app.local, 'mlsDep.json'), JSON.stringify({ workspaceDependencies: [depId] }));
    git(app.local, ['add', '-A']);
    git(app.local, ['commit', '-q', '-m', 'dep']);
    let result = await runCli(bench, [appId, 'local', ...flags(bench)], { actor: 'first' });
    assert.equal(result.code, 0, result.err);
    const appSha = head(app.remote);
    const depSha = head(dep.remote);
    writeFileSync(bench.events, '');

    result = await runCli(bench, [appId, 'local', ...flags(bench)], { actor: 'noop' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /Nothing to publish/);
    assert.equal(eventsOf(bench).length, 0);
    assert.equal(head(app.remote), appSha);
    assert.equal(head(dep.remote), depSha);

    commitFile(dep.local, 'lib.txt', 'changed\n', 'lib');
    const appBefore = head(app.local);
    result = await runCli(bench, [appId, 'local', ...flags(bench)], { actor: 'depchange' });
    assert.equal(result.code, 0, result.err);
    assert.match(result.err, /rebuild after deps 910041/);
    assert.notEqual(head(app.local), appBefore);
    assert.equal(head(app.remote), head(app.local));
    assert.equal(git(app.local, ['rev-parse', 'HEAD^{tree}']), git(app.local, ['rev-parse', 'HEAD~1^{tree}']));
    assert.match(readFileSync(join(dep.remote, 'lib.txt'), 'utf8'), /changed/);
    const lines = eventsOf(bench);
    assert.equal(lines.filter((line) => line.startsWith('hook-start ')).length, 1);
    assert.ok(lines.some((line) => line.startsWith(`dep-skip mls-${depId} `)));
    assert.ok(lines.some((line) => line.startsWith(`hook-end mls-${appId} `)));
  } finally {
    rmSync(heldLock, { recursive: true, force: true });
    rmSync(bench.root, { recursive: true, force: true });
  }
});

test('lima reservation: other owner, browser, inherited operation, dropped finish, and remote', { timeout: 60000 }, async () => {
  const bench = makeBench();
  const lockPath = join(bench.root, 'lima.lock');
  try {
    const id = '102047';
    const { local, remote } = pair(bench, id);
    const base = head(remote);
    commitFile(local, 'n.txt', 'n\n', 'n');

    const other = await dispatch({
      op: 'acquire', session: 'tester-a', projectId: '102047', origin: 'test', lockPath,
    });
    assert.equal(other.ok, true);
    let refused = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'other' });
    assert.notEqual(refused.code, 0);
    assert.match(refused.err, /session busy/);
    assert.doesNotMatch(refused.err, /ownerId/);
    assert.deepEqual(gitLog(bench, 'other'), []);
    assert.equal(head(remote), base);
    await dispatch({ op: 'end', ownerId: other.ownerId, lockPath });

    const browserOwner = await dispatch({
      op: 'acquire', session: 'publish', projectId: '102047', origin: 'test', lockPath,
    });
    const prep = await dispatch({
      op: 'beginOperation', ownerId: browserOwner.ownerId, name: 'prep', phase: 'preparing', lockPath,
    });
    await dispatch({
      op: 'finishOperation', ownerId: browserOwner.ownerId, operationId: prep.operationId, phase: 'ready', lockPath,
    });
    await dispatch({
      op: 'bindBrowser', ownerId: browserOwner.ownerId, browserId: 'camp-responsavel', lockPath,
    });
    saveOwnerRef(limaProfile(bench), {
      vm: 'lima-ubuntu24', session: 'publish', projectId: '102047', ownerId: browserOwner.ownerId, operationId: null,
    });
    refused = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'browser' });
    assert.notEqual(refused.code, 0);
    assert.match(refused.err, /browser registered/);
    assert.deepEqual(gitLog(bench, 'browser'), []);
    assert.equal(head(remote), base);
    await dispatch({
      op: 'unbindBrowser', ownerId: browserOwner.ownerId, browserId: 'camp-responsavel', lockPath,
    });
    await dispatch({ op: 'end', ownerId: browserOwner.ownerId, lockPath });
    rmSync(join(bench.root, 'lima-state'), { recursive: true, force: true });

    const camp = await dispatch({
      op: 'acquire', session: 'camp', projectId: '102047', origin: 'test', lockPath,
    });
    const operation = await dispatch({
      op: 'beginOperation', ownerId: camp.ownerId, name: 'prepare', phase: 'preparing', lockPath,
    });
    saveOwnerRef(limaProfile(bench), {
      vm: 'lima-ubuntu24', session: 'camp', projectId: '102047', ownerId: camp.ownerId, operationId: operation.operationId,
    });
    writeFileSync(join(bench.root, 'lima.log'), '');
    const joined = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'inherit' });
    assert.equal(joined.code, 0, joined.err);
    const ops = limaLog(bench);
    assert.ok(ops.includes('status'));
    assert.equal(ops.includes('beginOperation'), false);
    assert.equal(ops.includes('end'), false);
    const held = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(held.operations.length, 1);
    assert.equal(held.operations[0].id, operation.operationId);
    assert.notEqual(head(remote), base);
    await dispatch({
      op: 'finishOperation', ownerId: camp.ownerId, operationId: operation.operationId, phase: 'ready', lockPath,
    });
    await dispatch({ op: 'end', ownerId: camp.ownerId, lockPath });
    rmSync(join(bench.root, 'lima-state'), { recursive: true, force: true });

    const again = commitFile(local, 'd.txt', 'd\n', 'd');
    const dropped = await runCli(bench, [id, 'local', ...flags(bench)], {
      actor: 'drop',
      extraEnv: { COLLAB_LIMA_FAIL_OP: 'finishOperation' },
    });
    assert.equal(dropped.code, 0, dropped.err);
    assert.equal(head(remote), again);
    const retained = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(retained.operations.length, 1);
    const follower = await runCli(bench, [id, 'local', ...flags(bench)], { actor: 'follower' });
    assert.notEqual(follower.code, 0);
    assert.match(follower.err, /occupied/);
    assert.deepEqual(gitLog(bench, 'follower'), []);

    const remoteOnly = pair(bench, '910099');
    const kept = commitFile(remoteOnly.remote, 'vm.txt', 'vm\n', 'vm');
    writeFileSync(join(bench.root, 'lima.log'), '');
    const remoteRun = await runCli(bench, ['910099', 'remote', ...flags(bench)], { actor: 'remote-profile' });
    assert.notEqual(remoteRun.code, 0);
    assert.equal(head(remoteOnly.remote), kept);
    assert.deepEqual(limaLog(bench), []);
  } finally {
    rmSync(bench.root, { recursive: true, force: true });
  }
});
