import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cacheKey,
  chainHeads,
  hashCompilerOptions,
  loadCacheEntry,
  restoreEmittedTree,
  saveCacheEntry,
  sha256Text,
  shouldUseCache,
} from './buildCache.mjs';

function git(dir, args) {
  const result = spawnSync('git', ['-c', 'user.email=rt155@local', '-c', 'user.name=rt155', ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')}: ${result.stderr || result.stdout}`);
  }
}

function repo(root, name, body) {
  const dir = join(root, name);
  mkdirSync(join(dir, 'l1'), { recursive: true });
  writeFileSync(join(dir, 'l1', 'a.ts'), body);
  git(dir, ['init']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'init']);
  return dir;
}

const base = {
  typescriptVersion: '5.0.0',
  compilerOptionsHash: 'opt',
  baseTsconfigHash: 'base',
  policyStatus: 'permissive',
};

test('cache key changes with HEAD, dirty tree and compiler option', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-key-'));
  try {
    const dir = repo(root, 'mls-1', 'export const a = 1;\n');
    const clean = chainHeads([{ id: '1', dir }]);
    assert.equal(clean.ok, true);
    const keyClean = cacheKey({ ...base, head: clean.heads[0].head, depHeads: clean.heads });
    writeFileSync(join(dir, 'l1', 'a.ts'), 'export const a = 2;\n');
    const dirty = chainHeads([{ id: '1', dir }]);
    assert.equal(dirty.ok, false);
    const keyDirty = cacheKey({
      ...base,
      head: clean.heads[0].head,
      dirty: ' M l1/a.ts',
      depHeads: clean.heads,
    });
    assert.notEqual(keyClean.full, keyDirty.full);
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'next']);
    const next = chainHeads([{ id: '1', dir }]);
    assert.equal(next.ok, true);
    const keyNext = cacheKey({ ...base, head: next.heads[0].head, depHeads: next.heads });
    assert.notEqual(keyClean.full, keyNext.full);
    const keyOpt = cacheKey({
      ...base,
      head: next.heads[0].head,
      depHeads: next.heads,
      compilerOptionsHash: hashCompilerOptions({ module: 'commonjs', paths: { a: ['b'] }, outDir: 'dist' }),
    });
    const keyOptSame = cacheKey({
      ...base,
      head: next.heads[0].head,
      depHeads: next.heads,
      compilerOptionsHash: hashCompilerOptions({ outDir: 'other', paths: { z: ['y'] }, module: 'commonjs' }),
    });
    assert.equal(keyOpt.full, keyOptSame.full);
    const keyOptOther = cacheKey({
      ...base,
      head: next.heads[0].head,
      depHeads: next.heads,
      compilerOptionsHash: hashCompilerOptions({ module: 'esnext' }),
    });
    assert.notEqual(keyOpt.full, keyOptOther.full);
    assert.equal(keyClean.short.length, 12);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dirty lib and the client app never use the cache', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-use-'));
  try {
    const dir = repo(root, 'mls-2', 'export const a = 1;\n');
    const head = chainHeads([{ id: '2', dir }]).heads[0].head;
    assert.equal(shouldUseCache({
      projectId: '2', clientId: '9', head, porcelain: '', chainOk: true,
    }), true);
    writeFileSync(join(dir, 'l1', 'b.ts'), 'export const b = 1;\n');
    assert.equal(chainHeads([{ id: '2', dir }]).ok, false);
    assert.equal(shouldUseCache({
      projectId: '2', clientId: '9', head, porcelain: '?? l1/b.ts', chainOk: false,
    }), false);
    assert.equal(shouldUseCache({
      projectId: '9', clientId: '9', head, porcelain: '', chainOk: true,
    }), false);
    assert.equal(shouldUseCache({
      projectId: '2', clientId: '9', head: null, porcelain: null, chainOk: false,
    }), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('incomplete cache entry is ignored', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-entry-'));
  try {
    const key = sha256Text('incomplete');
    mkdirSync(join(root, key, 'tree'), { recursive: true });
    writeFileSync(join(root, key, 'report.json'), '{"reportLine":"x","marker":"y","excerpt":[]}\n');
    const missing = await loadCacheEntry(root, key);
    assert.equal(missing.hit, false);
    assert.match(missing.reason, /incomplete/);

    const src = join(root, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.js'), 'export const a = 1;\n');
    const full = sha256Text('full');
    const report = { reportLine: 'mls-1 status=permissive', marker: '##typeCheck##', excerpt: ['e1'], block: false };
    await saveCacheEntry(root, full, src, report);
    const loaded = await loadCacheEntry(root, full);
    assert.equal(loaded.hit, true);
    assert.equal(loaded.report.reportLine, report.reportLine);
    const dest = join(root, 'out');
    await restoreEmittedTree(loaded.tree, dest);
    assert.equal(readFileSync(join(dest, 'a.js'), 'utf8'), 'export const a = 1;\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
