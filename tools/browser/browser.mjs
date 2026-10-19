#!/usr/bin/env node
// Launcher fino do Playwright CLI (Chromium). Não instala nada sozinho.
// Must run on Mac (lima) AND Windows (multipass). Read mls-base/skills/crossPlatform.md first.
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindLimaBrowser, loadOwnerRef, resolveLocalProfile, statusSession, unbindLimaBrowser } from '../lima/session.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(ROOT, '.playwright', 'cli.config.json');
const CLI_BIN = path.join(ROOT, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
const PW_BIN = path.join(ROOT, 'node_modules', 'playwright', 'cli.js');

const OP_MS = numEnv('BROWSER_TOOL_OP_MS', 60_000);
const SETUP_MS = numEnv('BROWSER_TOOL_SETUP_MS', 600_000);
const CLEANUP_MS = numEnv('BROWSER_TOOL_CLEANUP_MS', 5_000);
const IDLE_MS = 300_000;
const HOST_PLATFORM = process.env.BROWSER_TOOL_PLATFORM || platform();
// The tester's machine. Linux is the VM side, where nothing is installed.
const SETUP_PLATFORMS = new Set(['darwin', 'win32']);

const GLOBAL = new Set(['help', 'version', 'list']);
const VALUE_FLAGS = new Set([
  '-s', '--session', '--config', '--browser', '--profile', '--idle-timeout',
  '--filename', '--device', '--extension', '--cdp', '--channel', '--lima-session',
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
  const stripped = stripLimaSession(argv);
  if (stripped.argv.length === 0 || wantsHelp(stripped.argv)) return helpAndForward();
  const command = firstCommand(stripped.argv);
  if (command === 'setup') return setup();
  const refusal = refusalReason(stripped.argv, command);
  if (refusal) {
    console.error(refusal);
    return 2;
  }
  if (!existsSync(CLI_BIN)) {
    console.error(missingDepMessage());
    return 1;
  }
  const session = sessionName(stripped.argv);
  if (!GLOBAL.has(command) && !session) {
    console.error('Name the session: -s=<name> (e.g. -s=codex-rt74-<id> or -s=claude-rt74-<id>).');
    return 2;
  }
  const gate = await gateBench(command, session, stripped.campaign);
  if (!gate.ok) {
    console.error(gate.message);
    return gate.code;
  }
  const forwarded = withDefaults(stripped.argv, command);
  const result = await runChild(process.execPath, [CLI_BIN, ...forwarded], {
    cwd: ROOT,
    env: cliEnv(),
    timeoutMs: OP_MS,
  });
  if (result.timed || interrupted) {
    const proved = await closeNamedSession(session);
    await settleBrowser(gate, session, !proved);
    console.error(result.timed
      ? `Operation timed out after ${OP_MS} ms on session ${session || '(unnamed)'}.`
      : 'Operation interrupted.');
    return 1;
  }
  if (command === 'close' && gate.linked) await settleBrowser(gate, session, result.code !== 0);
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
    'tools/browser — Playwright CLI with Chromium, on the Mac or Windows.',
    '',
    'setup (once, darwin or win32; not run by a normal command):',
    `  node ${self} setup`,
    '',
    'Named session, reused for the round (do not mint a new id per command):',
    'The lima campaign is one reservation; each jar is its own -s name.',
    `  node ${self} --lima-session <campaign> -s=<campaign>-responsavel open http://localhost:2047`,
    `  node ${self} -s=codex-rt74-<id> open http://localhost:2047`,
    `  node ${self} -s=codex-rt74-<id> find Sign in`,
    `  node ${self} -s=codex-rt74-<id> snapshot --depth=4`,
    `  node ${self} -s=claude-rt74-<id> click e1`,
    `  node ${self} -s=codex-rt74-<id> close`,
    '',
    'No session required: help, version, list.',
    'Engine: Playwright Chromium. Refuses Firefox, Chrome, Edge, WebKit, attach, and CDP.',
    '--headed is allowed. A profile only via --profile pointing at a dedicated folder.',
    'Headless session idle: 5 min. Deadlines: 60 s per operation, 10 min for setup.',
    'Detailed CLI help (after setup): playwright-cli --help',
  ].join('\n');
}

async function setup() {
  if (!SETUP_PLATFORMS.has(HOST_PLATFORM)) {
    console.error(`setup installs only on the Mac (darwin) or Windows (win32). This system is ${HOST_PLATFORM}; nothing was installed.`);
    return 1;
  }
  const deadline = Date.now() + SETUP_MS;
  // On Windows pnpm is a .cmd shim, which spawn only runs through the shell (args joined, so ROOT is quoted).
  const viaShell = process.platform === 'win32';
  const install = await runChild('pnpm', [
    '--dir', viaShell ? `"${ROOT}"` : ROOT, 'install', '--ignore-workspace', '--ignore-scripts',
  ], { cwd: ROOT, env: process.env, deadline, shell: viaShell });
  if (install.code !== 0 || install.timed || interrupted) {
    console.error(install.timed ? 'Setup timed out during pnpm install.' : 'pnpm install of the tools/browser package failed.');
    return 1;
  }
  if (!existsSync(PW_BIN)) {
    console.error(`Playwright did not appear at ${PW_BIN}. Run again: node ${path.join(ROOT, 'browser.mjs')} setup`);
    return 1;
  }
  const chromium = await runChild(process.execPath, [PW_BIN, 'install', 'chromium'], {
    cwd: ROOT,
    env: cliEnv(),
    deadline,
  });
  if (chromium.code !== 0 || chromium.timed || interrupted) {
    console.error(chromium.timed ? 'Setup timed out during install chromium.' : 'install chromium failed.');
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
    if (a === '--channel' || a.startsWith('--channel=')) return `${a} refused: the engine is Playwright's Chromium.`;
    const browser = flagValue(argv, i, '--browser');
    if (browser.present && browser.value.toLowerCase() !== 'chromium') {
      return `browser ${browser.value} refused: use Chromium.`;
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
    return `Chromium config missing: ${CONFIG}`;
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
  if (browser.browserName && browser.browserName !== 'chromium') {
    return `Config ${file} switches the engine to ${browser.browserName}. Use Chromium.`;
  }
  if (browser.cdpEndpoint || browser.remoteEndpoint || browser.cdpHeaders) {
    return `Config ${file} uses CDP/remote. Refused.`;
  }
  const launch = browser.launchOptions || {};
  if (launch.channel || launch.executablePath) {
    return `Config ${file} sets channel/executablePath. Chromium must be Playwright's.`;
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
    path.join(home, 'Library', 'Application Support', 'Chromium'),
    path.join(home, 'Library', 'Application Support', 'Microsoft Edge'),
    path.join(home, '.mozilla'),
    path.join(home, '.config', 'google-chrome'),
    path.join(home, '.config', 'chromium'),
    '/Applications/Firefox.app',
    '/Applications/Google Chrome.app',
    '/Applications/Chromium.app',
  ];
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  if (local) {
    roots.push(
      path.join(local, 'Google', 'Chrome', 'User Data'),
      path.join(local, 'Chromium', 'User Data'),
      path.join(local, 'Microsoft', 'Edge', 'User Data'),
    );
  }
  if (roaming) roots.push(path.join(roaming, 'Mozilla', 'Firefox'));
  return roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

function withDefaults(argv, command) {
  const out = [...argv];
  // CLI 0.1.22 accepts --config only on open. cwd is ROOT, so the default file applies to the rest.
  if (command === 'open' && !configPath(argv)) out.unshift('--config', CONFIG);
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

function stripLimaSession(argv) {
  const out = [];
  let campaign = '';
  for (let i = 0; i < argv.length; i++) {
    const flag = flagValue(argv, i, '--lima-session');
    if (flag.present) {
      campaign = flag.value;
      if (argv[i] === '--lima-session') i += 1;
      continue;
    }
    out.push(argv[i]);
  }
  return { argv: out, campaign };
}

function browserIds(status) {
  return (status.browsers || []).map((item) => (typeof item === 'string' ? item : item.id));
}

function assocPath(profile, browserId) {
  return path.join(profile.stateDir, `browser--${browserId}.json`);
}

function loadAssoc(profile, browserId) {
  const file = assocPath(profile, browserId);
  if (!existsSync(file)) return null;
  try {
    const assoc = JSON.parse(readFileSync(file, 'utf8'));
    if (!assoc || assoc.browserId !== browserId || typeof assoc.session !== 'string') return null;
    return assoc;
  } catch {
    return null;
  }
}

function saveAssoc(profile, browserId, session) {
  mkdirSync(profile.stateDir, { recursive: true, mode: 0o700 });
  chmodSync(profile.stateDir, 0o700);
  const file = assocPath(profile, browserId);
  writeFileSync(file, `${JSON.stringify({ browserId, session, vm: profile.alias })}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}

async function gateBench(command, session, campaign) {
  if (GLOBAL.has(command)) return { ok: true, linked: false };
  let profile;
  try {
    profile = resolveLocalProfile();
  } catch (error) {
    return { ok: false, code: 1, message: error instanceof Error ? error.message : String(error) };
  }
  const assoc = loadAssoc(profile, session);
  if (command === 'close' && !assoc) return { ok: true, linked: false, profile };
  if (!assoc) {
    if (command !== 'open' || !campaign) {
      return { ok: false, code: 2, message: 'Bench browser requires --lima-session <campaign> on the first open. Close a known jar instead of reusing it.' };
    }
    const ref = loadOwnerRef(profile, campaign);
    if (!ref) return { ok: false, code: 2, message: 'no local owner reference for this campaign' };
    let status;
    try {
      status = await statusSession(profile, campaign);
    } catch (error) {
      return { ok: false, code: 1, message: error instanceof Error ? error.message : String(error) };
    }
    if (!status.owned || (status.phase !== 'ready' && status.phase !== 'testing')) {
      return { ok: false, code: status.exitCode || 73, message: `bench reservation is not ready (${status.phase || status.code || 'unavailable'})` };
    }
    if ((status.operations || []).length > 0) {
      return { ok: false, code: 1, message: 'bench operation is active; browser open is refused' };
    }
    try {
      await bindLimaBrowser(profile, campaign, session);
    } catch (error) {
      return { ok: false, code: error.exitCode || 1, message: error instanceof Error ? error.message : String(error) };
    }
    saveAssoc(profile, session, campaign);
    return { ok: true, linked: true, profile, campaign };
  }
  if (campaign && campaign !== assoc.session) {
    return { ok: false, code: 2, message: 'this jar is already associated with another campaign' };
  }
  let status;
  try {
    status = await statusSession(profile, assoc.session);
  } catch (error) {
    return { ok: false, code: 1, message: error instanceof Error ? error.message : String(error) };
  }
  if (!status.owned) return { ok: false, code: 73, message: 'bench reservation is not owned by this campaign' };
  if (status.phase === 'failed') return { ok: false, code: 1, message: 'bench reservation is failed' };
  if ((status.operations || []).length > 0 && command !== 'close') {
    return { ok: false, code: 1, message: 'bench operation is active; browser action is refused' };
  }
  const bound = browserIds(status).includes(session);
  if (!bound && command !== 'close') {
    return { ok: false, code: 2, message: 'jar is not registered on the reservation; close it instead of taking it over' };
  }
  return { ok: true, linked: bound, profile, campaign: assoc.session };
}

async function settleBrowser(gate, session, uncertain) {
  if (!gate.linked || !gate.profile || !session) return;
  try {
    const result = await unbindLimaBrowser(gate.profile, gate.campaign, session, { uncertain });
    if (!uncertain && result.ok) rmSync(assocPath(gate.profile, session), { force: true });
  } catch {
    /* an unproved close keeps the association and the reservation */
  }
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
  if (!session || !existsSync(CLI_BIN)) return false;
  cleaning = true;
  const result = await runChild(process.execPath, [CLI_BIN, `-s=${session}`, 'close'], {
    cwd: ROOT,
    env: cliEnv(),
    timeoutMs: CLEANUP_MS,
  });
  return result.code === 0 && !result.timed && !interrupted;
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

function runChild(cmd, cmdArgs, { cwd, env, timeoutMs, deadline, shell = false }) {
  const budget = timeoutMs ?? Math.max(1, deadline - Date.now());
  return new Promise((resolve) => {
    let timed = false;
    let settled = false;
    const child = spawn(cmd, cmdArgs, { cwd, env, stdio: 'inherit', shell });
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
