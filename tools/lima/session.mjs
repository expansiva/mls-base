// Must run on Mac (lima) AND Windows (multipass). Read mls-base/skills/crossPlatform.md first.
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSY_EXIT } from './sessionVm.mjs';

export const SSH_ALIAS = 'lima-ubuntu24';
export const SUPPORTED_PROJECT = '102047';
export const CLAIM_TIMEOUT_MS = 15_000;
export const LONG_TIMEOUT_MS = 30 * 60 * 1000;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SESSION_VM = fileURLToPath(new URL('./sessionVm.mjs', import.meta.url));

export function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function assertProjectId(projectId) {
  if (projectId !== SUPPORTED_PROJECT) {
    throw limaError(`project ${projectId || '(missing)'} is not supported; this bench is 102047 only`, 'project');
  }
  return projectId;
}

function limaError(message, code, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function parseEnvFile(text) {
  const conf = {};
  for (const raw of String(text).split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    conf[match[1]] = value;
  }
  return conf;
}

export function configHasAlias(text, alias = SSH_ALIAS) {
  for (const raw of String(text).split(/\r?\n/u)) {
    const match = /^[ \t]*Host[ \t]+(.+)$/u.exec(raw);
    if (!match) continue;
    const tokens = match[1].split(/\s+/u).filter(Boolean);
    if (tokens.includes(alias)) return true;
  }
  return false;
}

function expandConfValue(value, env) {
  const home = env.HOME || homedir();
  return String(value).replaceAll('${HOME}', home).replaceAll('$HOME', home);
}

export function resolveLocalProfile(root = process.env.LIMA_PROJECT_ROOT || ROOT, env = process.env) {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) throw limaError(`local profile missing: ${envPath}`, 'profile');
  const conf = parseEnvFile(readFileSync(envPath, 'utf8'));
  const sshConfig = conf.PUBLISH_LOCAL_SSH_CONFIG ? expandConfValue(conf.PUBLISH_LOCAL_SSH_CONFIG, env) : conf.PUBLISH_LOCAL_SSH_CONFIG;
  if (!sshConfig) throw limaError('local profile has no PUBLISH_LOCAL_SSH_CONFIG', 'profile');
  if (!existsSync(sshConfig)) throw limaError(`lima ssh config not found: ${sshConfig}`, 'profile');
  const text = readFileSync(sshConfig, 'utf8');
  if (!configHasAlias(text)) {
    throw limaError(`ssh config must define Host ${SSH_ALIAS}`, 'profile');
  }
  return { sshConfig, alias: SSH_ALIAS, root, stateDir: env.LIMA_STATE_DIR || join(tmpdir(), 'collab-lima') };
}

export function refuseRemoteArgv(argv) {
  for (const arg of argv) {
    if (arg === '--host' || arg.startsWith('--host=') || arg === '--ssh-host' || arg.startsWith('--ssh-host=')) {
      throw limaError('remote host is not accepted; the bench uses the lima-ubuntu24 alias', 'remote');
    }
  }
}

export function statePath(profile, session) {
  return join(profile.stateDir, `${profile.alias}--${session}.json`);
}

export function loadOwnerRef(profile, session) {
  const path = statePath(profile, session);
  if (!existsSync(path)) return null;
  const ref = JSON.parse(readFileSync(path, 'utf8'));
  if (!ref || ref.session !== session || ref.vm !== profile.alias || typeof ref.ownerId !== 'string') return null;
  return ref;
}

