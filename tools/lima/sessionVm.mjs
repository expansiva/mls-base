import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_LOCK_PATH = '/etc/collab/local-tests/lima.lock';
export const SCHEMA = 1;
export const BUSY_EXIT = 73;
export const INCOMPLETE_EXIT = 74;

const PHASES = new Set(['reserved', 'preparing', 'ready', 'testing', 'failed']);
const OWNER_ID = /^[0-9a-f]{32}$/;
const GUARD_WAIT_SEC = 3;
const RECOVERY = 'supervisor recovery requires expectedOwnerId and proof that no hook, operation, or browser is running';

const PERL_GUARD = `
use Fcntl qw(:flock);
$| = 1;
my $path = $ARGV[0];
my $timeout = $ARGV[1] + 0;
open my $fh, '>>', $path or die "open guard: $!";
my $deadline = time() + $timeout;
for (;;) {
  if (flock($fh, LOCK_EX | LOCK_NB)) {
    print "ready\\n";
    while (defined(my $line = <STDIN>)) {}
    exit 0;
  }
  if (time() >= $deadline) { exit 75; }
  select(undef, undef, undef, 0.02);
}
`;

function systemError(message, code = 'system') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function resolveLockPath(requested) {
  if (requested == null || requested === '') return DEFAULT_LOCK_PATH;
  if (typeof requested !== 'string') throw systemError('lock path refused', 'lock-path');
  const resolved = resolve(requested);
  const segments = resolved.split(sep);
  if (segments.some((segment) => segment === '.git' || segment === 'Downloads' || segment === 'release' || segment === 'dist')) {
    throw systemError('lock path refused', 'lock-path');
  }
  if (resolved === DEFAULT_LOCK_PATH) return resolved;
  const roots = new Set([resolve(tmpdir())]);
  try { roots.add(realpathSync(tmpdir())); } catch { /* tmpdir can be unlinked in a test */ }
  const allowed = [...roots].some((root) => resolved === root || resolved.startsWith(`${root}${sep}`));
  if (!allowed) throw systemError('lock path must be the lima lock or a temp file', 'lock-path');
  return resolved;
}

function ensureDir(dir) {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
  } catch (error) {
    const code = error && error.code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw systemError('supervisor must grant write on /etc/collab/local-tests (mode 0700, file 0600)');
    }
    throw error;
  }
}

function holdGuard(dir) {
  const guardPath = join(dir, 'lima.guard');
  const fd = openSync(guardPath, 'a', 0o600);
  closeSync(fd);
  chmodSync(guardPath, 0o600);
  return new Promise((resolvePromise, reject) => {
    const child = spawn('perl', ['-e', PERL_GUARD, '--', guardPath, String(GUARD_WAIT_SEC)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '';
    let ready = false;
    const fail = (error) => {
      if (ready) return;
      ready = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(systemError('flock guard deadline', 'guard-timeout'));
    }, (GUARD_WAIT_SEC + 2) * 1000);
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      if (ready || !buffer.includes('ready')) return;
      ready = true;
      clearTimeout(timer);
      resolvePromise({
        release() {
          return new Promise((done) => {
            child.once('close', () => done());
            child.stdin.end();
          });
        },
      });
    });
    child.on('error', (error) => fail(systemError(error.message, 'guard-unavailable')));
    child.on('close', (code) => {
      if (!ready) fail(systemError(`flock guard failed (${code})`, code === 75 ? 'guard-timeout' : 'guard-failed'));
    });
  });
}

async function withGuard(dir, fn) {
  const held = await holdGuard(dir);
  try {
    return await fn();
  } finally {
    await held.release();
  }
}

function readRaw(lockPath) {
  if (!existsSync(lockPath)) return { missing: true };
  try {
    return { text: readFileSync(lockPath, 'utf8') };
  } catch (error) {
    const wrapped = systemError(error.message, 'system');
    throw wrapped;
  }
}

function parseState(text) {
  try {
    const state = JSON.parse(text);
    if (!stateComplete(state)) return { incomplete: true, ownerId: ownerHint(state) };
    return { state };
  } catch {
    return { incomplete: true, ownerId: null };
  }
}

function ownerHint(value) {
  if (!value || typeof value !== 'object') return null;
  return typeof value.ownerId === 'string' ? value.ownerId : null;
}

