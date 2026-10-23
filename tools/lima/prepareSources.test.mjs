import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { beginSession, withLimaOperation } from './session.mjs';
import { planLocalSources, prepareSources, PROJECT_ID } from './prepareSources.mjs';

const PIN = { libs: '20260101010101', monaco: '20260101010102' };
const RELEASE_ID = '20261018120000';
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'bench',
  GIT_AUTHOR_EMAIL: 'bench@collab.local',
  GIT_COMMITTER_NAME: 'bench',
  GIT_COMMITTER_EMAIL: 'bench@collab.local',
};

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { env: gitEnv, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return (result.stdout || '').trim();
}

function commitFile(repo, name, body, message) {
  writeFileSync(join(repo, name), body);
  git(repo, ['add', name]);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'bench@collab.local']);
  git(dir, ['config', 'user.name', 'bench']);
  return dir;
}

function sshSource() {
  return `#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
const remote = argv[argv.length - 1] || '';
appendFileSync(process.env.PREPARE_SSH_LOG, (process.env.PREPARE_TOUCH || '-') + ' ' + remote + '\\n');
const vm = process.env.PREPARE_VM;
// Commands below go through sh, which eats the backslashes of a Windows path.
const vmSh = vm.replaceAll('\\\\', '/');
const mac = process.env.PREPARE_MAC;
if (remote.startsWith('node --input-type=module')) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const quoted = remote.slice('node --input-type=module - '.length);
  const json = quoted.startsWith("'") ? quoted.slice(1, -1).replaceAll("'\\\\''", "'") : quoted;
  const child = spawn(process.execPath, ['--input-type=module', '-', json], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(Buffer.concat(chunks));
  child.on('close', (code) => process.exit(code ?? 1));
} else if (remote.includes('git-receive-pack') || remote.includes('git-upload-pack')) {
  const service = remote.includes('git-upload-pack') ? 'upload-pack' : 'receive-pack';
  const quoted = remote.match(/'([^']+)'/);
  const raw = quoted ? quoted[1] : (remote.trim().split(/\\s+/).pop() || '');
  const name = raw.replaceAll('\\\\', '/').split('/').pop();
  const target = name && /^mls-\\d+$/.test(name) ? join(vm, name) : vm;
  if (service === 'receive-pack' && name === 'mls-102047' && process.env.PREPARE_TOUCH === 'source-race') {
    const flag = process.env.PREPARE_RACE_FILE;
    if (!flag || !readFileSync(flag, 'utf8')) {
      const app = join(mac, 'mls-102047');
      writeFileSync(join(app, 'l5', 'raced.json'), '{"raced":true}\\n');
      const raceEnv = { ...process.env, GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@collab.local', GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@collab.local' };
      spawnSync('git', ['-C', app, 'add', '--', 'l5/raced.json'], { encoding: 'utf8', env: raceEnv });
      spawnSync('git', ['-C', app, 'commit', '-m', 'raced source'], { encoding: 'utf8', env: raceEnv });
      if (flag) writeFileSync(flag, 'done');
    }
  }
  const child = spawn('git', [service, target], { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 1));
} else if (remote === 'pm2 jlist') {
  process.stdout.write(readFileSync(process.env.PREPARE_PM2, 'utf8'));
} else if (remote.includes('gitPostReceive.mjs')) {
  if (process.env.PREPARE_BUILD === 'error') {
    process.stdout.write('##gitBackend build=error project=mls-102047##\\n');
    process.exit(0);
  }
  const rootSha = spawnSync('git', ['-C', vm, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const appSha = spawnSync('git', ['-C', join(vm, 'mls-102047'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const pin = JSON.parse(readFileSync(process.env.PREPARE_PIN, 'utf8'));
  const release = join(vm, 'releases', ${JSON.stringify(RELEASE_ID)});
  const declared = JSON.parse(readFileSync(join(vm, 'mls-102047', 'l5', 'config.json'), 'utf8')).workspaceDependencies || [];
  const deps = {};
  for (const id of declared) deps[id] = spawnSync('git', ['-C', join(vm, 'mls-' + id), 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).stdout.trim();
  const stamp = { id: ${JSON.stringify(RELEASE_ID)}, client: '102047', versionRef: appSha, platformCommit: rootSha, libs: pin.libs, monaco: pin.monaco, deps, secret: 'no' };
  writeFileSync(join(release, 'release.json'), JSON.stringify(stamp));
  process.stdout.write('##gitBackend build=ok release=${RELEASE_ID} project=mls-102047##\\n');
} else if (remote === 'git -C /data/mls-base rev-parse HEAD' && process.env.PREPARE_TOUCH === 'lease') {
  const before = spawnSync('git', ['-C', vm, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  if (!process.env.PREPARE_LEASE_DONE) {
    writeFileSync(join(vm, 'other.txt'), 'moved');
    spawnSync('git', ['-C', vm, 'add', 'other.txt'], { encoding: 'utf8' });
    spawnSync('git', ['-C', vm, 'commit', '-m', 'race'], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@collab.local', GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@collab.local' },
    });
  }
  process.stdout.write(before + '\\n');
} else if (process.env.PREPARE_TOUCH === 'dirty' && remote === 'git -C /data/mls-base rev-parse HEAD') {
  writeFileSync(join(mac, 'raced.txt'), 'x');
  const cmd = remote.replaceAll('/data/mls-base', vmSh);
  const child = spawn('sh', ['-c', cmd], { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 1));
} else {
  const cmd = remote.replaceAll('/data/mls-base', vmSh);
  const child = spawn('sh', ['-c', cmd], { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 1));
}
`;
}

