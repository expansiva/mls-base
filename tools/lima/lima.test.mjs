import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLAIM_TIMEOUT_MS, LONG_TIMEOUT_MS, beginSession, bindLimaBrowser, callVm, loadOwnerRef, resolveLocalProfile, withLimaOperation,
} from './session.mjs';

const BROWSER = fileURLToPath(new URL('../browser/browser.mjs', import.meta.url));
const BROWSER_CONFIG = fileURLToPath(new URL('../browser/.playwright/cli.config.json', import.meta.url));

const LIMA = fileURLToPath(new URL('./lima.mjs', import.meta.url));

function sshFakeSource() {
  return `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const stdin = Buffer.concat(chunks);
const argv = process.argv.slice(2);
const remote = argv[argv.length - 1] || '';
appendFileSync(process.env.LIMA_SSH_LOG, JSON.stringify({
  argv,
  hasDispatch: stdin.includes('export async function dispatch'),
  remoteStarts: remote.startsWith('node --input-type=module - '),
}) + '\\n');
if (process.env.LIMA_SSH_FAIL === '1') process.exit(255);
const quoted = remote.slice('node --input-type=module - '.length);
const json = quoted.startsWith("'") ? quoted.slice(1, -1).replaceAll("'\\\\''", "'") : quoted;
const child = spawn(process.execPath, ['--input-type=module', '-', json], { stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.end(stdin);
child.on('close', (code) => process.exit(code ?? 1));
`;
}

