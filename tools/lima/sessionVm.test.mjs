import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCK_PATH } from './sessionVm.mjs';

const modulePath = fileURLToPath(new URL('./sessionVm.mjs', import.meta.url));

function tempLock() {
  const dir = mkdtempSync(join(tmpdir(), 'lima-session-'));
  return { dir, lockPath: join(dir, 'lima.lock') };
}

function runCli(lockPath, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [modulePath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => {
      let json = null;
      try { json = JSON.parse(out); } catch { /* assertion reports the raw stdout */ }
      resolve({ code, json, err, out });
    });
    child.stdin.end(JSON.stringify({ ...payload, lockPath }));
  });
}

test('import does not create the lima lock', async () => {
  const before = statOrNull(DEFAULT_LOCK_PATH);
  await import(`./sessionVm.mjs?probe=${Date.now()}`);
  assert.deepEqual(statOrNull(DEFAULT_LOCK_PATH), before);
});

test('concurrent acquires have one winner and the reservation survives the CLI', async () => {
  const { dir, lockPath } = tempLock();
  try {
    const [first, second] = await Promise.all([
      runCli(lockPath, { op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima' }),
      runCli(lockPath, { op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima' }),
    ]);
    const wins = [first, second].filter((result) => result.code === 0);
    const losses = [first, second].filter((result) => result.code === 73);
    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
    const ownerId = wins[0].json.ownerId;
    assert.equal(wins[0].json.acquired, true);
    assert.equal(typeof ownerId, 'string');
    assertNoOwnerId(losses[0].json, ownerId);
    assert.equal(losses[0].json.session, 'campanha');
    assert.equal(losses[0].json.projectId, '102047');
    assert.equal(losses[0].json.phase, 'reserved');
    assert.equal(typeof losses[0].json.startedAt, 'string');

    const again = await runCli(lockPath, {
      op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima',
    });
    assert.equal(again.code, 73);
    assertNoOwnerId(again.json, ownerId);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).ownerId, ownerId);

    const status = await runCli(lockPath, { op: 'status' });
    assert.equal(status.code, 0);
    assert.equal(status.json.held, true);
    assert.equal(status.json.session, 'campanha');
    assert.equal(status.json.projectId, '102047');
    assertNoOwnerId(status.json, ownerId);
    const confirmed = await runCli(lockPath, { op: 'status', ownerId });
    assert.equal(confirmed.json.owned, true);
    assertNoOwnerId(confirmed.json, ownerId);
    const deniedStatus = await runCli(lockPath, { op: 'status', ownerId: 'f'.repeat(32) });
    assert.equal(deniedStatus.json.owned, false);
    assertNoOwnerId(deniedStatus.json, ownerId);
    assert.equal(statSync(lockPath).mode & 0o777, 0o600);
    assert.equal(statSync(dirname(lockPath)).mode & 0o777, 0o700);

    const visible = status.json;
    const [endAttempt, operationAttempt, browserAttempt] = await Promise.all([
      runCli(lockPath, { op: 'end', ownerId: visible.session }),
      runCli(lockPath, { op: 'beginOperation', ownerId: visible.projectId, name: 'prepare' }),
      runCli(lockPath, { op: 'bindBrowser', ownerId: visible.startedAt, browserId: 'campanha-responsavel' }),
    ]);
    for (const attempt of [endAttempt, operationAttempt, browserAttempt]) {
      assert.equal(attempt.code, 73);
      assertNoOwnerId(attempt.json, ownerId);
    }
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).ownerId, ownerId);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stranger cannot end the reservation', async () => {
  const { dir, lockPath } = tempLock();
  try {
    const acquired = await runCli(lockPath, {
      op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima',
    });
    assert.equal(acquired.code, 0);
    const stranger = await runCli(lockPath, { op: 'end', ownerId: 'f'.repeat(32) });
    assert.equal(stranger.code, 73);
    assertNoOwnerId(stranger.json, acquired.json.ownerId);
    assert.equal(stranger.json.projectId, '102047');
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).ownerId, acquired.json.ownerId);

    const ended = await runCli(lockPath, { op: 'end', ownerId: acquired.json.ownerId });
    assert.equal(ended.code, 0);
    const status = await runCli(lockPath, { op: 'status' });
    assert.equal(status.json.held, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('operation and browser bind do not both win a race', async () => {
  const { dir, lockPath } = tempLock();
  try {
    const acquired = await runCli(lockPath, {
      op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima',
    });
    const ownerId = acquired.json.ownerId;
    const begun = await runCli(lockPath, { op: 'beginOperation', ownerId, name: 'prepare' });
    assert.equal(begun.code, 0);
    const finished = await runCli(lockPath, {
      op: 'finishOperation', ownerId, operationId: begun.json.operationId, phase: 'ready',
    });
    assert.equal(finished.code, 0);

    const [operation, browser] = await Promise.all([
      runCli(lockPath, { op: 'beginOperation', ownerId, name: 'publish' }),
      runCli(lockPath, { op: 'bindBrowser', ownerId, browserId: 'campanha-responsavel' }),
    ]);
    const ok = [operation, browser].filter((result) => result.code === 0);
    assert.equal(ok.length, 1);
    const stored = JSON.parse(readFileSync(lockPath, 'utf8'));
    const exclusive = (stored.operations.length === 1 && stored.browsers.length === 0)
      || (stored.operations.length === 0 && stored.browsers.length === 1);
    assert.equal(exclusive, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('incomplete metadata and an uncertain operation stay in place', async () => {
  const { dir, lockPath } = tempLock();
  try {
    const acquired = await runCli(lockPath, {
      op: 'acquire', session: 'campanha', projectId: '102047', origin: 'tools/lima',
    });
    const ownerId = acquired.json.ownerId;
    const begun = await runCli(lockPath, { op: 'beginOperation', ownerId, name: 'reset' });
    const uncertain = await runCli(lockPath, {
      op: 'finishOperation', ownerId, operationId: begun.json.operationId, uncertain: true,
    });
    assert.equal(uncertain.code, 0);
    assert.equal(uncertain.json.phase, 'failed');
    const afterExit = await runCli(lockPath, { op: 'status' });
    assert.equal(afterExit.json.phase, 'failed');
    assert.equal(afterExit.json.operations.length, 1);
    assert.equal(afterExit.json.operations[0].uncertain, true);
    const ended = await runCli(lockPath, { op: 'end', ownerId });
    assert.equal(ended.code, 1);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).phase, 'failed');

    const broken = '{"schema":1}\n';
    writeFileSync(lockPath, broken, { mode: 0o600 });
    const blocked = await runCli(lockPath, {
      op: 'acquire', session: 'outra', projectId: '102047', origin: 'tools/lima',
    });
    assert.equal(blocked.code, 74);
    assert.match(blocked.json.recovery, /supervisor/);
    assertNoOwnerId(blocked.json, ownerId);
    assert.equal(readFileSync(lockPath, 'utf8'), broken);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function assertNoOwnerId(payload, ownerId) {
  const text = JSON.stringify(payload);
  assert.equal(Object.hasOwn(payload, 'ownerId'), false);
  assert.equal(text.includes(ownerId), false);
  assert.equal(text.includes(ownerId.slice(0, 8)), false);
}

function statOrNull(file) {
  try {
    const stat = statSync(file);
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}
