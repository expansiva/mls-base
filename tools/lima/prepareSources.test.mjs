import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  const child = spawn('git', [service, vm], { stdio: 'inherit' });
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
  const stamp = { id: ${JSON.stringify(RELEASE_ID)}, client: '102047', versionRef: appSha, platformCommit: rootSha, libs: pin.libs, monaco: pin.monaco, secret: 'no' };
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
  const root = mkdtempSync(join(tmpdir(), 'lima-s5-'));
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
  writeFileSync(join(mac, '.gitignore'), 'mls-*\n');
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
  return { root, mac, vm, sshLog, pm2, env, profile, options, rootSha, appSha };
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
