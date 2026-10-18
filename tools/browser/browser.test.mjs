import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beginSession, resolveLocalProfile, withLimaOperation } from '../lima/session.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER_SRC = path.join(HERE, 'browser.mjs');
const LIMA_SRC = path.resolve(HERE, '../lima');

function scratch() {
  const parent = mkdtempSync(path.join(tmpdir(), 'rt74-browser-'));
  const dir = path.join(parent, 'pack');
  mkdirSync(path.join(dir, '.playwright'), { recursive: true });
  copyFileSync(LAUNCHER_SRC, path.join(dir, 'browser.mjs'));
  copyFileSync(path.join(HERE, '.playwright', 'cli.config.json'), path.join(dir, '.playwright', 'cli.config.json'));
  const lima = path.join(parent, 'lima');
  mkdirSync(lima);
  copyFileSync(path.join(LIMA_SRC, 'session.mjs'), path.join(lima, 'session.mjs'));
  copyFileSync(path.join(LIMA_SRC, 'sessionVm.mjs'), path.join(lima, 'sessionVm.mjs'));
  return dir;
}

function writeExe(file, body) {
  writeFileSync(file, body);
  chmodSync(file, 0o755);
}

function installFakeCli(root) {
  const bin = path.join(root, 'node_modules', '@playwright', 'cli');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'playwright-cli.js'), `
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
fs.appendFileSync(process.env.RT74_LOG, JSON.stringify({
  args, cwd: process.cwd(), update: process.env.NO_UPDATE_NOTIFIER, cmd: command(),
}) + '\\n');
if (command() === 'close' || args.includes('--help')) process.exit(process.env.RT74_CLOSE_CODE ? Number(process.env.RT74_CLOSE_CODE) : 0);
if (process.env.RT74_CODE) process.exit(Number(process.env.RT74_CODE));
if (process.env.RT74_SLEEP) {
  setTimeout(() => process.exit(0), Number(process.env.RT74_SLEEP));
} else process.exit(0);
`);
}

function pnpmSentinel(dir) {
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const sentinel = path.join(dir, 'pnpm-called');
  writeExe(path.join(bin, 'pnpm'), `#!/bin/sh\ntouch ${JSON.stringify(sentinel)}\nexit 0\n`);
  return { bin, sentinel };
}

function run(root, args, env = {}, cwd = tmpdir()) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'browser.mjs'), ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

