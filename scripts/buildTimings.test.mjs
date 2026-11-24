import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeStage } from './buildTimings.mjs';

function withFile(file, fn) {
  const prev = process.env.COLLAB_BUILD_TIMINGS_FILE;
  if (file === undefined) delete process.env.COLLAB_BUILD_TIMINGS_FILE;
  else process.env.COLLAB_BUILD_TIMINGS_FILE = file;
  const restore = () => {
    if (prev === undefined) delete process.env.COLLAB_BUILD_TIMINGS_FILE;
    else process.env.COLLAB_BUILD_TIMINGS_FILE = prev;
  };
  try {
    const result = fn();
    if (result && typeof result.then === 'function') return result.finally(restore);
    restore();
    return result;
  } catch (err) {
    restore();
    throw err;
  }
}

test('with the env, two stages and one throw write three lines', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-timings-'));
  const file = join(dir, 'stages.jsonl');
  try {
    await withFile(file, async () => {
      timeStage('alpha', () => 1);
      await timeStage('beta', async () => 2);
      assert.throws(() => timeStage('gamma', () => { throw new Error('boom'); }), /boom/);
    });
    const lines = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map((line) => line.nome), ['alpha', 'beta', 'gamma']);
    for (const line of lines) assert.equal(typeof line.duracaoMs, 'number');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('without the env, no file is created', () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-timings-'));
  const file = join(dir, 'absent.jsonl');
  try {
    withFile(undefined, () => {
      timeStage('alpha', () => 1);
    });
    assert.equal(existsSync(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a path that cannot be written does not throw', () => {
  withFile('/no/such/dir/build-timings.jsonl', () => {
    timeStage('alpha', () => 1);
  });
});