function writePm2(path) {
  writeFileSync(path, JSON.stringify([
    { name: 'app2047', pm2_env: { pm_cwd: '/data/mls-base/current-102047', DATABASE_URL_TEST: 'hidden' } },
    { name: 'app2043', pm2_env: { pm_cwd: '/data/mls-base/current-102043' } },
  ]));
}

function bench(mode = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lima-s5-')));
  const mac = join(root, 'mac');
  const vm = join(root, 'vm');
  const stateDir = join(root, 'state');
  const sshConfig = join(root, 'ssh_config');
  const sshLog = join(root, 'ssh.log');
  // A .mjs runs under node (session.mjs spawnArgsFor): no sh wrapper, so Windows runs it too.
  const sshBin = join(root, 'ssh.mjs');
  const pm2 = join(root, 'pm2.json');
  const pinPath = join(root, 'pin.json');
  const lockPath = join(root, 'lima.lock');
  writeFileSync(sshConfig, 'Host lima-ubuntu24\n  HostName 127.0.0.1\n');
  writeFileSync(sshBin, sshSource());
  writeFileSync(sshLog, '');
  writePm2(pm2);
  writeFileSync(pinPath, JSON.stringify(PIN));
  initRepo(mac);
  writeFileSync(join(mac, '.gitignore'), 'mls-*\n.env\nscripts/\ntools/\n');
  writeFileSync(join(mac, 'package.json'), `${JSON.stringify({ name: 'mls-base', collabLibs: PIN }, null, 2)}\n`);
  writeFileSync(join(mac, 'README'), 'platform\n');
  git(mac, ['add', '.gitignore', 'package.json', 'README']);
  git(mac, ['commit', '-m', 'platform']);
  const rootSha = git(mac, ['rev-parse', 'HEAD']);
  const app = initRepo(join(mac, 'mls-102047'));
  mkdirSync(join(app, 'l5'), { recursive: true });
  const appBody = `${JSON.stringify({ workspaceDependencies: ['102034'] })}\n`;
  const appSha = commitFile(app, 'l5/config.json', appBody, 'app');
  const dep = initRepo(join(mac, 'mls-102034'));
  commitFile(dep, 'README', 'dep\n', 'dep');
  spawnSync('git', ['clone', '--local', mac, vm], { encoding: 'utf8' });
  git(vm, ['config', 'receive.denyCurrentBranch', 'updateInstead']);
  spawnSync('git', ['clone', '--local', app, join(vm, 'mls-102047')], { encoding: 'utf8' });
  spawnSync('git', ['clone', '--local', dep, join(vm, 'mls-102034')], { encoding: 'utf8' });
  const release = join(vm, 'releases', RELEASE_ID);
  mkdirSync(release, { recursive: true });
  const stamp = {
    id: RELEASE_ID, client: '102047', versionRef: appSha, platformCommit: rootSha, libs: PIN.libs, monaco: PIN.monaco,
  };
  if (mode.stampDeps !== false) stamp.deps = { 102034: git(dep, ['rev-parse', 'HEAD^{tree}']) };
  writeFileSync(join(release, 'release.json'), JSON.stringify(stamp));
  // Windows needs admin/Developer Mode for a symlink; a junction (absolute target) needs neither.
  if (process.platform === 'win32') symlinkSync(release, join(vm, 'current-102047'), 'junction');
  else symlinkSync(join('releases', RELEASE_ID), join(vm, 'current-102047'));
  const env = {
    ...gitEnv,
    LIMA_SSH_BIN: sshBin,
    LIMA_LOCK_PATH: lockPath,
    LIMA_STATE_DIR: stateDir,
    LIMA_PROJECT_ROOT: root,
    PREPARE_VM: vm,
    PREPARE_MAC: mac,
    PREPARE_SSH_LOG: sshLog,
    PREPARE_PM2: pm2,
    PREPARE_PIN: pinPath,
    PREPARE_BUILD: mode.build || '',
    PREPARE_TOUCH: mode.touch || '',
  };
  const profile = { sshConfig, alias: 'lima-ubuntu24', root, stateDir };
  const options = { sshBin, lockPath, env };
  return { root, mac, vm, sshLog, pm2, env, profile, options, rootSha, appSha, dep };
}

function logText(sshLog) {
  return readFileSync(sshLog, 'utf8');
}

async function held(box, fn) {
  await beginSession(box.profile, 'codex-s5', PROJECT_ID, box.options);
  return withLimaOperation(box.profile, {
    session: 'codex-s5', projectId: PROJECT_ID, name: 'prepare-sources', phase: 'preparing',
  }, fn, box.options);
}

test('plan is stable and records the pin', async () => {
  const box = bench();
  const first = await planLocalSources(box.mac, PROJECT_ID, box.env);
  const second = await planLocalSources(box.mac, PROJECT_ID, box.env);
  assert.deepEqual(first, second);
  assert.equal(first.blocked.length, 0);
  assert.deepEqual(first.pin, PIN);
  assert.equal(first.deps.length, 1);
  assert.equal(first.deps[0].id, '102034');
});