function bench() {
  const root = mkdtempSync(join(tmpdir(), 'lima-s2-'));
  const sshConfig = join(root, 'ssh_config');
  const stateDir = join(root, 'state');
  const lockPath = join(root, 'lima.lock');
  const sshLog = join(root, 'ssh.log');
  const sshBin = join(root, 'ssh');
  const sshScript = join(root, 'ssh.mjs');
  writeFileSync(sshConfig, 'Host lima-ubuntu24\n  HostName 127.0.0.1\n');
  writeFileSync(sshScript, sshFakeSource());
  writeFileSync(sshBin, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(sshScript)} "$@"\n`, { mode: 0o755 });
  writeFileSync(join(root, '.env'), [
    'PUBLISH_LOCAL_SSH_HOST=127.0.0.1',
    `PUBLISH_LOCAL_SSH_CONFIG=${sshConfig}`,
    'PUBLISH_LOCAL_REMOTE_BASE=/data/mls-base',
    '',
  ].join('\n'));
  const env = {
    ...process.env,
    LIMA_SSH_BIN: sshBin,
    LIMA_SSH_LOG: sshLog,
    LIMA_LOCK_PATH: lockPath,
    LIMA_STATE_DIR: stateDir,
    LIMA_PROJECT_ROOT: root,
    LIMA_SSH_FAIL: '',
  };
  const profile = { sshConfig, alias: 'lima-ubuntu24', root, stateDir };
  const options = { sshBin, lockPath, env: { LIMA_SSH_LOG: sshLog, LIMA_SSH_FAIL: '' } };
  return { root, stateDir, lockPath, sshLog, env, profile, options };
}

function runCli(args, env) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [LIMA, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function sshLines(sshLog) {
  let text = '';
  try {
    text = readFileSync(sshLog, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!text) return [];
  return text.split('\n').map((line) => JSON.parse(line));
}

test('PUBLISH_LOCAL_SSH_CONFIG expands $HOME and ${HOME}', () => {
  const home = mkdtempSync(join(tmpdir(), 'lima-home-'));
  const sshConfig = join(home, '.lima', 'ubuntu24', 'ssh.config');
  mkdirSync(join(home, '.lima', 'ubuntu24'), { recursive: true });
  writeFileSync(sshConfig, 'Host lima-ubuntu24\n  HostName 127.0.0.1\n');
  const env = { HOME: home, LIMA_STATE_DIR: join(home, 'state') };
  for (const value of ['$HOME/.lima/ubuntu24/ssh.config', '${HOME}/.lima/ubuntu24/ssh.config']) {
    const root = mkdtempSync(join(tmpdir(), 'lima-s2-home-'));
    writeFileSync(join(root, '.env'), `PUBLISH_LOCAL_SSH_CONFIG=${value}\n`);
    const profile = resolveLocalProfile(root, env);
    assert.equal(profile.sshConfig, sshConfig);
  }
});

test('deadlines stay separate and help does not open ssh', async () => {
  assert.ok(LONG_TIMEOUT_MS > CLAIM_TIMEOUT_MS);
  const box = bench();
  const help = await runCli(['help'], box.env);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /begin 102047/u);
  assert.equal(sshLines(box.sshLog).length, 0);
});

test('ssh bench receives quoted argv and stdin, and the reservation survives the CLI', async () => {
  const box = bench();
  const begun = await runCli(['begin', '102047', '--session', 'campanha-a'], box.env);
  assert.equal(begun.code, 0, begun.stderr);
  const view = JSON.parse(begun.stdout);
  assert.equal(view.session, 'campanha-a');
  assert.equal(view.phase, 'reserved');
  assert.equal(Object.hasOwn(view, 'ownerId'), false);
  const log = sshLines(box.sshLog).at(-1);
  assert.deepEqual(log.argv.slice(0, 3), ['-F', box.profile.sshConfig, 'lima-ubuntu24']);
  assert.equal(log.remoteStarts, true);
  assert.equal(log.hasDispatch, true);
  const ref = loadOwnerRef(box.profile, 'campanha-a');
  assert.equal(typeof ref.ownerId, 'string');
  assert.equal((statSync(join(box.stateDir, 'lima-ubuntu24--campanha-a.json')).mode & 0o777), 0o600);
  const status = await runCli(['status', '--session', 'campanha-a'], box.env);
  assert.equal(status.code, 0, status.stderr);
  const again = JSON.parse(status.stdout);
  assert.equal(again.held, true);
  assert.equal(again.owned, true);
  assert.equal(Object.hasOwn(again, 'ownerId'), false);
  assert.equal(readFileSync(box.lockPath, 'utf8').includes('"phase":"reserved"'), true);
});

test('remote host, wrong project and prepare do not succeed', async () => {
  const box = bench();
  const remote = await runCli(['begin', '102047', '--session', 'a', '--host', 'vm.example'], box.env);
  assert.notEqual(remote.code, 0);
  assert.match(remote.stderr, /remote host/u);
  const other = await runCli(['begin', '102056', '--session', 'a'], box.env);
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /102047/u);
  const prepared = await runCli(['prepare', '102047', '--session', 'a'], box.env);
  assert.notEqual(prepared.code, 0);
  assert.doesNotMatch(prepared.stdout, /"ready":true/u);
  assert.match(readFileSync(box.lockPath, 'utf8'), /"phase":"failed"/u);
  const reset = await runCli(['prepare', '102047', '--session', 'reset-early', '--db', 'reset'], {
    ...box.env,
    LIMA_STATE_DIR: join(box.root, 'reset-state'),
    LIMA_LOCK_PATH: join(box.root, 'reset.lock'),
    LIMA_SSH_LOG: join(box.root, 'reset-ssh.log'),
  });
  assert.notEqual(reset.code, 0);
  assert.doesNotMatch(reset.stdout, /"ready":true/u);
});

test('a second session with the same name is refused and the owner can resume', async () => {
  const box = bench();
  const first = await runCli(['begin', '102047', '--session', 'same'], box.env);
  assert.equal(first.code, 0, first.stderr);
  const other = { ...box.env, LIMA_STATE_DIR: join(box.root, 'other-state') };
  const second = await runCli(['begin', '102047', '--session', 'same'], other);
  assert.equal(second.code, 73, second.stderr);
  assert.equal(`${second.stdout}${second.stderr}`.includes('ownerId'), false);
  const resumed = await runCli(['begin', '102047', '--session', 'same'], box.env);
  assert.equal(resumed.code, 0, resumed.stderr);
  const body = JSON.parse(resumed.stdout);
  assert.equal(body.resumed, true);
  assert.equal(body.owned, true);
  assert.equal(Object.hasOwn(body, 'ownerId'), false);
});

test('end is refused while an operation is active, and ssh failure is closed', async () => {
  const box = bench();
  await beginSession(box.profile, 'op', '102047', box.options);
  let ended;
  await withLimaOperation(box.profile, { session: 'op', projectId: '102047', name: 'publish' }, async () => {
    ended = await runCli(['end', '--session', 'op'], box.env);
  }, box.options);
  assert.notEqual(ended.code, 0);
  assert.match(`${ended.stdout}${ended.stderr}`, /still-held|operation/u);
  assert.equal(readFileSync(box.lockPath, 'utf8').includes('"operations"'), true);
  const failed = await runCli(['begin', '102047', '--session', 'down'], {
    ...box.env,
    LIMA_SSH_FAIL: '1',
    LIMA_STATE_DIR: join(box.root, 'down'),
  });
  assert.notEqual(failed.code, 0);
  assert.match(failed.stderr, /ssh failed/u);
});

test('an inherited operation does not reacquire, and an uncertain error retains the lock', async () => {
  const box = bench();
  let depth = 0;
  await withLimaOperation(box.profile, { session: 'temp', projectId: '102047', name: 'seed' }, async (outer) => {
    depth += 1;
    await withLimaOperation(box.profile, { session: 'temp', projectId: '102047', name: 'seed-again' }, async (inner) => {
      assert.equal(inner.operationId, outer.operationId);
      depth += 1;
    }, box.options);
  }, box.options);
  assert.equal(depth, 2);
  assert.equal(sshLines(box.sshLog).some((line) => line.argv.at(-1).includes('"op":"acquire"')), true);
  assert.throws(() => readFileSync(box.lockPath, 'utf8'));

  const kept = bench();
  await assert.rejects(() => withLimaOperation(
    kept.profile,
    { session: 'held', projectId: '102047', name: 'reset' },
    async () => { throw new Error('disconnected'); },
    kept.options,
  ));
  assert.match(readFileSync(kept.lockPath, 'utf8'), /"phase":"failed"/u);
});

test('browser bind uses the owner file and ignores a foreign id', async () => {
  const box = bench();
  await beginSession(box.profile, 'browsers', '102047', box.options);
  const ref = loadOwnerRef(box.profile, 'browsers');
  const denied = await callVm(box.profile, { op: 'beginOperation', ownerId: 'not-the-owner', name: 'nope' }, box.options);
  assert.equal(denied.json.ok, false);
  assert.equal(Object.hasOwn(denied.json, 'ownerId'), false);
  const started = await callVm(box.profile, {
    op: 'beginOperation', ownerId: ref.ownerId, name: 'prep', phase: 'ready',
  }, box.options);
  assert.equal(started.json.ok, true);
  const finished = await callVm(box.profile, {
    op: 'finishOperation', ownerId: ref.ownerId, operationId: started.json.operationId, phase: 'ready',
  }, box.options);
  assert.equal(finished.json.phase, 'ready');
  const bound = await bindLimaBrowser(box.profile, 'browsers', 'campanha-responsavel', box.options);
  assert.equal(bound.phase, 'testing');
  assert.deepEqual(bound.browsers, ['campanha-responsavel']);
  const browserBin = join(box.root, 'browser');
  writeFileSync(browserBin, '#!/bin/sh\nprintf "%s\\n" "$@" >> "$LIMA_BROWSER_LOG"\nexit 1\n', { mode: 0o755 });
  const browserLog = join(box.root, 'browser.log');
  const open = await runCli(['end', '--session', 'browsers'], {
    ...box.env,
    LIMA_BROWSER_BIN: browserBin,
    LIMA_BROWSER_LOG: browserLog,
  });
  assert.match(readFileSync(browserLog, 'utf8'), /-s=campanha-responsavel\nclose/u);
  assert.notEqual(open.code, 0);
  assert.match(`${open.stdout}${open.stderr}`, /browsers still open/u);
  assert.match(readFileSync(box.lockPath, 'utf8'), /campanha-responsavel/u);
});

function installBenchLauncher(box) {
  const pack = join(box.root, 'pack');
  const lima = join(box.root, 'lima');
  mkdirSync(join(pack, '.playwright'), { recursive: true });
  mkdirSync(join(pack, 'node_modules', '@playwright', 'cli'), { recursive: true });
  mkdirSync(lima);
  copyFileSync(BROWSER, join(pack, 'browser.mjs'));
  copyFileSync(fileURLToPath(new URL('./session.mjs', import.meta.url)), join(lima, 'session.mjs'));
  copyFileSync(fileURLToPath(new URL('./sessionVm.mjs', import.meta.url)), join(lima, 'sessionVm.mjs'));
  copyFileSync(BROWSER_CONFIG, join(pack, '.playwright', 'cli.config.json'));
  writeFileSync(join(pack, 'node_modules', '@playwright', 'cli', 'playwright-cli.js'), `
const fs = require('fs');
const args = process.argv.slice(2);
function command() {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') continue;
    if (a.startsWith('-')) {
      if (!a.includes('=') && ['--config', '-s', '--session', '--browser', '--profile'].includes(a)) i += 1;
      continue;
    }
    return a;
  }
  return '';
}
fs.appendFileSync(process.env.RT74_LOG, JSON.stringify({ args, cmd: command() }) + '\\n');
if (command() === 'close') process.exit(process.env.RT74_CLOSE_CODE ? Number(process.env.RT74_CLOSE_CODE) : 0);
process.exit(0);
`);
  const bin = join(box.root, 'browser-launcher');
  writeFileSync(bin, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(pack, 'browser.mjs'))} "$@"\n`, { mode: 0o755 });
  chmodSync(bin, 0o755);
  return bin;
}