function readLog(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function writeFakeSsh(file) {
  writeExe(file, `#!/usr/bin/env node
const { spawn } = require('child_process');
const remote = process.argv[process.argv.length - 1];
const match = /^node --input-type=module - ([\\s\\S]+)$/.exec(remote);
if (!match) {
  process.stderr.write('bad remote\\n');
  process.exit(1);
}
let payload = match[1];
if (payload.startsWith("'") && payload.endsWith("'")) payload = payload.slice(1, -1);
const child = spawn(process.execPath, ['--input-type=module', '-', payload], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code == null ? 1 : code));
`);
}

async function makeBench(campaign = 'codex-ts01') {
  const dir = mkdtempSync(path.join(tmpdir(), 'rt89-bench-'));
  const stateDir = path.join(dir, 'state');
  mkdirSync(stateDir, { mode: 0o700 });
  const lockPath = path.join(dir, 'lima.lock');
  const sshBin = path.join(dir, 'ssh');
  writeFakeSsh(sshBin);
  const project = path.join(dir, 'proj');
  mkdirSync(project);
  const sshConfig = path.join(dir, 'ssh.config');
  writeFileSync(sshConfig, 'Host lima-ubuntu24\n  HostName 127.0.0.1\n');
  writeFileSync(path.join(project, '.env'), `PUBLISH_LOCAL_SSH_CONFIG=${sshConfig}\n`);
  const env = {
    LIMA_PROJECT_ROOT: project,
    LIMA_STATE_DIR: stateDir,
    LIMA_SSH_BIN: sshBin,
    LIMA_LOCK_PATH: lockPath,
  };
  const profile = resolveLocalProfile(project, { ...process.env, ...env });
  const options = { sshBin, lockPath };
  await beginSession(profile, campaign, '102047', options);
  await withLimaOperation(profile, {
    session: campaign, projectId: '102047', name: 'prepare', phase: 'ready',
  }, async () => {}, options);
  return { dir, env, campaign, lockPath };
}

function readLock(lockPath) {
  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

test('cwd externo não muda a raiz do pacote nem o Chromium do config', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench();
  const log = path.join(root, 'log');
  const away = mkdtempSync(path.join(tmpdir(), 'rt74-away-'));
  const result = await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-1', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...bench.env }, away);
  assert.equal(result.code, 0);
  const [call] = readLog(log);
  assert.equal(call.cwd, realpathSync(root));
  assert.equal(call.args[0], '--config');
  assert.equal(realpathSync(call.args[1]), realpathSync(path.join(root, '.playwright', 'cli.config.json')));
  const config = JSON.parse(readFileSync(call.args[1], 'utf8'));
  assert.equal(config.browser.browserName, 'chromium');
  assert.equal(call.args.at(-1), '--idle-timeout=300000');
  assert.equal(call.args.includes('--browser=chromium'), false);
  assert.equal(call.args.some((arg) => String(arg).includes('lima-session')), false);
  rmSync(root, { recursive: true, force: true });
  rmSync(away, { recursive: true, force: true });
});

test('setup no Mac é explícito, isolado e só pede o Chromium', async () => {
  const root = scratch();
  const meta = mkdtempSync(path.join(tmpdir(), 'rt74-pnpm-'));
  const pnpmLog = path.join(meta, 'pnpm.jsonl');
  const pwLog = path.join(meta, 'pw.jsonl');
  writeExe(path.join(meta, 'pnpm'), `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
fs.appendFileSync(process.env.RT74_PNPM_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const dir = process.argv[process.argv.indexOf('--dir') + 1];
const bin = path.join(dir, 'node_modules', 'playwright');
fs.mkdirSync(bin, { recursive: true });
fs.writeFileSync(path.join(bin, 'cli.js'), \`
const fs = require('fs');
fs.appendFileSync(process.env.RT74_PW_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), update: process.env.NO_UPDATE_NOTIFIER }) + '\\\\n');
process.exit(0);
\`);
`);
  const away = mkdtempSync(path.join(tmpdir(), 'rt74-away-'));
  const result = await run(root, ['setup'], {
    PATH: `${meta}${path.delimiter}${process.env.PATH}`,
    RT74_PNPM_LOG: pnpmLog,
    RT74_PW_LOG: pwLog,
  }, away);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(pnpmLog, 'utf8')), [
    '--dir', realpathSync(root), 'install', '--ignore-workspace', '--ignore-scripts',
  ]);
  const pw = JSON.parse(readFileSync(pwLog, 'utf8').trim());
  assert.deepEqual(pw.args, ['install', 'chromium']);
  assert.equal(pw.cwd, realpathSync(root));
  assert.equal(JSON.stringify(pw.args).includes('firefox'), false);
  assert.equal(JSON.stringify(pw.args).includes('webkit'), false);
  rmSync(root, { recursive: true, force: true });
  rmSync(meta, { recursive: true, force: true });
  rmSync(away, { recursive: true, force: true });
});

test('setup fora do Mac não instala', async () => {
  const root = scratch();
  const guard = pnpmSentinel(mkdtempSync(path.join(tmpdir(), 'rt74-nopnpm-')));
  const result = await run(root, ['setup'], {
    BROWSER_TOOL_PLATFORM: 'linux',
    PATH: `${guard.bin}${path.delimiter}${process.env.PATH}`,
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /installs only on the Mac/);
  assert.equal(existsSync(guard.sentinel), false);
  rmSync(root, { recursive: true, force: true });
});

test('dependência ausente devolve o setup e não chama o pnpm', async () => {
  const root = scratch();
  const guard = pnpmSentinel(mkdtempSync(path.join(tmpdir(), 'rt74-nopnpm-')));
  const result = await run(root, ['-s=codex-rt74-1', 'open', 'http://localhost:2047'], {
    PATH: `${guard.bin}${path.delimiter}${process.env.PATH}`,
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Missing dependency/);
  assert.equal(existsSync(guard.sentinel), false);
  rmSync(root, { recursive: true, force: true });
});

test('recusa outro motor, attach, CDP, close-all e perfil humano sem subir o CLI', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const webkit = path.join(root, 'webkit.json');
  writeFileSync(webkit, JSON.stringify({ browser: { browserName: 'webkit' } }));
  const home = path.join(root, 'home');
  const human = path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles', 'x');
  const chromeProfile = path.join(home, 'Library', 'Application Support', 'Chromium', 'Default');
  const cases = [
    ['-s=codex-rt74-1', 'open', '--browser=chrome'],
    ['-s=codex-rt74-1', 'attach', '--cdp=http://127.0.0.1:9'],
    ['-s=codex-rt74-1', 'open', '--cdp=http://127.0.0.1:9'],
    ['-s=codex-rt74-1', 'open', '--config', webkit],
    ['close-all'],
    ['kill-all'],
    ['-s=codex-rt74-1', 'open', '--profile', human],
    ['-s=codex-rt74-1', 'open', '--profile', chromeProfile],
  ];
  for (const args of cases) {
    const result = await run(root, args, { RT74_LOG: log, HOME: home });
    assert.notEqual(result.code, 0, args.join(' '));
    assert.equal(existsSync(log), false, args.join(' '));
  }
  rmSync(root, { recursive: true, force: true });
});

test('a mesma sessão segue entre comandos, com argumento que tem espaço', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench('codex-ts01');
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  assert.equal(opened.code, 0, opened.stderr);
  const first = await run(root, ['-s=codex-ts01-responsavel', 'goto', 'http://localhost:2047'], env);
  const second = await run(root, ['--', '-s=codex-ts01-responsavel', 'fill', 'e1', 'ola mundo', '--', 'keep'], env);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  const lines = readLog(log);
  assert.equal(lines.length, 3);
  assert.equal(lines[1].args.includes('-s=codex-ts01-responsavel'), true);
  assert.equal(lines[2].args.includes('-s=codex-ts01-responsavel'), true);
  assert.equal(lines[2].args.includes('ola mundo'), true);
  assert.equal(lines[2].args.includes('--'), true);
  assert.equal(lines[2].args.includes('keep'), true);
  assert.equal(lines[1].cmd, 'goto');
  assert.equal(lines[2].cmd, 'fill');
  assert.equal(lines.some((line) => line.args.some((arg) => String(arg).includes('lima-session'))), false);
  rmSync(root, { recursive: true, force: true });
});

