#!/usr/bin/env node
// rt304 s1: poda o cache de emissão de uma árvore (`<root>/.buildCache/emit/<id>/<chave>`).
//
// O build grava uma pasta por chave de emissão (`emitProject.mjs`: a chave muda com qualquer arquivo de entrada) e só relê
// a mais recente; nada apagava as antigas. A VM chama este script todo dia (collab-runtime `disk-cleanup.mjs`).
//
//   node scripts/runtime/pruneBuildCache.mjs --root <árvore> [--json]
//
// Regra: por projeto fica a chave mais recente (mtime) e toda chave com menos de 24 h; sai o resto e os `.partial-*` com mais de
// 24 h (restos de build interrompido). Com release em andamento na árvore nada é apagado.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STALE_AFTER_MS, recordsDir } from './releaseRecord.mjs';

export const KEEP_RECENT_MS = 24 * 60 * 60 * 1000;
const PARTIAL = /^\.partial-/u;

/**
 * Which cache entries the prune removes.
 * @param {Array<{ id: string, name: string, mtimeMs: number }>} entries every folder found in `emit/<id>/` (keys and `.partial-*`)
 * @param {number} nowMs
 * @returns {Array<{ id: string, name: string }>}
 */
export function emitKeysToPrune(entries, nowMs, keepRecentMs = KEEP_RECENT_MS) {
  /** @type {Map<string, Array<{ id: string, name: string, mtimeMs: number }>>} */
  const keysById = new Map();
  const remove = [];
  for (const entry of entries) {
    if (PARTIAL.test(entry.name)) {
      if (nowMs - entry.mtimeMs >= keepRecentMs) remove.push({ id: entry.id, name: entry.name });
      continue;
    }
    keysById.set(entry.id, [...(keysById.get(entry.id) ?? []), entry]);
  }
  for (const keys of keysById.values()) {
    const newest = [...keys].sort((a, b) => b.mtimeMs - a.mtimeMs || (a.name < b.name ? 1 : -1))[0];
    for (const key of keys) {
      if (key === newest) continue;
      if (nowMs - key.mtimeMs < keepRecentMs) continue;
      remove.push({ id: key.id, name: key.name });
    }
  }
  return remove;
}

/** True when a release record of the tree is still `andamento` and started less than `STALE_AFTER_MS` ago. */
export function releaseInProgress(root, nowMs = Date.now()) {
  const dir = recordsDir(root, 'base');
  if (!existsSync(dir)) return false;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const record = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (record?.resultado !== 'andamento') continue;
      const started = Date.parse(record.inicio);
      if (Number.isFinite(started) && nowMs - started < STALE_AFTER_MS) return true;
    } catch { /* unreadable record: it does not prove a release is running */ }
  }
  return false;
}

function sizeKb(path) {
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try { bytes += statSync(full).size; } catch { /* vanished while counting */ }
      }
    }
  };
  walk(path);
  return Math.ceil(bytes / 1024);
}

function listEntries(emitDir) {
  const entries = [];
  for (const id of readdirSync(emitDir)) {
    const idDir = join(emitDir, id);
    if (!statSync(idDir).isDirectory()) continue;
    for (const name of readdirSync(idDir)) {
      const full = join(idDir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) entries.push({ id, name, mtimeMs: stat.mtimeMs });
    }
  }
  return entries;
}

/**
 * Prunes `<root>/.buildCache/emit`. Never throws for an absent cache.
 * @returns {{ root: string, removed: Array<{ path: string, kb: number }>, freedKb: number, skipped?: string }}
 */
export function pruneBuildCache(root, { nowMs = Date.now() } = {}) {
  const base = resolve(root);
  if (releaseInProgress(base, nowMs)) return { root: base, removed: [], freedKb: 0, skipped: 'release em andamento' };
  const emitDir = join(base, '.buildCache', 'emit');
  if (!existsSync(emitDir)) return { root: base, removed: [], freedKb: 0 };
  const removed = [];
  for (const { id, name } of emitKeysToPrune(listEntries(emitDir), nowMs)) {
    const path = join(emitDir, id, name);
    const kb = sizeKb(path);
    rmSync(path, { recursive: true, force: true });
    removed.push({ path, kb });
  }
  return { root: base, removed, freedKb: removed.reduce((sum, item) => sum + item.kb, 0) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 ? argv[rootIndex + 1] : undefined;
  if (!root) {
    console.error('uso: pruneBuildCache.mjs --root <árvore> [--json]');
    process.exit(2);
  }
  const result = pruneBuildCache(root);
  if (argv.includes('--json')) console.log(JSON.stringify(result));
  else console.log(result.skipped ? `skipped: ${result.skipped}` : `removed ${result.removed.length} entries, freed ${result.freedKb} KB`);
}