test('dirty tree and generation lock block before any send', async () => {
  const dirty = bench();
  writeFileSync(join(dirty.mac, 'mls-102047', 'wip.txt'), 'x');
  const plan = await planLocalSources(dirty.mac, PROJECT_ID, dirty.env);
  assert.ok(plan.blocked.includes('mls-102047'));
  await held(dirty, async () => {
    const result = await prepareSources({
      root: dirty.mac, profile: dirty.profile, session: 'codex-s5', env: dirty.env, sshBin: dirty.options.sshBin,
      lockPath: dirty.options.lockPath,
      spawnPublish: () => { throw new Error('publish ran'); },
    });
    assert.equal(result.ok, false);
    assert.equal(result.sent, false);
    assert.equal(result.ready, false);
    assert.equal(result.code, 'dirty');
  });
  assert.equal(logText(dirty.sshLog).includes('git-receive-pack'), false);
  assert.equal(logText(dirty.sshLog).includes('gitPostReceive'), false);

  const locked = bench();
  writeFileSync(join(locked.mac, 'mls-102034', '.collab-msg.lock'), 'agent');
  await held(locked, async () => {
    const result = await prepareSources({
      root: locked.mac, profile: locked.profile, session: 'codex-s5', env: locked.env, sshBin: locked.options.sshBin,
      lockPath: locked.options.lockPath,
      spawnPublish: () => { throw new Error('publish ran'); },
    });
    assert.equal(result.sent, false);
    assert.equal(result.code, 'dirty');
    assert.ok(result.blocked.some((item) => item.includes('.collab-msg.lock')));
  });
});

