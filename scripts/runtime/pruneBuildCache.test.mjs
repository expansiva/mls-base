import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emitKeysToPrune, pruneBuildCache, releaseInProgress } from './pruneBuildCache.mjs';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-11-23T20:00:00Z');
const at = (hoursAgo) => NOW - hoursAgo * HOUR;

function tree() {
  return mkdtempSync(join(tmpdir(), 'prune-cache-'));
}

function put(root, id, name, hoursAgo, bytes = 2048) {
  const dir = join(root, '.buildCache', 'emit', id, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ok'), 'x'.repeat(bytes));
  const when = new Date(at(hoursAgo));
  utimesSync(dir, when, when);
  return dir;
}

function record(root, name, body) {
  const dir = join(root, 'releases', 'registro');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(body));
}

test('emitKeysToPrune: várias chaves antigas por projeto, fica só a mais nova', () => {
  const entries = [
    { id: '1', name: 'a', mtimeMs: at(100) },
    { id: '1', name: 'b', mtimeMs: at(50) },
    { id: '1', name: 'c', mtimeMs: at(30) },
    { id: '2', name: 'z', mtimeMs: at(200) },
  ];
  assert.deepEqual(emitKeysToPrune(entries, NOW).map((item) => `${item.id}/${item.name}`).sort(), ['1/a', '1/b']);
});

test('emitKeysToPrune: chave de 2 h fica, e a mais nova fica mesmo velha', () => {
  const entries = [
    { id: '1', name: 'velha', mtimeMs: at(80) },
    { id: '1', name: 'recente', mtimeMs: at(2) },
    { id: '2', name: 'unica-velha', mtimeMs: at(500) },
  ];
  assert.deepEqual(emitKeysToPrune(entries, NOW), [{ id: '1', name: 'velha' }]);
});

test('emitKeysToPrune: chave com menos de 24 h fica mesmo não sendo a mais nova', () => {
  const entries = [
    { id: '1', name: 'a', mtimeMs: at(10) },
    { id: '1', name: 'b', mtimeMs: at(1) },
  ];
  assert.deepEqual(emitKeysToPrune(entries, NOW), []);
});

test('emitKeysToPrune: .partial de 3 dias sai, de 1 h fica, e .partial não conta como a chave mais nova', () => {
  const entries = [
    { id: '1', name: '.partial-111', mtimeMs: at(72) },
    { id: '1', name: '.partial-222', mtimeMs: at(1) },
    { id: '1', name: 'chave', mtimeMs: at(200) },
  ];
  assert.deepEqual(emitKeysToPrune(entries, NOW), [{ id: '1', name: '.partial-111' }]);
});

test('pruneBuildCache apaga no disco só o que a função manda e soma o que liberou', () => {
  const root = tree();
  const old1 = put(root, '102047', 'a', 100, 4096);
  const old2 = put(root, '102047', 'b', 60, 4096);
  const newest = put(root, '102047', 'c', 30, 4096);
  const partial = put(root, '102047', '.partial-9', 72, 1024);
  const other = put(root, '102020', 'solo', 300, 4096);
  const result = pruneBuildCache(root, { nowMs: NOW });
  assert.equal(result.skipped, undefined);
  assert.deepEqual(result.removed.map((item) => item.path).sort(), [old1, old2, partial].sort());
  assert.equal(result.freedKb, 4 + 4 + 1);
  assert.equal(existsSync(newest), true);
  assert.equal(existsSync(other), true);
  assert.equal(existsSync(old1), false);
  assert.equal(existsSync(partial), false);
});

test('pruneBuildCache não apaga nada com release em andamento na árvore', () => {
  const root = tree();
  const old = put(root, '1', 'a', 100);
  put(root, '1', 'b', 30);
  record(root, '20261123190000', { resultado: 'andamento', inicio: new Date(at(1)).toISOString() });
  assert.equal(releaseInProgress(root, NOW), true);
  const result = pruneBuildCache(root, { nowMs: NOW });
  assert.equal(result.skipped, 'release em andamento');
  assert.deepEqual(result.removed, []);
  assert.equal(existsSync(old), true);
});

test('release em andamento de mais de 2 h é registro velho (STALE_AFTER_MS) e não trava a poda', () => {
  const root = tree();
  const old = put(root, '1', 'a', 100);
  put(root, '1', 'b', 30);
  record(root, '20261123100000', { resultado: 'andamento', inicio: new Date(at(10)).toISOString() });
  record(root, '20261123150000', { resultado: 'ok', inicio: new Date(at(1)).toISOString() });
  assert.equal(releaseInProgress(root, NOW), false);
  assert.equal(pruneBuildCache(root, { nowMs: NOW }).removed.length, 1);
  assert.equal(existsSync(old), false);
});

test('pruneBuildCache numa árvore sem .buildCache devolve freedKb 0 sem erro', () => {
  const root = tree();
  assert.deepEqual(pruneBuildCache(root, { nowMs: NOW }), { root, removed: [], freedKb: 0 });
});

test('CLI --json imprime { root, removed, freedKb } e usa o relógio real', () => {
  const root = tree();
  put(root, '1', 'a', 24 * 40);
  put(root, '1', 'b', 24 * 39);
  const script = fileURLToPath(new URL('./pruneBuildCache.mjs', import.meta.url));
  const run = spawnSync('node', [script, '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.deepEqual(Object.keys(out).sort(), ['freedKb', 'removed', 'root']);
  assert.equal(out.removed.length, 1);
  assert.deepEqual(readdirSync(join(root, '.buildCache', 'emit', '1')), ['b']);
});

test('CLI sem --root sai com erro de uso', () => {
  const script = fileURLToPath(new URL('./pruneBuildCache.mjs', import.meta.url));
  assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
});
