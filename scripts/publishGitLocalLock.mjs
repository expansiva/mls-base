import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LOCK_INTERVAL_MS = 250;
export const LOCK_LIMIT_MS = 10 * 60 * 1000;

const releasers = new Set();
let exitHooked = false;

function installExitHook(release) {
  releasers.add(release);
  if (exitHooked) return;
  exitHooked = true;
  const original = process.exit.bind(process);
  process.exit = (code) => {
    runReleasers();
    return original(code);
  };
  process.on('exit', runReleasers);
}

function runReleasers() {
  for (const release of releasers) {
    try { release(); } catch { /* a failed release must not skip the others */ }
  }
}

function defaultAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function lockDirectory(root, tmpRoot) {
  const real = realpathSync(root);
  const key = createHash('sha256').update(`local\0${real}`).digest('hex');
  return { real, dir: join(tmpRoot, `collab-publish-local-${key}`) };
}

function readMeta(dir) {
  try {
    const raw = readFileSync(join(dir, 'owner.json'), 'utf8');
    const meta = JSON.parse(raw);
    if (!meta || typeof meta !== 'object') return { incomplete: true };
    return meta;
  } catch {
    return null;
  }
}

function metaComplete(meta) {
  return Boolean(meta && !meta.incomplete && meta.pid && meta.id && meta.root && meta.phase && meta.profile === 'local');
}

function writeMeta(dir, meta) {
  const dest = join(dir, 'owner.json');
  const tmp = join(dir, `.owner.${meta.id}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(meta)}\n`);
  renameSync(tmp, dest);
}

function tryCreate(dir, meta, onBeforePublish) {
  const staging = `${dir}.incoming-${meta.id}`;
  mkdirSync(staging);
  try {
    writeMeta(staging, meta);
    if (onBeforePublish) onBeforePublish(staging, dir);
    // An empty directory is replaced by rename on macOS. An incomplete lock is
    // that empty directory and must stay. A live lock already contains owner.json,
    // so rename fails with ENOTEMPTY/EEXIST instead of publishing over it.
    if (existsSync(dir)) return false;
    renameSync(staging, dir);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'ENOTEMPTY') return false;
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

function classifyHolder(meta, isAlive) {
  if (!meta) return { code: 'retained-incomplete', diagnosis: 'publish local lock retained: incomplete metadata; not removed' };
  if (!metaComplete(meta)) return { code: 'retained-incomplete', diagnosis: 'publish local lock retained: incomplete metadata; not removed' };
  if (meta.retained) {
    const why = meta.diagnosis ? `: ${meta.diagnosis}` : '';
    return { code: 'retained-uncertain', diagnosis: `publish local lock retained: remote operation uncertain${why}; not removed` };
  }
  if (!isAlive(meta.pid)) {
    return { code: 'retained-dead', diagnosis: `publish local lock retained: dead owner pid ${meta.pid} phase ${meta.phase}; not removed` };
  }
  return { code: 'busy', pid: meta.pid, phase: meta.phase };
}

/**
 * Exclusive local-publish lock for one Mac ROOT. The directory in the system
 * temp dir is the lock; acquisition publishes that directory by rename only
 * after owner.json is inside it. A dead or uncertain owner is
 * left in place — only a known end of this process removes its own lock.
 */
export function createPublishLocalLock(options = {}) {
  const intervalMs = options.intervalMs ?? LOCK_INTERVAL_MS;
  const limitMs = options.limitMs ?? LOCK_LIMIT_MS;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const isAlive = options.isAlive ?? defaultAlive;
  const tmpRoot = options.tmpRoot ?? tmpdir();
  const log = options.log ?? ((line) => { process.stderr.write(`${line}\n`); });
  const pid = options.pid ?? process.pid;
  const randomId = options.randomId ?? (() => randomBytes(16).toString('hex'));
  const onBeforePublish = options.onBeforePublish;

  let held = null;

  function releaseOwn() {
    if (!held || held.retained) return { released: false, reason: held ? 'retained' : 'none' };
    const current = readMeta(held.dir);
    if (!current || current.id !== held.id) return { released: false, reason: 'not-owner' };
    rmSync(held.dir, { recursive: true, force: true });
    held = null;
    return { released: true };
  }

  if (options.installExit !== false) installExitHook(releaseOwn);

  return {
    lockDir(root) {
      return lockDirectory(root, tmpRoot).dir;
    },

    async acquire({ root, phase }) {
      if (held) return { ok: false, code: 'already-held' };
      if (!phase) return { ok: false, code: 'phase-required' };
      const { real, dir } = lockDirectory(root, tmpRoot);
      const id = randomId();
      const deadline = now() + limitMs;
      let announced = false;

      for (;;) {
        const meta = { pid, id, root: real, phase, profile: 'local' };
        if (tryCreate(dir, meta, onBeforePublish)) {
          held = { dir, id, root: real, phase, retained: false };
          return { ok: true, dir, id, root: real, phase };
        }
        const holder = classifyHolder(readMeta(dir), isAlive);
        if (holder.code !== 'busy') {
          log(holder.diagnosis);
          return { ok: false, ...holder, dir, removed: false };
        }
        if (!announced) {
          log(`publish local busy: pid ${holder.pid} phase ${holder.phase}`);
          announced = true;
        }
        const remaining = deadline - now();
        if (remaining <= 0) {
          const diagnosis = 'publish local lock wait exceeded; active lock kept';
          log(diagnosis);
          return { ok: false, code: 'timeout', diagnosis, dir, removed: false };
        }
        await sleep(Math.min(intervalMs, remaining));
      }
    },

    updatePhase(phase) {
      if (!held || held.retained) return { ok: false, reason: held ? 'retained' : 'none' };
      const current = readMeta(held.dir);
      if (!current || current.id !== held.id) return { ok: false, reason: 'not-owner' };
      current.phase = phase;
      writeMeta(held.dir, current);
      held.phase = phase;
      return { ok: true, phase };
    },

    release() {
      return releaseOwn();
    },

    retain(diagnosis) {
      if (!held) return { ok: false, reason: 'none' };
      const current = readMeta(held.dir);
      if (!current || current.id !== held.id) return { ok: false, reason: 'not-owner' };
      current.retained = true;
      current.diagnosis = String(diagnosis || 'uncertain');
      writeMeta(held.dir, current);
      held.retained = true;
      return { ok: true, retained: true };
    },
  };
}

/** Remove dir only when id is the owner recorded inside it. */
export function tryRelease(dir, id) {
  const current = readMeta(dir);
  if (!current || current.id !== id || current.retained) return { released: false, reason: 'not-owner' };
  rmSync(dir, { recursive: true, force: true });
  return { released: true };
}