test('filho recebe NO_UPDATE_NOTIFIER e o pai não; erro do CLI passa intacto', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const bench = await makeBench();
  delete process.env.NO_UPDATE_NOTIFIER;
  const ok = await run(root, ['list'], { RT74_LOG: log, ...bench.env });
  assert.equal(ok.code, 0);
  assert.equal(readLog(log)[0].update, '1');
  assert.equal(process.env.NO_UPDATE_NOTIFIER, undefined);
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-1', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...bench.env });
  assert.equal(opened.code, 0, opened.stderr);
  const bad = await run(root, ['-s=codex-rt74-1', 'click', 'e1'], { RT74_LOG: log, RT74_CODE: '4', ...bench.env });
  assert.equal(bad.code, 4);
  assert.equal(readLog(log).length, 3);
  assert.equal(readLog(log).some((line) => line.cmd === 'close'), false);
  rmSync(root, { recursive: true, force: true });
});

test('headed não impõe idle; open headless impõe cinco minutos', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench();
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-1', 'open', '--headed'], env);
  await run(root, ['-s=codex-rt74-1', 'open', 'http://localhost:2047'], env);
  const lines = readLog(log);
  assert.equal(lines[0].args.includes('--idle-timeout=300000'), false);
  assert.equal(lines[1].args.includes('--idle-timeout=300000'), true);
  rmSync(root, { recursive: true, force: true });
});

test('eval, find e click não recebem --config; o close de limpeza também não', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench();
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-1', 'open', 'http://localhost:2047'], env);
  assert.equal(opened.code, 0, opened.stderr);
  writeFileSync(log, '');
  for (const args of [
    ['-s=codex-rt74-1', 'eval', '1'],
    ['-s=codex-rt74-1', 'find', 'Save'],
    ['-s=codex-rt74-1', 'click', 'e1'],
  ]) {
    const result = await run(root, args, env);
    assert.equal(result.code, 0, args.join(' '));
  }
  const calls = readLog(log);
  assert.deepEqual(calls.map((line) => line.cmd), ['eval', 'find', 'click']);
  for (const call of calls) assert.equal(call.args.includes('--config'), false, call.cmd);

  const timed = await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-9', 'open', 'http://localhost:2047'], {
    ...env,
    RT74_SLEEP: '20000',
    BROWSER_TOOL_OP_MS: '300',
    BROWSER_TOOL_CLEANUP_MS: '2000',
  });
  assert.equal(timed.code, 1);
  const lines = readLog(log);
  const openedCall = lines.find((line) => line.cmd === 'open');
  const closed = lines.find((line) => line.cmd === 'close');
  assert.equal(openedCall.args[0], '--config');
  assert.equal(closed.args.includes('--config'), false);
  assert.equal(closed.args.includes('-s=codex-rt74-9'), true);
  rmSync(root, { recursive: true, force: true });
});

