import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublishLocalLock, tryRelease, LOCK_INTERVAL_MS, LOCK_LIMIT_MS } from './publishGitLocalLock.mjs';

const SELF = fileURLToPath(import.meta.url);

function scratch() {
  return mkdtempSync(join(tmpdir(), 'publish-local-lock-'));
}

if (process.env.RT73_LOCK_WORKER) {
  const mode = process.env.RT73_LOCK_WORKER;
  const root = process.env.RT73_LOCK_ROOT;
  const tmpRoot = process.env.RT73_LOCK_TMP;
  const status = process.env.RT73_LOCK_STATUS;
  const lock = createPublishLocalLock({ tmpRoot });
  if (mode === 'hold-exit') {
    const got = await lock.acquire({ root, phase: 'prepare' });
    writeFileSync(status, JSON.stringify({ ok: got.ok, dir: got.dir, id: got.id }));
    process.exit(0);
  }
  if (mode === 'hold-retain-exit') {
    const got = await lock.acquire({ root, phase: 'push' });
    lock.retain('disconnect-applied');
    writeFileSync(status, JSON.stringify({ ok: got.ok, dir: got.dir }));
    process.exit(0);
  }
  if (mode === 'critical') {
    const name = process.env.RT73_LOCK_NAME;
    const gate = process.env.RT73_LOCK_GATE;
    const log = process.env.RT73_LOCK_LOG;
    const got = await lock.acquire({ root, phase: name });
    if (!got.ok) {
      writeFileSync(status, JSON.stringify(got));
      process.exit(2);
    }
    append(log, `${name} enter\n`);
    const started = Date.now();
    while (!existsSync(gate) && Date.now() - started < 15000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    append(log, `${name} leave\n`);
    lock.release();
    writeFileSync(status, JSON.stringify({ ok: true }));
    process.exit(0);
  }
}

function append(file, text) {
  writeFileSync(file, (existsSync(file) ? readFileSync(file, 'utf8') : '') + text);
}

function runWorker(mode, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SELF], {
      env: { ...process.env, RT73_LOCK_WORKER: mode, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stderr }));
  });
}

test('defaults are 250ms and ten minutes', () => {
  assert.equal(LOCK_INTERVAL_MS, 250);
  assert.equal(LOCK_LIMIT_MS, 600_000);
});

test('same ROOT shares one lock; owner meta has pid, id, root, phase', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const lock = createPublishLocalLock({ tmpRoot, installExit: false });
  const got = await lock.acquire({ root, phase: 'prepare' });
  assert.equal(got.ok, true);
  assert.equal(lock.lockDir(root), got.dir);
  const meta = JSON.parse(readFileSync(join(got.dir, 'owner.json'), 'utf8'));
  assert.equal(meta.pid, process.pid);
  assert.equal(meta.id, got.id);
  assert.equal(meta.root, got.root);
  assert.equal(meta.phase, 'prepare');
  assert.equal(meta.profile, 'local');
  assert.equal(JSON.stringify(meta).includes('token'), false);
  const updated = lock.updatePhase('push');
  assert.equal(updated.ok, true);
  const next = JSON.parse(readFileSync(join(got.dir, 'owner.json'), 'utf8'));
  assert.equal(next.phase, 'push');
  assert.equal(next.id, got.id);
  lock.release();
  assert.equal(existsSync(got.dir), false);
  rmSync(base, { recursive: true, force: true });
});

test('tryRelease refuses a foreign id', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const lock = createPublishLocalLock({ tmpRoot, installExit: false });
  const got = await lock.acquire({ root, phase: 'prepare' });
  const foreign = tryRelease(got.dir, 'other-id');
  assert.equal(foreign.released, false);
  assert.equal(existsSync(join(got.dir, 'owner.json')), true);
  assert.equal(lock.release().released, true);
  rmSync(base, { recursive: true, force: true });
});

test('known process.exit releases only the owner lock', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  const status = join(base, 'status.json');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const child = await runWorker('hold-exit', { RT73_LOCK_ROOT: root, RT73_LOCK_TMP: tmpRoot, RT73_LOCK_STATUS: status });
  assert.equal(child.code, 0);
  const recorded = JSON.parse(readFileSync(status, 'utf8'));
  assert.equal(recorded.ok, true);
  assert.equal(existsSync(recorded.dir), false);
  rmSync(base, { recursive: true, force: true });
});