function stateComplete(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (state.schema !== SCHEMA) return false;
  if (typeof state.ownerId !== 'string' || !OWNER_ID.test(state.ownerId)) return false;
  if (!nonEmpty(state.session) || !nonEmpty(state.projectId) || !nonEmpty(state.origin) || !nonEmpty(state.startedAt)) return false;
  if (!PHASES.has(state.phase)) return false;
  if (!state.release || typeof state.release !== 'object' || !('expected' in state.release) || !('observed' in state.release)) return false;
  if (!Array.isArray(state.operations) || !Array.isArray(state.browsers)) return false;
  return true;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function incompleteResult() {
  return { ok: false, code: 'incomplete', exitCode: INCOMPLETE_EXIT, recovery: RECOVERY };
}

function busyResult(state) {
  return {
    ok: false,
    code: 'busy',
    exitCode: BUSY_EXIT,
    session: state.session,
    projectId: state.projectId,
    phase: state.phase,
    startedAt: state.startedAt,
    operations: Array.isArray(state.operations) ? state.operations : [],
    browsers: Array.isArray(state.browsers) ? state.browsers : [],
  };
}

function writeLock(lockPath, state) {
  const dir = dirname(lockPath);
  const tmp = join(dir, `.${randomBytes(6).toString('hex')}.lima.lock.tmp`);
  try {
    writeFileSync(tmp, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    renameSync(tmp, lockPath);
    chmodSync(lockPath, 0o600);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

function load(lockPath) {
  const raw = readRaw(lockPath);
  if (raw.missing) return { missing: true };
  return parseState(raw.text);
}

function requireOwner(loaded, ownerId) {
  if (loaded.incomplete) return incompleteResult();
  if (loaded.missing) return { ok: false, code: 'free', exitCode: 1 };
  if (!nonEmpty(ownerId) || loaded.state.ownerId !== ownerId) return busyResult(loaded.state);
  return null;
}

function proofAccepts(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return false;
  return proof.hook === false && proof.operation === false && proof.browser === false;
}

function apply(lockPath, command) {
  const op = command.op;
  if (op === 'status') return status(lockPath, command);
  if (op === 'acquire') return acquire(lockPath, command);
  if (op === 'beginOperation') return beginOperation(lockPath, command);
  if (op === 'finishOperation') return finishOperation(lockPath, command);
  if (op === 'bindBrowser') return bindBrowser(lockPath, command);
  if (op === 'unbindBrowser') return unbindBrowser(lockPath, command);
  if (op === 'end') return end(lockPath, command);
  if (op === 'recover') return recover(lockPath, command);
  return { ok: false, code: 'unknown-op', exitCode: 2 };
}

function status(lockPath, command) {
  const loaded = load(lockPath);
  if (loaded.missing) return { ok: true, held: false };
  if (loaded.incomplete) return incompleteResult();
  const { state } = loaded;
  const view = {
    ok: true,
    held: true,
    ...visibleState(state),
  };
  if (typeof command.ownerId === 'string') view.owned = state.ownerId === command.ownerId;
  return view;
}

function acquire(lockPath, command) {
  if (!nonEmpty(command.session) || !nonEmpty(command.projectId) || !nonEmpty(command.origin)) {
    return { ok: false, code: 'bad-command', exitCode: 2 };
  }
  const loaded = load(lockPath);
  if (loaded.incomplete) return incompleteResult();
  if (!loaded.missing) return busyResult(loaded.state);
  const state = {
    schema: SCHEMA,
    ownerId: randomBytes(16).toString('hex'),
    session: command.session,
    projectId: command.projectId,
    origin: command.origin,
    startedAt: new Date().toISOString(),
    phase: 'reserved',
    release: { expected: null, observed: null },
    operations: [],
    browsers: [],
  };
  writeLock(lockPath, state);
  return { ok: true, acquired: true, ownerId: state.ownerId, ...visibleState(state) };
}

function visibleState(state) {
  return {
    schema: state.schema,
    session: state.session,
    projectId: state.projectId,
    origin: state.origin,
    startedAt: state.startedAt,
    phase: state.phase,
    release: state.release,
    operations: state.operations,
    browsers: state.browsers,
  };
}

function nextPhase(command, current) {
  if (command.phase == null) return current;
  if (!PHASES.has(command.phase)) return null;
  return command.phase;
}

function beginOperation(lockPath, command) {
  const loaded = load(lockPath);
  const denied = requireOwner(loaded, command.ownerId);
  if (denied) return denied;
  const state = loaded.state;
  if (state.phase === 'failed') return { ok: false, code: 'failed', exitCode: 1, phase: state.phase };
  if (state.operations.length > 0) return { ok: false, code: 'operation-active', exitCode: 1 };
  if (state.browsers.length > 0) return { ok: false, code: 'browser-registered', exitCode: 1 };
  if (!nonEmpty(command.name)) return { ok: false, code: 'bad-command', exitCode: 2 };
  const phase = nextPhase(command, state.phase);
  if (!phase) return { ok: false, code: 'bad-phase', exitCode: 2 };
  const operation = { id: randomBytes(8).toString('hex'), name: command.name, startedAt: new Date().toISOString() };
  state.phase = phase;
  state.operations = [operation];
  writeLock(lockPath, state);
  return { ok: true, operationId: operation.id, phase: state.phase };
}

function finishOperation(lockPath, command) {
  const loaded = load(lockPath);
  const denied = requireOwner(loaded, command.ownerId);
  if (denied) return denied;
  const state = loaded.state;
  const operation = state.operations.find((item) => item.id === command.operationId);
  if (!operation) return { ok: false, code: 'unknown-operation', exitCode: 1 };
  if (command.uncertain === true) {
    operation.uncertain = true;
    state.phase = 'failed';
    writeLock(lockPath, state);
    return { ok: true, retained: true, phase: state.phase, operations: state.operations };
  }
  const phase = nextPhase(command, state.phase);
  if (!phase) return { ok: false, code: 'bad-phase', exitCode: 2 };
  state.phase = phase;
  state.operations = state.operations.filter((item) => item.id !== operation.id);
  writeLock(lockPath, state);
  return { ok: true, phase: state.phase, operations: state.operations };
}

function bindBrowser(lockPath, command) {
  const loaded = load(lockPath);
  const denied = requireOwner(loaded, command.ownerId);
  if (denied) return denied;
  const state = loaded.state;
  if (state.phase !== 'ready' && state.phase !== 'testing') {
    return { ok: false, code: 'phase', exitCode: 1, phase: state.phase };
  }
  if (state.operations.length > 0) return { ok: false, code: 'operation-active', exitCode: 1 };
  if (!nonEmpty(command.browserId)) return { ok: false, code: 'bad-command', exitCode: 2 };
  if (state.browsers.some((item) => item.id === command.browserId)) {
    return { ok: false, code: 'browser-active', exitCode: 1 };
  }
  const phase = nextPhase(command, state.phase);
  if (!phase || (phase !== 'ready' && phase !== 'testing')) return { ok: false, code: 'bad-phase', exitCode: 2 };
  state.phase = phase;
  state.browsers = [...state.browsers, { id: command.browserId, boundAt: new Date().toISOString() }];
  writeLock(lockPath, state);
  return { ok: true, phase: state.phase, browsers: state.browsers.map((item) => item.id) };
}

function unbindBrowser(lockPath, command) {
  const loaded = load(lockPath);
  const denied = requireOwner(loaded, command.ownerId);
  if (denied) return denied;
  const state = loaded.state;
  const browser = state.browsers.find((item) => item.id === command.browserId);
  if (!browser) return { ok: false, code: 'unknown-browser', exitCode: 1 };
  if (command.uncertain === true) {
    browser.uncertain = true;
    state.phase = 'failed';
    writeLock(lockPath, state);
    return { ok: true, retained: true, phase: state.phase, browsers: state.browsers.map((item) => item.id) };
  }
  state.browsers = state.browsers.filter((item) => item.id !== browser.id);
  writeLock(lockPath, state);
  return { ok: true, phase: state.phase, browsers: state.browsers.map((item) => item.id) };
}

function end(lockPath, command) {
  const loaded = load(lockPath);
  const denied = requireOwner(loaded, command.ownerId);
  if (denied) return denied;
  const state = loaded.state;
  if (state.operations.length > 0 || state.browsers.length > 0) {
    return {
      ok: false,
      code: 'still-held',
      exitCode: 1,
      operations: state.operations.map((item) => item.id),
      browsers: state.browsers.map((item) => item.id),
    };
  }
  rmSync(lockPath, { force: true });
  return { ok: true, ended: true };
}

function recover(lockPath, command) {
  if (!proofAccepts(command.proof) || typeof command.expectedOwnerId !== 'string' || !OWNER_ID.test(command.expectedOwnerId)) {
    return { ok: false, code: 'recovery-refused', exitCode: 1, recovery: RECOVERY };
  }
  const raw = readRaw(lockPath);
  if (raw.missing) return { ok: true, recovered: false, held: false };
  const parsed = parseState(raw.text);
  const recorded = parsed.incomplete ? parsed.ownerId : parsed.state.ownerId;
  if (recorded != null && recorded !== command.expectedOwnerId) return busyResult(parsed.state || {
    ownerId: recorded,
    session: null,
    phase: null,
    startedAt: null,
  });
  rmSync(lockPath, { force: true });
  return { ok: true, recovered: true, held: false };
}

export async function dispatch(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return { ok: false, code: 'bad-command', exitCode: 2 };
  }
  if (Object.prototype.hasOwnProperty.call(command, 'force')) {
    return { ok: false, code: 'force-not-offered', exitCode: 1 };
  }
  const lockPath = resolveLockPath(command.lockPath);
  const dir = dirname(lockPath);
  ensureDir(dir);
  return withGuard(dir, () => apply(lockPath, command));
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    process.stderr.write('sessionVm: JSON command on stdin\n');
    process.exit(2);
  }
  let command;
  try {
    command = JSON.parse(text);
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'bad-json', exitCode: 2 })}\n`);
    process.exit(2);
  }
  try {
    const result = await dispatch(command);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.exitCode ?? (result.ok ? 0 : 1));
  } catch (error) {
    const code = error && error.code ? error.code : 'system';
    process.stdout.write(`${JSON.stringify({ ok: false, code, message: error.message })}\n`);
    process.exit(1);
  }
}

if (invokedDirectly()) {
  main();
}