test('timeout encerra só a sessão nomeada e não vira sucesso', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench();
  const log = path.join(root, 'log');
  const started = Date.now();
  const result = await run(root, ['--lima-session', bench.campaign, '-s=codex-rt74-9', 'open', 'http://localhost:2047'], {
    RT74_LOG: log,
    ...bench.env,
    RT74_SLEEP: '20000',
    BROWSER_TOOL_OP_MS: '300',
    BROWSER_TOOL_CLEANUP_MS: '2000',
  });
  assert.equal(result.code, 1);
  assert.ok(Date.now() - started < 10_000);
  const lines = readLog(log);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].cmd, 'close');
  assert.equal(lines[1].args.includes('-s=codex-rt74-9'), true);
  assert.equal(JSON.stringify(lines).includes('close-all'), false);
  assert.equal(JSON.stringify(lines).includes('kill-all'), false);
  assert.equal(existsSync(bench.lockPath), true);
  rmSync(root, { recursive: true, force: true });
});

test('interrupção também fecha só a sessão nomeada', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench();
  const log = path.join(root, 'log');
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=claude-rt74-3', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...bench.env });
  assert.equal(opened.code, 0, opened.stderr);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'browser.mjs'), '-s=claude-rt74-3', 'press', 'Enter'], {
      cwd: tmpdir(),
      env: { ...process.env, ...bench.env, RT74_LOG: log, RT74_SLEEP: '20000', BROWSER_TOOL_OP_MS: '15000' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stderr }));
    setTimeout(() => child.kill('SIGINT'), 200);
  });
  assert.equal(result.code, 1);
  const lines = readLog(log);
  assert.equal(lines.at(-1).cmd, 'close');
  assert.equal(lines.at(-1).args.includes('-s=claude-rt74-3'), true);
  assert.equal(JSON.stringify(lines).includes('close-all'), false);
  rmSync(root, { recursive: true, force: true });
});

test('--help local explica setup e sessão e encaminha o resto ao CLI', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const result = await run(root, ['--help'], { RT74_LOG: log });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Named session/);
  assert.match(result.stdout, /-s=codex-rt74-<id>/);
  assert.match(result.stdout, /-s=claude-rt74-<id>/);
  assert.equal(readLog(log)[0].args.includes('--help'), true);
  rmSync(root, { recursive: true, force: true });
});

test('scripts da raiz encaminham os argumentos e o id da sessão', async () => {
  const repo = path.resolve(HERE, '..', '..');
  const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.browser, 'node tools/browser/browser.mjs');
  assert.equal(pkg.scripts['browser:setup'], 'node tools/browser/browser.mjs setup');
  for (const name of ['install:dev', 'postinstall', 'postInstall', 'build', 'publishGit']) {
    assert.equal(String(pkg.scripts[name]).includes('tools/browser'), false);
  }
  const bin = path.join(HERE, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
  const nm = path.join(HERE, 'node_modules');
  const existed = existsSync(bin);
  const nmExisted = existsSync(nm);
  const previous = existed ? readFileSync(bin) : null;
  installFakeCli(HERE);
  const bench = await makeBench();
  const log = path.join(mkdtempSync(path.join(tmpdir(), 'rt74-script-')), 'log');
  try {
    const opened = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(HERE, 'browser.mjs'), '--lima-session', bench.campaign, '-s=codex-rt74-script', 'open', 'http://localhost:2047'], {
        cwd: repo,
        env: { ...process.env, ...bench.env, RT74_LOG: log },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, stderr }));
    });
    assert.equal(opened.code, 0, opened.stderr);
    const result = await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['run', 'browser', '--', '-s=codex-rt74-script', 'fill', 'e1', 'ola mundo'], {
        cwd: repo,
        env: { ...process.env, ...bench.env, RT74_LOG: log },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr);
    const call = readLog(log).at(-1);
    assert.equal(call.args.includes('-s=codex-rt74-script'), true);
    assert.equal(call.args.includes('ola mundo'), true);
    assert.equal(call.cmd, 'fill');
    assert.equal(call.cwd, realpathSync(HERE));
  } finally {
    if (existed) writeFileSync(bin, previous);
    else if (!nmExisted) rmSync(nm, { recursive: true, force: true });
    else rmSync(bin, { force: true });
  }
});

test('ação de browser sem sessão não chega ao CLI', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const result = await run(root, ['click', 'e1'], { RT74_LOG: log });
  assert.equal(result.code, 2);
  assert.equal(existsSync(log), false);
  const listed = await run(root, ['list'], { RT74_LOG: log });
  assert.equal(listed.code, 0);
  assert.equal(readLog(log)[0].cmd, 'list');
  rmSync(root, { recursive: true, force: true });
});

