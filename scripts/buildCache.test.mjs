import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkBaseKey,
  emitCacheKey,
  hashCompilerOptions,
  legacyCacheReason,
  loadCheck,
  loadEmit,
  planLibCache,
  shouldUseCache,
  writeCheckEntry,
  writeEmitEntry,
} from './buildCache.mjs';
import { typeCheckProject } from './typeCheckRun.mjs';

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

function plan(ids, clientId, dirs) {
  return planLibCache({
    ids,
    clientId,
    dirs,
    compilerOptions: { module: 'esnext', paths: { a: ['b'] }, outDir: 'dist' },
    tsVersion: base.typescriptVersion,
    baseHash: base.baseTsconfigHash,
  });
}

function lookup(dirs) {
  return (id) => {
    const dir = dirs[id];
    if (!dir) return { head: null, porcelain: null };
    const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir, encoding: 'utf8' });
    const porcelain = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: dir, encoding: 'utf8' });
    return {
      head: head.status === 0 ? head.stdout.trim() : null,
      porcelain: porcelain.status === 0 ? porcelain.stdout.trim() : null,
    };
  };
}

const report = {
  projectId: '1',
  reportLine: 'mls-1 status=permissive',
  marker: '##typeCheck##',
  excerpt: ['e1'],
  block: false,
};