test('coherent tree is a no-op and a root change forces the official build', async () => {
  const quiet = bench();
  let published = 0;
  await held(quiet, async () => {
    const result = await prepareSources({
      root: quiet.mac, profile: quiet.profile, session: 'codex-s5', env: quiet.env, sshBin: quiet.options.sshBin,
      lockPath: quiet.options.lockPath,
      spawnPublish: (spec) => {
        published += 1;
        assert.equal(spec.projectId, '102047');
        assert.equal(spec.autocommit, false);
        return { code: 0, text: '[publishGit] Nothing to publish\n', uncertain: false };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.ready, false);
    assert.equal(result.phase, 'sources');
    assert.equal(result.forcedBuild, false);
    assert.equal(result.sent, false);
    assert.deepEqual(result.evidence.pin, PIN);
    assert.equal(result.evidence.release.versionRef, quiet.appSha);
    assert.equal(result.evidence.workers[0].cwd.includes('current-102047'), true);
    assert.equal(JSON.stringify(result.evidence).includes('hidden'), false);
  });
  assert.equal(published, 1);
  assert.equal(logText(quiet.sshLog).includes('gitPostReceive'), false);
  assert.equal(logText(quiet.sshLog).includes('current-102043'), false);

  const moved = bench();
  const before = readFileSync(moved.pm2, 'utf8');
  commitFile(moved.mac, 'again.txt', 'root\n', 'root again');
  await held(moved, async () => {
    const result = await prepareSources({
      root: moved.mac, profile: moved.profile, session: 'codex-s5', env: moved.env, sshBin: moved.options.sshBin,
      lockPath: moved.options.lockPath,
      spawnPublish: () => ({ code: 0, text: 'Nothing to publish\n', uncertain: false }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.ready, false);
    assert.equal(result.forcedBuild, true);
    assert.equal(result.evidence.initialAppSha, result.evidence.finalAppSha);
    assert.equal(result.evidence.release.platformCommit, result.evidence.initialRootSha);
  });
  assert.equal(logText(moved.sshLog).includes('git-receive-pack'), true);
  assert.equal(logText(moved.sshLog).includes('gitPostReceive.mjs --root /data/mls-base --project 102047'), true);
  assert.equal(readFileSync(moved.pm2, 'utf8'), before);
  assert.equal(logText(moved.sshLog).includes('102056'), false);
});

function quietPrepare(box) {
  return held(box, () => prepareSources({
    root: box.mac, profile: box.profile, session: 'codex-s5', env: box.env, sshBin: box.options.sshBin,
    lockPath: box.options.lockPath,
    spawnPublish: () => ({ code: 0, text: '[publishGit] Nothing to publish\n', uncertain: false }),
  }));
}

test('release built from the planned dependency trees is a no-op', async () => {
  const same = bench();
  const sameResult = await quietPrepare(same);
  assert.equal(sameResult.ok, true);
  assert.equal(sameResult.forcedBuild, false);
  assert.deepEqual(sameResult.evidence.release.deps, { 102034: git(same.dep, ['rev-parse', 'HEAD^{tree}']) });
  assert.equal(logText(same.sshLog).includes('gitPostReceive'), false);
});

test('dependency repos updated on the VM by another prepare still force this release to rebuild', async () => {
  // Another project's prepare already moved the dependency repo on the VM, but this
  // project's release was built before: the VM repo matches, the release does not.
  const moved = bench();
  const oldTree = git(moved.dep, ['rev-parse', 'HEAD^{tree}']);
  commitFile(moved.dep, 'NEW', 'dep v2\n', 'dep v2');
  const newTree = git(moved.dep, ['rev-parse', 'HEAD^{tree}']);
  git(join(moved.vm, 'mls-102034'), ['pull', '-q', '--ff-only']);
  assert.equal(git(join(moved.vm, 'mls-102034'), ['rev-parse', 'HEAD^{tree}']), newTree);
  const movedResult = await quietPrepare(moved);
  assert.equal(movedResult.ok, true);
  assert.equal(movedResult.forcedBuild, true);
  assert.notEqual(oldTree, newTree);
  assert.deepEqual(movedResult.evidence.release.deps, { 102034: newTree });
  assert.equal(logText(moved.sshLog).includes('gitPostReceive.mjs --root /data/mls-base --project 102047'), true);
});

test('a release stamp without deps forces the rebuild', async () => {
  // A release stamped before deps were recorded cannot prove its dependencies.
  const legacy = bench({ stampDeps: false });
  const legacyResult = await quietPrepare(legacy);
  assert.equal(legacyResult.ok, true);
  assert.equal(legacyResult.forcedBuild, true);
  assert.deepEqual(legacyResult.evidence.release.deps, { 102034: git(legacy.dep, ['rev-parse', 'HEAD^{tree}']) });
});

test('build error is not ready and a disconnect keeps the worktree', async () => {
  const broken = bench({ build: 'error' });
  commitFile(broken.mac, 'again.txt', 'root\n', 'root again');
  await held(broken, async () => {
    const result = await prepareSources({
      root: broken.mac, profile: broken.profile, session: 'codex-s5', env: broken.env, sshBin: broken.options.sshBin,
      lockPath: broken.options.lockPath,
      spawnPublish: () => ({ code: 0, text: 'Nothing to publish\n', uncertain: false }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.ready, false);
    assert.equal(result.phase, 'failed');
    assert.equal(result.code, 'build');
  });

  const lost = bench();
  await held(lost, async () => {
    const result = await prepareSources({
      root: lost.mac, profile: lost.profile, session: 'codex-s5', env: lost.env, sshBin: lost.options.sshBin,
      lockPath: lost.options.lockPath,
      spawnPublish: () => ({ code: null, uncertain: true, text: '' }),
    });
    assert.equal(result.uncertain, true);
    assert.equal(result.ready, false);
    assert.equal(result.phase, 'failed');
  });
  assert.equal(readFileSync(join(lost.mac, '.git', 'HEAD'), 'utf8').includes('ref:'), true);
});

test('a raced edit aborts before push and a refused lease stays uncertain', async () => {
  const raced = bench({ touch: 'dirty' });
  await held(raced, async () => {
    const result = await prepareSources({
      root: raced.mac, profile: raced.profile, session: 'codex-s5', env: raced.env, sshBin: raced.options.sshBin,
      lockPath: raced.options.lockPath,
      spawnPublish: () => ({ code: 0, text: 'Nothing to publish\n', uncertain: false }),
    });
    assert.equal(result.code, 'concurrent');
    assert.equal(result.sent, false);
    assert.equal(result.phase, 'preparing');
  });
  assert.equal(logText(raced.sshLog).includes('git-receive-pack'), false);

  const lease = bench({ touch: 'lease' });
  commitFile(lease.mac, 'again.txt', 'root\n', 'root again');
  await held(lease, async () => {
    const result = await prepareSources({
      root: lease.mac, profile: lease.profile, session: 'codex-s5', env: lease.env, sshBin: lease.options.sshBin,
      lockPath: lease.options.lockPath,
      spawnPublish: () => ({ code: 0, text: 'Nothing to publish\n', uncertain: false }),
    });
    assert.equal(result.code, 'root-push');
    assert.equal(result.uncertain, true);
    assert.equal(result.sent, true);
  });
  assert.equal(readFileSync(join(lease.mac, '.git', 'HEAD'), 'utf8').length > 0, true);
});

const OBJ_SUBJECT = 'chore: remove obj/ (build happens on the VM)';
const REBUILD_SUBJECT = 'publish: rebuild after deps 102034';

function appOf(box) {
  return join(box.mac, 'mls-102047');
}

function rememberRelease(box, sha) {
  const release = join(box.vm, 'releases', RELEASE_ID, 'release.json');
  const stamp = JSON.parse(readFileSync(release, 'utf8'));
  stamp.versionRef = sha;
  writeFileSync(release, JSON.stringify(stamp));
}

function publishResult(box, sha) {
  rememberRelease(box, sha);
  return {
    code: 0,
    text: `##gitBackend build=ok release=${RELEASE_ID} project=mls-102047##\n`,
    uncertain: false,
  };
}

function trackObj(repo, gitignore) {
  mkdirSync(join(repo, 'obj'), { recursive: true });
  writeFileSync(join(repo, 'obj', 'compiled.zip'), 'compiled');
  writeFileSync(join(repo, 'obj', 'source.zip'), 'source');
  if (gitignore === undefined) writeFileSync(join(repo, '.gitignore'), '/obj/\n');
  else if (gitignore !== null) writeFileSync(join(repo, '.gitignore'), gitignore);
  const add = ['.gitignore', 'obj/compiled.zip', 'obj/source.zip'].filter((name) => name !== '.gitignore' || gitignore !== null);
  git(repo, ['add', '-f', '--', ...add]);
  git(repo, ['commit', '-m', 'ci obj']);
  return git(repo, ['rev-parse', 'HEAD']);
}

function removeTrackedObj(repo, gitignore) {
  if (gitignore !== undefined) writeFileSync(join(repo, '.gitignore'), gitignore);
  const args = ['add', '--'];
  if (gitignore !== undefined) args.push('.gitignore');
  git(repo, args.length > 2 ? args : ['add', '--', '.gitignore']);
  git(repo, ['rm', '-r', '--cached', '--ignore-unmatch', '--', 'obj']);
  rmSync(join(repo, 'obj'), { recursive: true, force: true });
  git(repo, ['commit', '-m', OBJ_SUBJECT, '--', 'obj', '.gitignore']);
  return git(repo, ['rev-parse', 'HEAD']);
}

async function duringPublish(box, mutate) {
  let finalSha = '';
  await held(box, async () => {
    const result = await prepareSources({
      root: box.mac,
      profile: box.profile,
      session: 'codex-s5',
      env: box.env,
      sshBin: box.options.sshBin,
      lockPath: box.options.lockPath,
      spawnPublish: () => {
        finalSha = mutate(box) || git(appOf(box), ['rev-parse', 'HEAD']);
        return publishResult(box, finalSha);
      },
    });
    box.result = result;
  });
  return { result: box.result, finalSha };
}

test('publisher obj cleanup and empty rebuild keep the captured sources', async () => {
  const tracked = bench();
  const initial = trackObj(appOf(tracked));
  const beforePlan = await planLocalSources(tracked.mac, PROJECT_ID, tracked.env);
  const trackedRun = await duringPublish(tracked, () => removeTrackedObj(appOf(tracked)));
  assert.equal(trackedRun.result.ok, true);
  assert.equal(trackedRun.result.ready, false);
  assert.equal(trackedRun.result.evidence.initialAppSha, initial);
  assert.equal(trackedRun.result.evidence.finalAppSha, trackedRun.finalSha);
  assert.notEqual(trackedRun.result.evidence.finalAppSha, initial);
  assert.equal(trackedRun.result.evidence.release.versionRef, trackedRun.finalSha);
  const sameTree = await planLocalSources(tracked.mac, PROJECT_ID, tracked.env);
  assert.equal(sameTree.appSha, trackedRun.finalSha);
  assert.equal(sameTree.appTree, beforePlan.appTree);

  const created = bench();
  trackObj(appOf(created), null);
  const createdRun = await duringPublish(created, () => removeTrackedObj(appOf(created), '/obj/\n'));
  assert.equal(createdRun.result.ok, true);
  assert.equal(readFileSync(join(appOf(created), '.gitignore'), 'utf8'), '/obj/\n');
  assert.equal(createdRun.result.evidence.release.versionRef, createdRun.finalSha);

  const glued = bench();
  trackObj(appOf(glued), 'dist');
  const gluedRun = await duringPublish(glued, () => removeTrackedObj(appOf(glued), 'dist\n/obj/\n'));
  assert.equal(gluedRun.result.ok, true);
  assert.equal(readFileSync(join(appOf(glued), '.gitignore'), 'utf8'), 'dist\n/obj/\n');

  const disk = bench();
  writeFileSync(join(appOf(disk), '.gitignore'), '*.zip\n');
  git(appOf(disk), ['add', '--', '.gitignore']);
  git(appOf(disk), ['commit', '-m', 'ignore zip']);
  mkdirSync(join(appOf(disk), 'obj'), { recursive: true });
  writeFileSync(join(appOf(disk), 'obj', 'compiled.zip'), 'local');
  const diskInitial = git(appOf(disk), ['rev-parse', 'HEAD']);
  const diskRun = await duringPublish(disk, () => {
    writeFileSync(join(appOf(disk), '.gitignore'), '*.zip\n/obj/\n');
    git(appOf(disk), ['add', '--', '.gitignore']);
    rmSync(join(appOf(disk), 'obj'), { recursive: true, force: true });
    git(appOf(disk), ['commit', '-m', OBJ_SUBJECT, '--', '.gitignore']);
    return git(appOf(disk), ['rev-parse', 'HEAD']);
  });
  assert.equal(diskRun.result.ok, true);
  assert.equal(diskRun.result.evidence.initialAppSha, diskInitial);
  assert.notEqual(diskRun.result.evidence.finalAppSha, diskInitial);

  const rebuilt = bench();
  const rebuildRun = await duringPublish(rebuilt, () => {
    git(appOf(rebuilt), ['commit', '--allow-empty', '-m', REBUILD_SUBJECT]);
    return git(appOf(rebuilt), ['rev-parse', 'HEAD']);
  });
  assert.equal(rebuildRun.result.ok, true);
  assert.equal(rebuildRun.result.evidence.initialAppSha, rebuilt.appSha);
  assert.equal(rebuildRun.result.evidence.release.versionRef, rebuildRun.finalSha);

  const both = bench();
  const bothInitial = trackObj(appOf(both));
  const bothRun = await duringPublish(both, () => {
    removeTrackedObj(appOf(both));
    git(appOf(both), ['commit', '--allow-empty', '-m', REBUILD_SUBJECT]);
    return git(appOf(both), ['rev-parse', 'HEAD']);
  });
  assert.equal(bothRun.result.ok, true);
  assert.equal(bothRun.result.evidence.initialAppSha, bothInitial);
  assert.equal(bothRun.result.evidence.finalAppSha, bothRun.finalSha);

  const quiet = bench();
  const before = git(appOf(quiet), ['rev-parse', 'HEAD']);
  await held(quiet, async () => {
    const result = await prepareSources({
      root: quiet.mac, profile: quiet.profile, session: 'codex-s5', env: quiet.env, sshBin: quiet.options.sshBin,
      lockPath: quiet.options.lockPath,
      spawnPublish: () => ({ code: 0, text: '[publishGit] Nothing to publish\n', uncertain: false }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.evidence.initialAppSha, before);
    assert.equal(result.evidence.finalAppSha, before);
  });
  assert.equal(git(appOf(quiet), ['rev-parse', 'HEAD']), before);
});

test('prepare refuses commits outside the publisher sequence', async () => {
  async function refused(mutate) {
    const box = bench();
    trackObj(appOf(box));
    const run = await duringPublish(box, () => {
      mutate(box);
      return git(appOf(box), ['rev-parse', 'HEAD']);
    });
    assert.equal(run.result.ok, false);
    assert.equal(run.result.code, 'concurrent');
    assert.equal(run.result.uncertain, true);
    assert.equal(run.result.sent, true);
    assert.equal(run.result.ready, false);
  }

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, 'l5', 'config.json'), '{"changed":true}\n');
    git(repo, ['add', '--', 'l5/config.json']);
    git(repo, ['rm', '-r', '--cached', '--', 'obj']);
    rmSync(join(repo, 'obj'), { recursive: true, force: true });
    git(repo, ['commit', '-m', OBJ_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, '.gitignore'), '*\n');
    git(repo, ['add', '--', '.gitignore']);
    git(repo, ['rm', '-r', '--cached', '--', 'obj']);
    rmSync(join(repo, 'obj'), { recursive: true, force: true });
    git(repo, ['commit', '-m', OBJ_SUBJECT, '--', 'obj', '.gitignore']);
  });

  await refused((box) => {
    const repo = appOf(box);
    git(repo, ['rm', '--', '.gitignore']);
    git(repo, ['commit', '-m', OBJ_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, 'obj', 'compiled.zip'), 'changed');
    git(repo, ['add', '-f', '--', 'obj/compiled.zip']);
    git(repo, ['commit', '-m', OBJ_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, 'obj', 'extra.zip'), 'extra');
    git(repo, ['add', '-f', '--', 'obj/extra.zip']);
    git(repo, ['commit', '-m', OBJ_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    git(repo, ['checkout', '-b', 'side']);
    writeFileSync(join(repo, 'side.txt'), 's');
    git(repo, ['add', '--', 'side.txt']);
    git(repo, ['commit', '-m', 'side']);
    git(repo, ['checkout', 'main']);
    writeFileSync(join(repo, 'main.txt'), 'm');
    git(repo, ['add', '--', 'main.txt']);
    git(repo, ['commit', '-m', 'main']);
    git(repo, ['merge', '--no-ff', '-m', OBJ_SUBJECT, 'side']);
  });

  await refused((box) => {
    const repo = appOf(box);
    const tree = git(repo, ['rev-parse', 'HEAD^{tree}']);
    const parent = git(repo, ['rev-parse', 'HEAD^']);
    const next = git(repo, ['commit-tree', tree, '-p', parent, '-m', OBJ_SUBJECT]);
    git(repo, ['reset', '--soft', next]);
  });

  await refused((box) => {
    const repo = appOf(box);
    git(repo, ['commit', '--amend', '-m', OBJ_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, 'l5', 'config.json'), '{"noise":true}\n');
    git(repo, ['add', '--', 'l5/config.json']);
    git(repo, ['commit', '-m', 'noise']);
    git(repo, ['revert', '--no-edit', 'HEAD']);
    git(repo, ['commit', '--amend', '-m', REBUILD_SUBJECT]);
  });

  await refused((box) => {
    const repo = appOf(box);
    writeFileSync(join(repo, 'l5', 'config.json'), '{"built":true}\n');
    git(repo, ['add', '--', 'l5/config.json']);
    git(repo, ['commit', '-m', REBUILD_SUBJECT]);
  });

  const rooted = bench();
  await duringPublish(rooted, (box) => {
    writeFileSync(join(box.mac, 'root-moved.txt'), 'x');
    git(box.mac, ['add', '--', 'root-moved.txt']);
    git(box.mac, ['commit', '-m', 'root moved']);
  });
  assert.equal(rooted.result.code, 'concurrent');
  assert.equal(rooted.result.uncertain, true);

  const pinned = bench();
  await duringPublish(pinned, (box) => {
    const pkg = JSON.parse(readFileSync(join(box.mac, 'package.json'), 'utf8'));
    pkg.collabLibs.libs = '20260101010109';
    writeFileSync(join(box.mac, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    git(box.mac, ['add', '--', 'package.json']);
    git(box.mac, ['commit', '-m', 'pin']);
  });
  assert.equal(pinned.result.code, 'concurrent');

  const dep = bench();
  await duringPublish(dep, (box) => {
    writeFileSync(join(box.mac, 'mls-102034', 'README'), 'dep moved\n');
    git(join(box.mac, 'mls-102034'), ['add', '--', 'README']);
    git(join(box.mac, 'mls-102034'), ['commit', '-m', 'dep']);
  });
  assert.equal(dep.result.code, 'concurrent');

  const locked = bench();
  await duringPublish(locked, (box) => {
    writeFileSync(join(appOf(box), '.collab-msg.lock'), 'agent');
  });
  assert.equal(locked.result.code, 'concurrent');
  assert.equal(locked.result.uncertain, true);

  const missing = bench();
  const parent = git(appOf(missing), ['rev-parse', 'HEAD']);
  await duringPublish(missing, (box) => {
    const repo = appOf(box);
    git(repo, ['commit', '--allow-empty', '-m', REBUILD_SUBJECT]);
    const loose = join(repo, '.git', 'objects', parent.slice(0, 2), parent.slice(2));
    unlinkSync(loose);
  });
  assert.equal(missing.result.ok, false);
  assert.equal(missing.result.code, 'concurrent');
  assert.equal(missing.result.uncertain, true);
});

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MLS_SCRIPTS = join(HERE, 'scripts');
const PUBLISHER_FILES = [
  'publishGit.mjs',
  'publishGitDeps.mjs',
  'publishGitAuth.mjs',
  'publishGitLogin.mjs',
  'publishGitLocalLock.mjs',
  'syncTsconfigPaths.mjs',
  'validateClientConfig.mjs',
];

function armPublisher(box) {
  const scripts = join(box.mac, 'scripts');
  mkdirSync(join(box.mac, 'tools', 'lima'), { recursive: true });
  mkdirSync(scripts, { recursive: true });
  for (const name of PUBLISHER_FILES) copyFileSync(join(MLS_SCRIPTS, name), join(scripts, name));
  const limaDir = dirname(fileURLToPath(import.meta.url));
  copyFileSync(join(limaDir, 'session.mjs'), join(box.mac, 'tools', 'lima', 'session.mjs'));
  copyFileSync(join(limaDir, 'sessionVm.mjs'), join(box.mac, 'tools', 'lima', 'sessionVm.mjs'));
  writeFileSync(join(box.mac, '.env'), [
    'PUBLISH_LOCAL_SSH_HOST=lima-ubuntu24',
    `PUBLISH_LOCAL_SSH_CONFIG=${box.profile.sshConfig}`,
    'PUBLISH_LOCAL_REMOTE_BASE=/data/mls-base',
    '',
  ].join('\n'));
  const bin = join(box.root, 'bin');
  mkdirSync(bin, { recursive: true });
  copyFileSync(box.options.sshBin, join(bin, 'ssh'));
  chmodSync(join(bin, 'ssh'), 0o755);
  box.env.PATH = `${bin}:${process.env.PATH}`;
  for (const id of ['102047', '102034']) {
    const repo = join(box.vm, `mls-${id}`);
    git(repo, ['config', 'receive.denyCurrentBranch', 'updateInstead']);
    git(repo, ['config', 'receive.advertisePushOptions', 'true']);
  }
  const release = join(box.vm, 'releases', RELEASE_ID, 'release.json');
  const hook = join(box.vm, 'mls-102047', '.git', 'hooks', 'post-receive');
  mkdirSync(join(hook, '..'), { recursive: true });
  writeFileSync(hook, `#!/bin/sh
# simulated hook/build/release — not a live VM
input=$(cat)
newrev=$(printf '%s\\n' "$input" | awk '$3=="refs/heads/main" { print $2; exit }')
"${process.execPath}" -e 'const fs=require("node:fs"); const file=process.argv[1]; const stamp=JSON.parse(fs.readFileSync(file,"utf8")); stamp.versionRef=process.argv[2]; const env={...process.env}; for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key]; stamp.deps={102034: require("node:child_process").spawnSync("git", ["-C", process.argv[3], "rev-parse", "HEAD^{tree}"], {encoding: "utf8", env}).stdout.trim()}; fs.writeFileSync(file, JSON.stringify(stamp));' ${JSON.stringify(release)} "$newrev" ${JSON.stringify(join(box.vm, 'mls-102034'))}
printf 'simulated-hook %s\\n' "$newrev" >> ${JSON.stringify(box.sshLog)}
echo "##gitBackend build=ok release=${RELEASE_ID} project=mls-102047##"
`);
  chmodSync(hook, 0o755);
}

function callPrepare(box) {
  return prepareSources({
    root: box.mac,
    profile: box.profile,
    session: 'codex-s5',
    env: box.env,
    sshBin: box.options.sshBin,
    lockPath: box.options.lockPath,
  });
}

function reservationHeld(box, operationId) {
  const lock = JSON.parse(readFileSync(box.options.lockPath, 'utf8'));
  assert.equal(lock.operations.length, 1);
  assert.equal(lock.operations[0].id, operationId);
  assert.notEqual(lock.phase, 'ready');
  const log = logText(box.sshLog);
  assert.equal(log.includes('finishOperation'), false);
  assert.equal(log.includes('"op":"end"'), false);
  assert.equal(log.includes('migrate'), false);
  assert.equal(log.includes('seed'), false);
}

test('official publish removes tracked obj and a second prepare stays quiet', { timeout: 60000 }, async () => {
  const box = bench();
  armPublisher(box);
  const initial = trackObj(appOf(box));
  await held(box, async ({ operationId }) => {
    const first = await callPrepare(box);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.ready, false);
    assert.equal(first.phase, 'sources');
    assert.equal(first.evidence.initialAppSha, initial);
    assert.notEqual(first.evidence.finalAppSha, initial);
    assert.equal(first.evidence.release.versionRef, first.evidence.finalAppSha);
    assert.equal(existsSync(join(appOf(box), 'obj')), false);
    assert.equal(git(appOf(box), ['ls-files', '--', 'obj']), '');
    assert.match(logText(box.sshLog), /simulated-hook/);
    reservationHeld(box, operationId);
    const head = git(appOf(box), ['rev-parse', 'HEAD']);
    const second = await callPrepare(box);
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(second.ready, false);
    assert.equal(second.evidence.initialAppSha, head);
    assert.equal(second.evidence.finalAppSha, head);
    assert.equal(git(appOf(box), ['rev-parse', 'HEAD']), head);
    reservationHeld(box, operationId);
  });
});

test('official publish adds only /obj/ to gitignore and still cuts an empty dep rebuild', { timeout: 60000 }, async () => {
  const created = bench();
  armPublisher(created);
  trackObj(appOf(created), null);
  await held(created, async () => {
    const result = await callPrepare(created);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(readFileSync(join(appOf(created), '.gitignore'), 'utf8'), '/obj/\n');
    assert.equal(result.evidence.release.versionRef, result.evidence.finalAppSha);
    assert.match(logText(created.sshLog), /simulated-hook/);
  });

  const glued = bench();
  armPublisher(glued);
  trackObj(appOf(glued), 'dist');
  await held(glued, async () => {
    const result = await callPrepare(glued);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(readFileSync(join(appOf(glued), '.gitignore'), 'utf8'), 'dist\n/obj/\n');
  });

  const rebuilt = bench();
  armPublisher(rebuilt);
  const initial = git(appOf(rebuilt), ['rev-parse', 'HEAD']);
  writeFileSync(join(rebuilt.mac, 'mls-102034', 'README'), 'dep moved\n');
  git(join(rebuilt.mac, 'mls-102034'), ['add', '--', 'README']);
  git(join(rebuilt.mac, 'mls-102034'), ['commit', '-m', 'dep']);
  await held(rebuilt, async ({ operationId }) => {
    const result = await callPrepare(rebuilt);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.notEqual(result.evidence.finalAppSha, initial);
    assert.equal(result.evidence.release.versionRef, result.evidence.finalAppSha);
    assert.equal(git(appOf(rebuilt), ['log', '-1', '--format=%s']), 'publish: rebuild after deps 102034');
    assert.equal(git(appOf(rebuilt), ['rev-parse', 'HEAD^{tree}']), git(appOf(rebuilt), ['rev-parse', 'HEAD~1^{tree}']));
    assert.equal(result.ready, false);
    reservationHeld(rebuilt, operationId);
  });
});

test('a source commit during the official publish stays concurrent and uncertain', { timeout: 60000 }, async () => {
  const box = bench({ touch: 'source-race' });
  armPublisher(box);
  const raceFlag = join(box.root, 'race-done');
  writeFileSync(raceFlag, '');
  box.env.PREPARE_RACE_FILE = raceFlag;
  const initial = trackObj(appOf(box));
  await held(box, async ({ operationId }) => {
    const result = await callPrepare(box);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'concurrent');
    assert.equal(result.sent, true);
    assert.equal(result.uncertain, true);
    assert.equal(result.ready, false);
    assert.equal(result.phase, 'failed');
    assert.equal(git(appOf(box), ['log', '-1', '--format=%s']), 'raced source');
    assert.equal(git(appOf(box), ['log', '-1', '--skip=1', '--format=%s']), OBJ_SUBJECT);
    assert.notEqual(result.finalAppSha, initial);
    reservationHeld(box, operationId);
  });
});

test('the pre-s1 prepare rejects the same official obj cleanup as concurrent', { timeout: 60000 }, async () => {
  const priorDir = mkdtempSync(join(tmpdir(), 'rt99-prior-'));
  mkdirSync(join(priorDir, 'tools', 'lima'), { recursive: true });
  mkdirSync(join(priorDir, 'scripts'), { recursive: true });
  symlinkSync(join(dirname(fileURLToPath(import.meta.url)), 'session.mjs'), join(priorDir, 'tools', 'lima', 'session.mjs'));
  symlinkSync(join(MLS_SCRIPTS, 'publishGitDeps.mjs'), join(priorDir, 'scripts', 'publishGitDeps.mjs'));
  const intro = git(HERE, ['log', '-S', 'async function allowedAfterPublish', '-1', '--format=%H', '--', 'tools/lima/prepareSources.mjs']);
  const shown = spawnSync('git', ['-C', HERE, 'show', `${intro}^:tools/lima/prepareSources.mjs`], { encoding: 'utf8' });
  if (shown.status !== 0) throw new Error(shown.stderr || shown.stdout);
  const priorPath = join(priorDir, 'tools', 'lima', 'prepareSources.mjs');
  writeFileSync(priorPath, shown.stdout);
  const prior = await import(pathToFileURL(priorPath).href);
  const box = bench();
  armPublisher(box);
  trackObj(appOf(box));
  await held(box, async () => {
    const result = await prior.prepareSources({
      root: box.mac,
      profile: box.profile,
      session: 'codex-s5',
      env: box.env,
      sshBin: box.options.sshBin,
      lockPath: box.options.lockPath,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'concurrent');
    assert.equal(result.sent, true);
    assert.equal(result.uncertain, true);
    assert.equal(result.ready, false);
  });
  rmSync(priorDir, { recursive: true, force: true });
});
