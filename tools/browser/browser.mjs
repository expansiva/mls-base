#!/usr/bin/env node
// Launcher fino do Playwright CLI (Firefox). Não instala nada sozinho.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(ROOT, '.playwright', 'cli.config.json');
const CLI_BIN = path.join(ROOT, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
const PW_BIN = path.join(ROOT, 'node_modules', 'playwright', 'cli.js');

const OP_MS = numEnv('BROWSER_TOOL_OP_MS', 60_000);
const SETUP_MS = numEnv('BROWSER_TOOL_SETUP_MS', 600_000);
const CLEANUP_MS = numEnv('BROWSER_TOOL_CLEANUP_MS', 5_000);
const IDLE_MS = 300_000;
const HOST_PLATFORM = process.env.BROWSER_TOOL_PLATFORM || platform();

const GLOBAL = new Set(['help', 'version', 'list']);
const VALUE_FLAGS = new Set([
  '-s', '--session', '--config', '--browser', '--profile', '--idle-timeout',
  '--filename', '--device', '--extension', '--cdp', '--channel',
]);

const children = new Set();
let interrupted = false;
let cleaning = false;

process.on('SIGINT', () => interrupt('SIGINT'));
process.on('SIGTERM', () => interrupt('SIGTERM'));

const raw = process.argv.slice(2);
const args = raw[0] === '--' ? raw.slice(1) : raw;

try {
  const code = await main(args);
  process.exit(code);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

async function main(argv) {
  if (argv.length === 0 || wantsHelp(argv)) return helpAndForward();
  const command = firstCommand(argv);
  if (command === 'setup') return setup();
  const refusal = refusalReason(argv, command);
  if (refusal) {
    console.error(refusal);
    return 2;
  }
  if (!existsSync(CLI_BIN)) {
    console.error(missingDepMessage());
    return 1;
  }
  const session = sessionName(argv);
  if (!GLOBAL.has(command) && command !== 'version' && !session) {
    console.error('Name the session: -s=<name> (e.g. -s=codex-rt74-<id> or -s=claude-rt74-<id>).');
    return 2;
  }
  const forwarded = withDefaults(argv, command);
  const result = await runChild(process.execPath, [CLI_BIN, ...forwarded], {
    cwd: ROOT,
    env: cliEnv(),
    timeoutMs: OP_MS,
  });
  if (result.timed || interrupted) {
    await closeNamedSession(session);
    console.error(result.timed
      ? `Operation timed out after ${OP_MS} ms on session ${session || '(unnamed)'}.`
      : 'Operation interrupted.');
    return 1;
  }
  return result.code;
}

function wantsHelp(argv) {
  if (argv.some((a) => a === '--help' || a === '-h')) return true;
  return firstCommand(argv) === 'help';
}

async function helpAndForward() {
  console.log(localHelp());
  if (!existsSync(CLI_BIN)) return 0;
  const result = await runChild(process.execPath, [CLI_BIN, '--help'], {
    cwd: ROOT,
    env: cliEnv(),
    timeoutMs: OP_MS,
  });
  return result.code === 0 && !result.timed && !interrupted ? 0 : 1;
}

function localHelp() {
  const self = path.join(ROOT, 'browser.mjs');
  return [
    'tools/browser — Playwright CLI with Firefox, on the Mac.',
    '',
    'setup (once, darwin only; not run by a normal command):',
    `  node ${self} setup`,
    '',
    'Named session, reused for the round (do not mint a new id per command):',
    `  node ${self} -s=codex-rt74-<id> open http://localhost:2047`,
    `  node ${self} -s=codex-rt74-<id> find Sign in`,
    `  node ${self} -s=codex-rt74-<id> snapshot --depth=4`,
    `  node ${self} -s=claude-rt74-<id> click e1`,
    `  node ${self} -s=codex-rt74-<id> close`,
    '',
    'No session required: help, version, list.',
    'Engine: Firefox. Refuses Chromium, Chrome, Edge, WebKit, attach, and CDP.',
    '--headed is allowed. A profile only via --profile pointing at a dedicated folder.',
    'Headless session idle: 5 min. Deadlines: 60 s per operation, 10 min for setup.',
    'Detailed CLI help (after setup): playwright-cli --help',
  ].join('\n');
}

async function setup() {
  if (HOST_PLATFORM !== 'darwin') {
    console.error(`setup installs only on the Mac (darwin). This system is ${HOST_PLATFORM}; nothing was installed.`);
    return 1;
  }
  const deadline = Date.now() + SETUP_MS;
  const install = await runChild('pnpm', [
    '--dir', ROOT, 'install', '--ignore-workspace', '--ignore-scripts',
  ], { cwd: ROOT, env: process.env, deadline });
  if (install.code !== 0 || install.timed || interrupted) {
    console.error(install.timed ? 'Setup timed out during pnpm install.' : 'pnpm install of the tools/browser package failed.');
    return 1;
  }
  if (!existsSync(PW_BIN)) {
    console.error(`Playwright did not appear at ${PW_BIN}. Run again: node ${path.join(ROOT, 'browser.mjs')} setup`);
    return 1;
  }
  const firefox = await runChild(process.execPath, [PW_BIN, 'install', 'firefox'], {
    cwd: ROOT,
    env: cliEnv(),
    deadline,
  });
  if (firefox.code !== 0 || firefox.timed || interrupted) {
    console.error(firefox.timed ? 'Setup timed out during install firefox.' : 'install firefox failed.');
    return 1;
  }
  return 0;
}

function refusalReason(argv, command) {
  if (command === 'attach') return 'attach refused: this launcher does not connect to Chrome, Edge, or CDP.';
  if (command === 'close-all' || command === 'kill-all') {
    return `${command} refused: close only the named session with -s=<name> close.`;
  }
  if (command === 'install') return missingDepMessage();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cdp' || a.startsWith('--cdp=') || a === '--extension' || a.startsWith('--extension=')) {
      return `${a} refused: no attach/CDP/Chrome.`;
    }
    if (a === '--channel' || a.startsWith('--channel=')) return `${a} refused: the engine is Playwright's Firefox.`;
    const browser = flagValue(argv, i, '--browser');
    if (browser.present && browser.value.toLowerCase() !== 'firefox') {
      return `browser ${browser.value} refused: use Firefox.`;
    }
    const profile = flagValue(argv, i, '--profile');
    if (profile.present && isHumanProfile(profile.value)) {
      return `profile refused (${profile.value}): use a dedicated folder, not a human profile.`;
    }
  }
  const configArg = configPath(argv);
  if (configArg) {
    const why = configRejection(configArg);
    if (why) return why;
  } else if (!existsSync(CONFIG)) {
    return `Firefox config missing: ${CONFIG}`;
  }
  return '';
}