test('sem posse ou com operação ativa o CLI falso não recebe a ação', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench('codex-ts01');
  const log = path.join(root, 'log');
  const denied = await run(root, ['--lima-session', 'outra', '-s=outra-responsavel', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...bench.env });
  assert.notEqual(denied.code, 0);
  assert.equal(existsSync(log), false);
  const profile = resolveLocalProfile(bench.env.LIMA_PROJECT_ROOT, { ...process.env, ...bench.env });
  await withLimaOperation(profile, {
    session: bench.campaign, projectId: '102047', name: 'publish', phase: 'ready',
  }, async () => {
    const during = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...bench.env });
    assert.notEqual(during.code, 0, during.stderr);
    assert.equal(existsSync(log), false);
  }, { sshBin: bench.env.LIMA_SSH_BIN, lockPath: bench.env.LIMA_LOCK_PATH });
  rmSync(root, { recursive: true, force: true });
});

test('duas jars do mesmo dono funcionam e outra campanha não abre', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench('codex-ts01');
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  const responsavel = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  const membro = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-membro', 'open', 'http://localhost:2047'], env);
  assert.equal(responsavel.code, 0, responsavel.stderr);
  assert.equal(membro.code, 0, membro.stderr);
  const lock = readLock(bench.lockPath);
  assert.deepEqual(lock.browsers.map((item) => item.id).sort(), ['codex-ts01-membro', 'codex-ts01-responsavel']);
  const other = await makeBench('claude-ts02');
  const blocked = await run(root, ['--lima-session', other.campaign, '-s=claude-ts02-responsavel', 'open', 'http://localhost:2047'], { RT74_LOG: log, ...other.env, LIMA_LOCK_PATH: bench.env.LIMA_LOCK_PATH });
  assert.notEqual(blocked.code, 0);
  assert.equal(readLog(log).every((line) => line.args.includes('-s=claude-ts02-responsavel') === false), true);
  rmSync(root, { recursive: true, force: true });
});

test('run-code passa pelo mesmo guard e a associação persiste entre processos', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench('codex-ts01');
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  const bare = await run(root, ['-s=codex-ts01-responsavel', 'run-code', 'document.title'], env);
  assert.notEqual(bare.code, 0);
  assert.equal(existsSync(log), false);
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  assert.equal(opened.code, 0, opened.stderr);
  const coded = await run(root, ['-s=codex-ts01-responsavel', 'run-code', 'document.title'], env);
  assert.equal(coded.code, 0, coded.stderr);
  assert.equal(readLog(log).at(-1).cmd, 'run-code');
  rmSync(root, { recursive: true, force: true });
});

test('close não libera a campanha e fechamento incerto retém a reserva', async () => {
  const root = scratch();
  installFakeCli(root);
  const bench = await makeBench('codex-ts01');
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log, ...bench.env };
  const opened = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-responsavel', 'open', 'http://localhost:2047'], env);
  assert.equal(opened.code, 0, opened.stderr);
  const closed = await run(root, ['-s=codex-ts01-responsavel', 'close'], env);
  assert.equal(closed.code, 0, closed.stderr);
  const after = readLock(bench.lockPath);
  assert.equal(after.session, 'codex-ts01');
  assert.equal(after.browsers.length, 0);
  assert.equal(after.phase === 'ready' || after.phase === 'testing', true);
  const again = await run(root, ['--lima-session', bench.campaign, '-s=codex-ts01-membro', 'open', 'http://localhost:2047'], env);
  assert.equal(again.code, 0, again.stderr);
  const uncertain = await run(root, ['-s=codex-ts01-membro', 'close'], { ...env, RT74_CLOSE_CODE: '1' });
  assert.notEqual(uncertain.code, 0);
  const retained = readLock(bench.lockPath);
  assert.equal(retained.phase, 'failed');
  assert.equal(retained.browsers.some((item) => item.id === 'codex-ts01-membro'), true);
  assert.equal(existsSync(bench.lockPath), true);
  const stale = await run(root, ['-s=jar-antiga', 'close'], env);
  assert.equal(stale.code, 0, stale.stderr);
  assert.equal(readLock(bench.lockPath).phase, 'failed');
  assert.equal(readLog(log).some((line) => line.cmd === 'close' && line.args.includes('-s=jar-antiga')), true);
  rmSync(root, { recursive: true, force: true });
});