export function saveOwnerRef(profile, ref) {
  mkdirSync(profile.stateDir, { recursive: true, mode: 0o700 });
  chmodSync(profile.stateDir, 0o700);
  const path = statePath(profile, ref.session);
  writeFileSync(path, `${JSON.stringify(ref)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

function vmSource() {
  const source = readFileSync(SESSION_VM, 'utf8');
  return `${source}\nconst __limaCmd = JSON.parse(process.argv[process.argv.length - 1]);\nconst __limaResult = await dispatch(__limaCmd);\nprocess.stdout.write(JSON.stringify(__limaResult) + '\\n');\nprocess.exit(__limaResult.exitCode ?? (__limaResult.ok ? 0 : 1));\n`;
}

/**
 * [command, args] to spawn. A LIMA_SSH_BIN / LIMA_BROWSER_BIN that is a node script (the
 * test fakes) runs under this node: Windows spawns only real executables, never a shebang file.
 */
export function spawnArgsFor(bin, args) {
  if (/\.[cm]?js$/iu.test(bin)) return [process.execPath, [bin, ...args]];
  return [bin, args];
}

function runProcess(spawnFn, cmd, args, { input, timeoutMs, env }) {
  return new Promise((resolvePromise) => {
    const [bin, binArgs] = spawnArgsFor(cmd, args);
    const child = spawnFn(bin, binArgs, { stdio: ['pipe', 'pipe', 'pipe'], env });
    const out = [];
    const err = [];
    let timed = false;
    const timer = setTimeout(() => {
      timed = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ code: 1, timed, stdout: '', stderr: error.message, spawnError: true });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({
        code: code ?? 1,
        timed,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

export function publicView(result) {
  if (!result || typeof result !== 'object') return result;
  const view = { ...result };
  delete view.ownerId;
  return view;
}

export async function callVm(profile, command, options = {}) {
  const spawnFn = options.spawn || spawn;
  const sshBin = options.sshBin || process.env.LIMA_SSH_BIN || 'ssh';
  const timeoutMs = options.timeoutMs ?? CLAIM_TIMEOUT_MS;
  const payload = { ...command, origin: command.origin || 'tools/lima' };
  const lockPath = options.lockPath || process.env.LIMA_LOCK_PATH;
  if (lockPath) payload.lockPath = lockPath;
  const remote = `node --input-type=module - ${shQuote(JSON.stringify(payload))}`;
  const result = await runProcess(spawnFn, sshBin, ['-F', profile.sshConfig, profile.alias, remote], {
    input: vmSource(),
    timeoutMs,
    env: { ...process.env, ...options.env },
  });
  if (result.timed || result.spawnError || result.code == null) {
    throw limaError(result.stderr || 'ssh failed', 'ssh', { uncertain: true });
  }
  const line = result.stdout.trim().split(/\n/u).filter(Boolean).pop() || '';
  let json = null;
  try {
    json = line ? JSON.parse(line) : null;
  } catch {
    json = null;
  }
  if (result.code !== 0 && !json) {
    throw limaError(result.stderr.trim() || 'ssh failed', 'ssh', { uncertain: result.code === 255 });
  }
  return { exitCode: result.code, json, stderr: result.stderr };
}

async function vmOp(profile, command, options) {
  const reply = await callVm(profile, command, options);
  return reply.json || { ok: false, code: 'ssh', exitCode: reply.exitCode };
}

export async function beginSession(profile, session, projectId, options = {}) {
  assertProjectId(projectId);
  const existing = loadOwnerRef(profile, session);
  if (existing) {
    const status = await vmOp(profile, { op: 'status', ownerId: existing.ownerId }, options);
    if (status.owned) return { resumed: true, ref: existing, view: publicView(status) };
  }
  const acquired = await vmOp(profile, { op: 'acquire', session, projectId }, options);
  if (!acquired.ok) {
    const error = limaError(`session busy: ${acquired.session || session}`, 'busy', { result: publicView(acquired) });
    error.exitCode = acquired.exitCode || BUSY_EXIT;
    throw error;
  }
  const ref = { vm: profile.alias, session, projectId, ownerId: acquired.ownerId, operationId: null };
  saveOwnerRef(profile, ref);
  return { resumed: false, ref, view: publicView(acquired) };
}

export async function statusSession(profile, session, options = {}) {
  const ref = session ? loadOwnerRef(profile, session) : null;
  const command = { op: 'status' };
  if (ref) command.ownerId = ref.ownerId;
  const status = await vmOp(profile, command, options);
  return publicView(status);
}

export function browserCloseArgs(browserId) {
  return ['-s=' + browserId, 'close'];
}

export async function closeOwnedBrowser(browserId, options = {}) {
  const spawnFn = options.spawn || spawn;
  const bin = options.browserBin || process.env.LIMA_BROWSER_BIN || process.execPath;
  const args = options.browserBin || process.env.LIMA_BROWSER_BIN
    ? browserCloseArgs(browserId)
    : [join(ROOT, 'tools/browser/browser.mjs'), ...browserCloseArgs(browserId)];
  const result = await runProcess(spawnFn, bin, args, {
    timeoutMs: options.timeoutMs ?? CLAIM_TIMEOUT_MS,
    env: { ...process.env, ...options.env },
  });
  return result.code === 0 && !result.timed && !result.spawnError;
}

export async function endSession(profile, session, options = {}) {
  const ref = loadOwnerRef(profile, session);
  if (!ref) throw limaError('no local owner reference for this session', 'owner');
  const status = await vmOp(profile, { op: 'status', ownerId: ref.ownerId }, options);
  if (!status.ok && status.code === 'incomplete') {
    const error = limaError('lock metadata is incomplete', 'incomplete', { result: publicView(status) });
    error.exitCode = status.exitCode;
    throw error;
  }
  if (!status.owned) {
    const error = limaError('session is not owned here', 'busy', { result: publicView(status) });
    error.exitCode = BUSY_EXIT;
    throw error;
  }
  const operations = status.operations || [];
  if (operations.length > 0) {
    const error = limaError('end refused while an operation is active', 'still-held', {
      result: publicView({ ok: false, code: 'still-held', operations, browsers: status.browsers || [] }),
    });
    error.exitCode = 1;
    throw error;
  }
  const browsers = (status.browsers || []).map((item) => (typeof item === 'string' ? item : item.id));
  const remaining = [];
  for (const browserId of browsers) {
    const closed = await closeOwnedBrowser(browserId, options);
    if (!closed) remaining.push(browserId);
  }
  if (remaining.length > 0) {
    const error = limaError(`browsers still open: ${remaining.join(', ')}`, 'browsers-open', {
      result: { ok: false, code: 'browsers-open', browsers: remaining },
    });
    error.exitCode = 1;
    throw error;
  }
  const after = await vmOp(profile, { op: 'status', ownerId: ref.ownerId }, options);
  if (!after.ok || !after.owned) {
    throw limaError('browser close was not registered', 'unbind', { uncertain: true, result: publicView(after) });
  }
  const still = (after.browsers || []).map((item) => (typeof item === 'string' ? item : item.id));
  for (const browserId of still) {
    const unbound = await vmOp(profile, { op: 'unbindBrowser', ownerId: ref.ownerId, browserId }, options);
    if (!unbound.ok && unbound.code !== 'unknown-browser') {
      throw limaError('browser close was not registered', 'unbind', { uncertain: true, result: publicView(unbound) });
    }
  }
  const ended = await vmOp(profile, { op: 'end', ownerId: ref.ownerId }, options);
  if (!ended.ok) {
    const error = limaError('end refused', ended.code || 'end', { result: publicView(ended), uncertain: ended.code !== 'still-held' });
    error.exitCode = ended.exitCode || 1;
    throw error;
  }
  return publicView(ended);
}

export async function withLimaOperation(profile, { session, projectId, name, phase }, fn, options = {}) {
  assertProjectId(projectId);
  let ref = loadOwnerRef(profile, session);
  let temporary = false;
  if (ref) {
    const status = await vmOp(profile, { op: 'status', ownerId: ref.ownerId }, options);
    if (!status.owned) throw limaError('owner file does not match the reservation', 'owner');
    if (status.phase === 'failed') throw limaError('reservation is failed', 'failed');
  } else {
    const begun = await beginSession(profile, session, projectId, options);
    ref = begun.ref;
    temporary = true;
  }
  let nested = Boolean(ref.operationId);
  if (!nested) {
    const started = await vmOp(profile, {
      op: 'beginOperation', ownerId: ref.ownerId, name, phase: phase || null,
    }, options);
    if (!started.ok) {
      const error = limaError(started.code || 'beginOperation refused', started.code || 'operation', { result: publicView(started) });
      error.exitCode = started.exitCode || 1;
      throw error;
    }
    ref = { ...ref, operationId: started.operationId };
    saveOwnerRef(profile, ref);
  }
  try {
    const value = await fn({ ownerId: ref.ownerId, operationId: ref.operationId, temporary });
    if (!nested) {
      const finished = await vmOp(profile, {
        op: 'finishOperation', ownerId: ref.ownerId, operationId: ref.operationId,
      }, options);
      if (!finished.ok) throw limaError('finish was not proved', 'finish', { uncertain: true, result: publicView(finished) });
      ref = { ...ref, operationId: null };
      saveOwnerRef(profile, ref);
      if (temporary) await endSession(profile, session, options);
    }
    return value;
  } catch (error) {
    if (!nested && ref.operationId) {
      try {
        await vmOp(profile, {
          op: 'finishOperation', ownerId: ref.ownerId, operationId: ref.operationId, uncertain: true,
        }, options);
      } catch {
        /* retain the reservation when the failure itself cannot be recorded */
      }
    }
    if (error && error.uncertain !== false) error.uncertain = true;
    throw error;
  }
}

export async function bindLimaBrowser(profile, session, browserId, options = {}) {
  const ref = loadOwnerRef(profile, session);
  if (!ref) throw limaError('no local owner reference for this session', 'owner');
  const bound = await vmOp(profile, {
    op: 'bindBrowser', ownerId: ref.ownerId, browserId, phase: 'testing',
  }, options);
  if (!bound.ok) {
    const error = limaError(bound.code || 'bind refused', bound.code || 'bind', { result: publicView(bound) });
    error.exitCode = bound.exitCode || 1;
    throw error;
  }
  return publicView(bound);
}

export async function unbindLimaBrowser(profile, session, browserId, options = {}) {
  const ref = loadOwnerRef(profile, session);
  if (!ref) throw limaError('no local owner reference for this session', 'owner');
  const unbound = await vmOp(profile, {
    op: 'unbindBrowser', ownerId: ref.ownerId, browserId, uncertain: options.uncertain === true,
  }, options);
  if (!unbound.ok && !unbound.retained) {
    const error = limaError(unbound.code || 'unbind refused', unbound.code || 'unbind', { result: publicView(unbound) });
    throw error;
  }
  return publicView(unbound);
}