test('cache key changes with HEAD and compiler option', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-key-'));
  try {
    const dir = repo(root, 'mls-1', 'export const a = 1;\n');
    const first = plan(['1'], '9', { 1: dir })[0];
    writeFileSync(join(dir, 'l1', 'a.ts'), 'export const a = 2;\n');
    const dirty = plan(['1'], '9', { 1: dir })[0];
    assert.equal(dirty.eligible, false);
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'next']);
    const next = plan(['1'], '9', { 1: dir })[0];
    assert.notEqual(first.emitKey, next.emitKey);
    assert.notEqual(first.checkBase, next.checkBase);
    const sameOpts = emitCacheKey({
      ...base,
      head: 'abc',
      compilerOptionsHash: hashCompilerOptions({ module: 'commonjs', paths: { a: ['b'] }, outDir: 'dist' }),
    });
    const sameOptsAgain = emitCacheKey({
      ...base,
      head: 'abc',
      compilerOptionsHash: hashCompilerOptions({ outDir: 'other', paths: { z: ['y'] }, module: 'commonjs' }),
    });
    assert.equal(sameOpts.full, sameOptsAgain.full);
    const otherOpt = emitCacheKey({
      ...base,
      head: 'abc',
      compilerOptionsHash: hashCompilerOptions({ module: 'esnext' }),
    });
    assert.notEqual(sameOpts.full, otherOpt.full);
    assert.equal(sameOpts.short.length, 12);
    const otherPolicy = checkBaseKey({ ...base, head: 'abc', policyStatus: 'strict' });
    const permissive = checkBaseKey({ ...base, head: 'abc', policyStatus: 'permissive' });
    assert.notEqual(otherPolicy.full, permissive.full);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dirty lib and the client app never use the cache', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-use-'));
  try {
    const lib = repo(root, 'mls-2', 'export const a = 1;\n');
    const app = repo(root, 'mls-9', 'export const app = 1;\n');
    const clean = plan(['2', '9'], '9', { 2: lib, 9: app });
    assert.equal(clean.find((item) => item.id === '2').eligible, true);
    assert.equal(clean.find((item) => item.id === '9').eligible, false);
    writeFileSync(join(lib, 'l1', 'b.ts'), 'export const b = 1;\n');
    const dirty = plan(['2', '9'], '9', { 2: lib, 9: app });
    assert.equal(dirty.find((item) => item.id === '2').eligible, false);
    assert.equal(shouldUseCache({
      projectId: '2', clientId: '9', head: null, porcelain: null,
    }), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('incomplete cache entry is ignored', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-entry-'));
  try {
    const key = 'a'.repeat(64);
    mkdirSync(join(root, 'emit', '1', key, 'tree'), { recursive: true });
    const missing = await loadEmit(root, '1', key);
    assert.equal(missing.hit, false);
    assert.match(missing.reason, /incomplete/);

    const baseKey = 'b'.repeat(64);
    mkdirSync(join(root, 'check', '1', baseKey, 'old'), { recursive: true });
    writeFileSync(join(root, 'check', '1', baseKey, 'old', 'report.json'), '{"reportLine":"x"}\n');
    const badCheck = await loadCheck(root, '1', baseKey, () => ({ head: 'h', porcelain: '' }));
    assert.equal(badCheck.hit, false);
    assert.match(badCheck.reason, /incomplete/);

    mkdirSync(join(root, key), { recursive: true });
    assert.match(legacyCacheReason(root), /legacy layout/);

    const src = join(root, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.js'), 'export const a = 1;\n');
    const full = 'c'.repeat(64);
    await writeEmitEntry({ cacheRoot: root, id: '1', key: full, treeSource: src });
    const loaded = await loadEmit(root, '1', full);
    assert.equal(loaded.hit, true);
    assert.equal(readFileSync(join(loaded.tree, 'a.js'), 'utf8'), 'export const a = 1;\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a commit invalidates one lib emit and the checks that loaded it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-deps-'));
  try {
    const dirs = {
      a: repo(root, 'mls-a', 'export const a = 1;\n'),
      b: repo(root, 'mls-b', 'export const b = 1;\n'),
      c: repo(root, 'mls-c', 'export const c = 1;\n'),
    };
    const cache = join(root, 'cache');
    const src = join(root, 'tree');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.js'), 'export const a = 1;\n');
    const before = Object.fromEntries(plan(['a', 'b', 'c'], 'app', dirs).map((item) => [item.id, item]));
    const headA = lookup(dirs)('a').head;
    for (const id of ['a', 'b', 'c']) {
      await writeEmitEntry({ cacheRoot: cache, id, key: before[id].emitKey, treeSource: src });
    }
    await writeCheckEntry({
      cacheRoot: cache, id: 'b', baseKey: before.b.checkBase, report, deps: [],
    });
    await writeCheckEntry({
      cacheRoot: cache, id: 'c', baseKey: before.c.checkBase, report, deps: [{ id: 'a', head: headA }],
    });
    await writeCheckEntry({
      cacheRoot: cache, id: 'a', baseKey: before.a.checkBase, report, deps: [],
    });

    writeFileSync(join(dirs.a, 'l1', 'a.ts'), 'export const a = 2;\n');
    git(dirs.a, ['add', '.']);
    git(dirs.a, ['commit', '-m', 'next']);
    const after = Object.fromEntries(plan(['a', 'b', 'c'], 'app', dirs).map((item) => [item.id, item]));
    assert.notEqual(before.a.emitKey, after.a.emitKey);
    assert.equal(before.b.emitKey, after.b.emitKey);
    assert.equal(before.c.emitKey, after.c.emitKey);
    assert.equal((await loadEmit(cache, 'b', after.b.emitKey)).hit, true);
    assert.equal((await loadEmit(cache, 'c', after.c.emitKey)).hit, true);
    assert.equal((await loadEmit(cache, 'a', after.a.emitKey)).hit, false);

    const see = lookup(dirs);
    assert.equal((await loadCheck(cache, 'b', after.b.checkBase, see)).hit, true);
    const loadedC = await loadCheck(cache, 'c', after.c.checkBase, see);
    assert.equal(loadedC.hit, false);
    assert.match(loadedC.reason, /mls-a head changed/);
    assert.equal((await loadCheck(cache, 'a', after.a.checkBase, see)).reason, 'miss');

    writeFileSync(join(dirs.a, 'l1', 'dirty.ts'), 'export const d = 1;\n');
    const dirtySee = lookup(dirs);
    const dirtyC = await loadCheck(cache, 'c', before.c.checkBase, dirtySee);
    assert.equal(dirtyC.hit, false);
    assert.match(dirtyC.reason, /mls-a is dirty/);
    assert.equal((await loadEmit(cache, 'b', after.b.emitKey)).hit, true);
    assert.equal((await loadEmit(cache, 'c', after.c.emitKey)).hit, true);
    assert.equal(emitCacheKey({ ...base, head: 'only-b' }).full, emitCacheKey({ ...base, head: 'only-b' }).full);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the fourth write of a lib keeps the three newest', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-prune-'));
  try {
    const src = join(root, 'tree');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.js'), '1\n');
    const keys = ['1', '2', '3', '4'].map((n) => n.repeat(64));
    for (const key of keys) {
      await writeEmitEntry({ cacheRoot: root, id: '7', key, treeSource: src });
    }
    const left = readdirSync(join(root, 'emit', '7')).filter((name) => !name.startsWith('.'));
    assert.deepEqual(left.sort(), ['2', '3', '4'].map((n) => n.repeat(64)).sort());
    assert.equal((await loadEmit(root, '7', keys[3])).hit, true);
    assert.equal((await loadEmit(root, '7', keys[0])).hit, false);

    for (const n of ['1', '2', '3', '4']) {
      await writeCheckEntry({
        cacheRoot: root,
        id: '7',
        baseKey: n.repeat(64),
        report,
        deps: [],
      });
    }
    const bases = readdirSync(join(root, 'check', '7')).filter((name) => !name.startsWith('.'));
    assert.equal(bases.length, 3);
    assert.equal(bases.includes('1'.repeat(64)), false);
    assert.equal((await loadCheck(root, '7', '4'.repeat(64), () => ({ head: null, porcelain: '' }))).hit, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listFiles paths become loadedProjectIds and stay out of the report', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt155-files-'));
  try {
    const id = '1';
    mkdirSync(join(root, `mls-${id}`, 'l1'), { recursive: true });
    const err = 'mls-1/l1/a.ts(1,1): error TS2345: no';
    const output = [
      `/tmp/mls-102029/l1/a.ts`,
      `/tmp/mls-${id}/l1/b.ts`,
      '/tmp/node_modules/typescript/lib/lib.ts',
      err,
    ].join('\n');
    const withFiles = typeCheckProject({
      root,
      projectId: id,
      spawnTsc: () => ({ status: 2, fatal: false, output }),
    });
    const plain = typeCheckProject({
      root,
      projectId: id,
      spawnTsc: () => ({ status: 2, fatal: false, output: err }),
    });
    assert.deepEqual(withFiles.loadedProjectIds, ['102029']);
    assert.equal(withFiles.marker, plain.marker);
    assert.equal(withFiles.reportLine, plain.reportLine);
    assert.deepEqual(withFiles.excerpt, plain.excerpt);
    assert.equal(withFiles.verdict.block, plain.verdict.block);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