function flagValue(argv, index, name) {
  const a = argv[index];
  if (a === name) return { present: true, value: argv[index + 1] || '' };
  if (a.startsWith(`${name}=`)) return { present: true, value: a.slice(name.length + 1) };
  return { present: false, value: '' };
}

function configPath(argv) {
  for (let i = 0; i < argv.length; i++) {
    const hit = flagValue(argv, i, '--config');
    if (hit.present) return hit.value;
  }
  return '';
}

function configRejection(file) {
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return `Could not read config ${file}.`;
  }
  const browser = json.browser || {};
  if (browser.browserName && browser.browserName !== 'firefox') {
    return `Config ${file} switches the engine to ${browser.browserName}. Use Firefox.`;
  }
  if (browser.cdpEndpoint || browser.remoteEndpoint || browser.cdpHeaders) {
    return `Config ${file} uses CDP/remote. Refused.`;
  }
  const launch = browser.launchOptions || {};
  if (launch.channel || launch.executablePath) {
    return `Config ${file} sets channel/executablePath. Firefox must be Playwright's.`;
  }
  if (browser.userDataDir && isHumanProfile(browser.userDataDir)) {
    return `Config ${file} uses a human profile. Refused.`;
  }
  return '';
}

function isHumanProfile(p) {
  const resolved = path.resolve(p);
  const home = process.env.HOME || '';
  const roots = [
    path.join(home, 'Library', 'Application Support', 'Firefox'),
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
    path.join(home, 'Library', 'Application Support', 'Microsoft Edge'),
    path.join(home, '.mozilla'),
    path.join(home, '.config', 'google-chrome'),
    '/Applications/Firefox.app',
    '/Applications/Google Chrome.app',
  ];
  return roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

function withDefaults(argv, command) {
  const out = configPath(argv) ? [...argv] : ['--config', CONFIG, ...argv];
  const headed = argv.includes('--headed') || argv.some((a) => a === '--headless=false' || a === '--headless=0');
  const hasIdle = argv.some((a) => a === '--idle-timeout' || a.startsWith('--idle-timeout='));
  if (command === 'open' && !headed && !hasIdle) out.push(`--idle-timeout=${IDLE_MS}`);
  return out;
}

function firstCommand(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;
    if (a.startsWith('-')) {
      const name = a.includes('=') ? a.slice(0, a.indexOf('=')) : a;
      if (!a.includes('=') && VALUE_FLAGS.has(name)) i += 1;
      continue;
    }
    return a;
  }
  return '';
}

function sessionName(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('-s=')) return a.slice(3);
    if (a.startsWith('--session=')) return a.slice('--session='.length);
    if ((a === '-s' || a === '--session') && argv[i + 1] && !argv[i + 1].startsWith('-')) return argv[i + 1];
  }
  return '';
}

async function closeNamedSession(session) {
  if (!session || !existsSync(CLI_BIN)) return;
  cleaning = true;
  await runChild(process.execPath, [CLI_BIN, `--config`, CONFIG, `-s=${session}`, 'close'], {
    cwd: ROOT,
    env: cliEnv(),
    timeoutMs: CLEANUP_MS,
  });
}

function missingDepMessage() {
  return `Missing dependency in ${ROOT}. On the Mac: node ${path.join(ROOT, 'browser.mjs')} setup`;
}

function cliEnv() {
  return { ...process.env, NO_UPDATE_NOTIFIER: '1' };
}

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function interrupt() {
  interrupted = true;
  for (const child of children) child.kill('SIGTERM');
  if (cleaning) process.exit(1);
}

function runChild(cmd, cmdArgs, { cwd, env, timeoutMs, deadline }) {
  const budget = timeoutMs ?? Math.max(1, deadline - Date.now());
  return new Promise((resolve) => {
    let timed = false;
    let settled = false;
    const child = spawn(cmd, cmdArgs, { cwd, env, stdio: 'inherit' });
    children.add(child);
    const timer = setTimeout(() => {
      timed = true;
      child.kill('SIGTERM');
    }, budget);
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      children.delete(child);
      resolve({ code: code ?? 1, timed });
    };
    child.on('error', (err) => {
      console.error(err.message);
      finish(1);
    });
    child.on('exit', (code) => finish(code));
  });
}