function runLauncher(box, args, env) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [join(box.root, 'pack', 'browser.mjs'), ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test('end releases after the launcher already unbound a closed browser', async () => {
  const box = bench();
  const launcher = installBenchLauncher(box);
  const log = join(box.root, 'pw.log');
  const env = { ...box.env, LIMA_BROWSER_BIN: launcher, RT74_LOG: log };
  await beginSession(box.profile, 'codex-ts01', '102047', box.options);
  await withLimaOperation(box.profile, {
    session: 'codex-ts01', projectId: '102047', name: 'prepare', phase: 'ready',
  }, async () => {}, box.options);
  const responsavel = await runLauncher(box, ['--lima-session', 'codex-ts01', '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  const membro = await runLauncher(box, ['--lima-session', 'codex-ts01', '-s=codex-ts01-membro', 'open', 'http://localhost:2047'], env);
  assert.equal(responsavel.code, 0, responsavel.stderr);
  assert.equal(membro.code, 0, membro.stderr);
  const closed = await runLauncher(box, ['-s=codex-ts01-responsavel', 'close'], env);
  assert.equal(closed.code, 0, closed.stderr);
  const ended = await runCli(['end', '--session', 'codex-ts01'], env);
  assert.equal(ended.code, 0, ended.stderr);
  assert.equal(existsSync(box.lockPath), false);
  const calls = readFileSync(log, 'utf8');
  assert.match(calls, /-s=codex-ts01-membro/u);
  assert.match(calls, /"cmd":"close"/u);
});

test('an unproved launcher close keeps the reservation', async () => {
  const box = bench();
  const launcher = installBenchLauncher(box);
  const log = join(box.root, 'pw.log');
  const env = { ...box.env, LIMA_BROWSER_BIN: launcher, RT74_LOG: log };
  await beginSession(box.profile, 'codex-ts01', '102047', box.options);
  await withLimaOperation(box.profile, {
    session: 'codex-ts01', projectId: '102047', name: 'prepare', phase: 'ready',
  }, async () => {}, box.options);
  const opened = await runLauncher(box, ['--lima-session', 'codex-ts01', '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  assert.equal(opened.code, 0, opened.stderr);
  const ended = await runCli(['end', '--session', 'codex-ts01'], { ...env, RT74_CLOSE_CODE: '1' });
  assert.notEqual(ended.code, 0);
  assert.match(`${ended.stdout}${ended.stderr}`, /browsers still open/u);
  const lock = JSON.parse(readFileSync(box.lockPath, 'utf8'));
  assert.equal(lock.browsers.some((item) => item.id === 'codex-ts01-responsavel'), true);
});

const RELEASE = {
  id: 'rel-1', client: '102047', versionRef: 'abc', platformCommit: 'def', libs: 'pin', monaco: 'pin',
};

function stageSource() {
  return `import { appendFileSync, existsSync } from 'node:fs';
const log = process.env.LIMA_STAGE_LOG;
const note = (line) => appendFileSync(log, line + '\\n');
export async function planLocalSources() {
  note('plan');
  return { rootSha: 'root', appSha: 'app', pin: { libs: 'pin' }, deps: [], blocked: [] };
}
export async function prepareSources(input) {
  note('sources:' + input.db);
  while (process.env.LIMA_HOLD === '1' && !existsSync(process.env.LIMA_HOLD_RELEASE || '')) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (process.env.LIMA_FAIL === 'sources') return { ok: false, code: 'dirty', uncertain: false, sent: false };
  if (process.env.LIMA_FAIL === 'sources-sent') return { ok: false, code: 'build', uncertain: true, sent: true };
  return {
    ok: true,
    evidence: {
      initialRootSha: 'root', initialAppSha: 'app', finalAppSha: 'app',
      depTrees: { '102034': 'tree' },
      release: ${JSON.stringify(RELEASE)},
    },
  };
}
export async function prepareBench(input) {
  note('bench:' + input.db);
  if (process.env.LIMA_FAIL === 'bench') throw new Error('seed failed');
  const same = input.db === 'migrate';
  return {
    ready: true,
    db: input.db,
    release: ${JSON.stringify(RELEASE)},
    migrate: same ? { executed: false, reused: true, ok: true, modules: ['tarefas'] } : { executed: false },
    reset: same ? null : { ok: true, rebuilt: true, modules: ['tarefas'] },
    modules: ['tarefas'],
    seed: {
      companyMdmId: 'co-1', organizationKey: 'org',
      personas: {
        responsavel: { cmUserId: 'cm-r', personMdmId: 'mdm-r' },
        membro: { cmUserId: 'cm-m', personMdmId: 'mdm-m' },
      },
    },
    limits: ['cm history preserved'],
  };
}
`;
}

function withStages(box, extra = {}) {
  const stages = join(box.root, 'stages.mjs');
  const stageLog = join(box.root, 'stages.log');
  writeFileSync(stages, stageSource());
  writeFileSync(stageLog, '');
  return {
    ...box.env,
    ...extra,
    LIMA_PREPARE_STAGES: stages,
    LIMA_STAGE_LOG: stageLog,
    LIMA_RECEIPT_DIR: box.stateDir,
  };
}

test('prepare reaches ready, repeats migrate, resets explicitly, and keeps the lock', async () => {
  const box = bench();
  const env = withStages(box);
  const prepared = await runCli(['prepare', '102047', '--session', 'campanha', '--db', 'migrate'], env);
  assert.equal(prepared.code, 0, prepared.stderr);
  const view = JSON.parse(prepared.stdout);
  assert.equal(view.phase, 'ready');
  assert.equal(view.ready, true);
  assert.equal(view.origin, 'localhost');
  assert.equal(view.shas.appFinal, 'app');
  assert.equal(view.company.companyMdmId, 'co-1');
  assert.equal(view.migrate.reused, true);
  assert.equal(Object.hasOwn(view, 'ownerId'), false);
  const receipt = JSON.parse(readFileSync(view.receiptFile, 'utf8'));
  assert.equal(receipt.release.versionRef, 'abc');
  assert.equal(receipt.cmIds.membro, 'cm-m');
  assert.match(readFileSync(box.lockPath, 'utf8'), /"phase":"ready"/u);
  const again = await runCli(['prepare', '102047', '--session', 'campanha', '--db', 'migrate'], env);
  assert.equal(again.code, 0, again.stderr);
  assert.equal(JSON.parse(again.stdout).company.companyMdmId, 'co-1');
  assert.match(readFileSync(stageLogOf(env), 'utf8'), /bench:migrate/u);
  const reset = await runCli(['prepare', '102047', '--session', 'campanha', '--db', 'reset'], env);
  assert.equal(reset.code, 0, reset.stderr);
  assert.equal(JSON.parse(reset.stdout).reset.rebuilt, true);
  const other = await runCli(['begin', '102047', '--session', 'outra'], {
    ...env,
    LIMA_STATE_DIR: join(box.root, 'other'),
  });
  assert.equal(other.code, 73, other.stderr);
  assert.match(readFileSync(box.lockPath, 'utf8'), /campanha/u);
});

function stageLogOf(env) {
  return env.LIMA_STAGE_LOG;
}

test('dry-run does not reserve, publish, or seed', async () => {
  const box = bench();
  const env = withStages(box);
  const dry = await runCli(['prepare', '102047', '--session', 'campanha', '--dry-run'], env);
  assert.equal(dry.code, 0, dry.stderr);
  const view = JSON.parse(dry.stdout);
  assert.equal(view.dryRun, true);
  assert.equal(view.held, false);
  assert.equal(view.db, 'migrate');
  assert.equal(view.plan.rootSha, 'root');
  assert.equal(existsSync(box.lockPath), false);
  assert.equal(readFileSync(stageLogOf(env), 'utf8').trim(), 'plan');
  assert.equal(existsSync(join(box.stateDir, 'lima-receipt-campanha.json')), false);
});

test('a failure in sources or bench is not ready and does not unlock', async () => {
  for (const fail of ['sources', 'sources-sent', 'bench']) {
    const box = bench();
    const env = withStages(box, { LIMA_FAIL: fail });
    mkdirSync(box.stateDir, { recursive: true });
    writeFileSync(join(box.stateDir, 'lima-receipt-campanha.json'), '{"ready":true,"phase":"ready"}\n');
    const prepared = await runCli(['prepare', '102047', '--session', 'campanha'], env);
    assert.notEqual(prepared.code, 0, fail);
    assert.doesNotMatch(prepared.stdout, /"ready":true/u);
    assert.equal(existsSync(join(box.stateDir, 'lima-receipt-campanha.json')), false, fail);
    const diagnosis = readFileSync(join(box.stateDir, 'lima-receipt-campanha.diagnosis.json'), 'utf8');
    assert.match(diagnosis, /"ready":false/u);
    assert.match(readFileSync(box.lockPath, 'utf8'), /"phase":"failed"/u);
    const ended = await runCli(['end', '--session', 'campanha'], env);
    assert.notEqual(ended.code, 0, fail);
  }
});

test('prepare refuses while a browser is open and two campaigns cannot prepare together', async () => {
  const box = bench();
  const env = withStages(box);
  const prepared = await runCli(['prepare', '102047', '--session', 'campanha'], env);
  assert.equal(prepared.code, 0, prepared.stderr);
  await bindLimaBrowser(box.profile, 'campanha', 'campanha-responsavel', box.options);
  const refused = await runCli(['prepare', '102047', '--session', 'campanha', '--db', 'migrate'], env);
  assert.notEqual(refused.code, 0);
  assert.match(`${refused.stdout}${refused.stderr}`, /browser/u);
  assert.match(readFileSync(box.lockPath, 'utf8'), /campanha-responsavel/u);

  const race = bench();
  const hold = join(race.root, 'go');
  const raceEnv = withStages(race, { LIMA_HOLD: '1', LIMA_HOLD_RELEASE: hold });
  const first = runCli(['prepare', '102047', '--session', 'a'], raceEnv);
  const started = Date.now();
  while (!readFileSync(stageLogOf(raceEnv), 'utf8').includes('sources:')) {
    if (Date.now() - started > 5000) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const second = await runCli(['prepare', '102047', '--session', 'b'], {
    ...raceEnv,
    LIMA_HOLD: '',
    LIMA_STATE_DIR: join(race.root, 'b-state'),
  });
  assert.equal(second.code, 73, second.stderr);
  writeFileSync(hold, 'go');
  const done = await first;
  assert.equal(done.code, 0, done.stderr);
  assert.match(readFileSync(race.lockPath, 'utf8'), /"phase":"ready"/u);
});