test('retained uncertain lock survives process.exit and is not taken', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  const status = join(base, 'status.json');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const child = await runWorker('hold-retain-exit', { RT73_LOCK_ROOT: root, RT73_LOCK_TMP: tmpRoot, RT73_LOCK_STATUS: status });
  assert.equal(child.code, 0);
  const recorded = JSON.parse(readFileSync(status, 'utf8'));
  assert.equal(existsSync(recorded.dir), true);
  const lines = [];
  const next = createPublishLocalLock({ tmpRoot, installExit: false, log: (line) => lines.push(line) });
  const again = await next.acquire({ root, phase: 'prepare' });
  assert.equal(again.ok, false);
  assert.equal(again.code, 'retained-uncertain');
  assert.equal(existsSync(recorded.dir), true);
  assert.match(lines.join('\n'), /not removed/);
  rmSync(base, { recursive: true, force: true });
});

test('dead owner and incomplete metadata are not usurped', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const probe = createPublishLocalLock({ tmpRoot, installExit: false, log() {} });
  const dir = probe.lockDir(root);
  mkdirSync(dir);
  writeFileSync(join(dir, 'owner.json'), `${JSON.stringify({ pid: 2147483646, id: 'dead', root, phase: 'push', profile: 'local' })}\n`);
  const dead = await probe.acquire({ root, phase: 'prepare' });
  assert.equal(dead.ok, false);
  assert.equal(dead.code, 'retained-dead');
  assert.equal(existsSync(dir), true);

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const incomplete = await probe.acquire({ root, phase: 'prepare' });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.code, 'retained-incomplete');
  assert.equal(existsSync(dir), true);
  rmSync(base, { recursive: true, force: true });
});

test('live owner is announced once and the wait limit leaves the lock', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const holder = createPublishLocalLock({ tmpRoot, installExit: false, randomId: () => 'owner-id' });
  const got = await holder.acquire({ root, phase: 'hook' });
  let clock = 0;
  const lines = [];
  const waiter = createPublishLocalLock({
    tmpRoot,
    installExit: false,
    intervalMs: 250,
    limitMs: 1000,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    isAlive: (pid) => pid === process.pid,
    log: (line) => lines.push(line),
  });
  const result = await waiter.acquire({ root, phase: 'prepare' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'timeout');
  assert.equal(result.removed, false);
  assert.equal(existsSync(got.dir), true);
  assert.equal(lines.filter((line) => line.startsWith('publish local busy')).length, 1);
  assert.match(lines[0], /pid \d+ phase hook/);
  holder.release();
  rmSync(base, { recursive: true, force: true });
});

test('lock name is published only with owner.json already inside', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  let sawFinalEarly = false;
  const lock = createPublishLocalLock({
    tmpRoot,
    installExit: false,
    randomId: () => 'publish-id',
    onBeforePublish(staging, dir) {
      const meta = JSON.parse(readFileSync(join(staging, 'owner.json'), 'utf8'));
      assert.equal(meta.id, 'publish-id');
      assert.equal(meta.phase, 'prepare');
      if (existsSync(dir)) sawFinalEarly = true;
    },
  });
  const got = await lock.acquire({ root, phase: 'prepare' });
  assert.equal(got.ok, true);
  assert.equal(sawFinalEarly, false);
  assert.equal(existsSync(join(got.dir, 'owner.json')), true);
  assert.equal(existsSync(`${got.dir}.incoming-publish-id`), false);
  const meta = JSON.parse(readFileSync(join(got.dir, 'owner.json'), 'utf8'));
  assert.equal(meta.id, 'publish-id');
  lock.release();
  rmSync(base, { recursive: true, force: true });
});

test('two processes do not overlap the critical section', async () => {
  const base = scratch();
  const root = join(base, 'root');
  const tmpRoot = join(base, 'tmp');
  const log = join(base, 'section.log');
  mkdirSync(root);
  mkdirSync(tmpRoot);
  const shared = {
    RT73_LOCK_ROOT: root,
    RT73_LOCK_TMP: tmpRoot,
    RT73_LOCK_LOG: log,
    RT73_LOCK_GATE: join(base, 'gate'),
  };
  const first = runWorker('critical', { ...shared, RT73_LOCK_NAME: 'A', RT73_LOCK_STATUS: join(base, 'a.json') });
  const started = Date.now();
  while (!existsSync(log) && Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.match(readFileSync(log, 'utf8'), /A enter/);
  const second = runWorker('critical', { ...shared, RT73_LOCK_NAME: 'B', RT73_LOCK_STATUS: join(base, 'b.json') });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(readFileSync(log, 'utf8').includes('B enter'), false);
  writeFileSync(shared.RT73_LOCK_GATE, 'go');
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  const text = readFileSync(log, 'utf8');
  assert.equal(text, 'A enter\nA leave\nB enter\nB leave\n');
  rmSync(base, { recursive: true, force: true });
});
