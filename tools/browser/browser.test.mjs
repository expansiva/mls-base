import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER_SRC = path.join(HERE, 'browser.mjs');

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'rt74-browser-'));
  copyFileSync(LAUNCHER_SRC, path.join(dir, 'browser.mjs'));
  mkdirSync(path.join(dir, '.playwright'));
  copyFileSync(path.join(HERE, '.playwright', 'cli.config.json'), path.join(dir, '.playwright', 'cli.config.json'));
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
if (command() === 'close' || args.includes('--help')) process.exit(0);
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

test('cwd externo não muda a raiz do pacote nem o Chromium do config', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const away = mkdtempSync(path.join(tmpdir(), 'rt74-away-'));
  const result = await run(root, ['-s=codex-rt74-1', 'open', 'http://localhost:2047'], { RT74_LOG: log }, away);
  assert.equal(result.code, 0);
  const [call] = readLog(log);
  assert.equal(call.cwd, realpathSync(root));
  assert.equal(call.args[0], '--config');
  assert.equal(realpathSync(call.args[1]), realpathSync(path.join(root, '.playwright', 'cli.config.json')));
  const config = JSON.parse(readFileSync(call.args[1], 'utf8'));
  assert.equal(config.browser.browserName, 'chromium');
  assert.equal(call.args.at(-1), '--idle-timeout=300000');
  assert.equal(call.args.includes('--browser=chromium'), false);
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
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log };
  const first = await run(root, ['-s=claude-rt74-7', 'goto', 'http://localhost:2047'], env);
  const second = await run(root, ['--', '-s=claude-rt74-7', 'fill', 'e1', 'ola mundo', '--', 'keep'], env);
  assert.equal(first.code, 0);
  assert.equal(second.code, 0);
  const lines = readLog(log);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].args.includes('-s=claude-rt74-7'), true);
  assert.equal(lines[1].args.includes('-s=claude-rt74-7'), true);
  assert.equal(lines[1].args.includes('ola mundo'), true);
  assert.equal(lines[1].args.includes('--'), true);
  assert.equal(lines[1].args.includes('keep'), true);
  assert.equal(lines[0].cmd, 'goto');
  assert.equal(lines[1].cmd, 'fill');
  rmSync(root, { recursive: true, force: true });
});

test('filho recebe NO_UPDATE_NOTIFIER e o pai não; erro do CLI passa intacto', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  delete process.env.NO_UPDATE_NOTIFIER;
  const ok = await run(root, ['list'], { RT74_LOG: log });
  assert.equal(ok.code, 0);
  assert.equal(readLog(log)[0].update, '1');
  assert.equal(process.env.NO_UPDATE_NOTIFIER, undefined);
  const bad = await run(root, ['-s=codex-rt74-1', 'click', 'e1'], { RT74_LOG: log, RT74_CODE: '4' });
  assert.equal(bad.code, 4);
  assert.equal(readLog(log).length, 2);
  assert.equal(readLog(log).some((line) => line.cmd === 'close'), false);
  rmSync(root, { recursive: true, force: true });
});

test('headed não impõe idle; open headless impõe cinco minutos', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  await run(root, ['-s=codex-rt74-1', 'open', '--headed'], { RT74_LOG: log });
  await run(root, ['-s=codex-rt74-1', 'open', 'http://localhost:2047'], { RT74_LOG: log });
  const lines = readLog(log);
  assert.equal(lines[0].args.includes('--idle-timeout=300000'), false);
  assert.equal(lines[1].args.includes('--idle-timeout=300000'), true);
  rmSync(root, { recursive: true, force: true });
});

test('eval, find e click não recebem --config; o close de limpeza também não', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const env = { RT74_LOG: log };
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

  const timed = await run(root, ['-s=codex-rt74-9', 'open', 'http://localhost:2047'], {
    ...env,
    RT74_SLEEP: '20000',
    BROWSER_TOOL_OP_MS: '300',
    BROWSER_TOOL_CLEANUP_MS: '2000',
  });
  assert.equal(timed.code, 1);
  const lines = readLog(log);
  const opened = lines.find((line) => line.cmd === 'open');
  const closed = lines.find((line) => line.cmd === 'close');
  assert.equal(opened.args[0], '--config');
  assert.equal(closed.args.includes('--config'), false);
  assert.equal(closed.args.includes('-s=codex-rt74-9'), true);
  rmSync(root, { recursive: true, force: true });
});

test('timeout encerra só a sessão nomeada e não vira sucesso', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const started = Date.now();
  const result = await run(root, ['-s=codex-rt74-9', 'open', 'http://localhost:2047'], {
    RT74_LOG: log,
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
  rmSync(root, { recursive: true, force: true });
});

test('interrupção também fecha só a sessão nomeada', async () => {
  const root = scratch();
  installFakeCli(root);
  const log = path.join(root, 'log');
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'browser.mjs'), '-s=claude-rt74-3', 'press', 'Enter'], {
      cwd: tmpdir(),
      env: { ...process.env, RT74_LOG: log, RT74_SLEEP: '20000', BROWSER_TOOL_OP_MS: '15000' },
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
  const log = path.join(mkdtempSync(path.join(tmpdir(), 'rt74-script-')), 'log');
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['run', 'browser', '--', '-s=codex-rt74-script', 'fill', 'e1', 'ola mundo'], {
        cwd: repo,
        env: { ...process.env, RT74_LOG: log },
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
    const [call] = readLog(log);
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
