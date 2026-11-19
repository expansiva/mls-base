import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitProject, rebaseSourceMap } from './emitProject.mjs';

const LEVELS = ['core', 'l1', 'l2'];

function writeBin(root, name, body) {
  const binDir = join(root, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  const file = join(binDir, name);
  writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(file, 0o755);
}

function compilerBin(logPath, versionLine) {
  return `
    const fs = require('fs');
    if (process.argv[2] === '-v') { console.log(${JSON.stringify(versionLine)}); process.exit(0); }
    if (process.argv.includes('-p')) fs.appendFileSync(${JSON.stringify(logPath)}, 'emit\\n');
    process.exit(0);
  `;
}

function seed(root) {
  writeFileSync(join(root, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2022"}}\n');
  mkdirSync(join(root, 'node_modules', 'typescript'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'typescript', 'package.json'), '{"version":"5.9.0"}\n');
  for (const [level, body] of [
    ['l1', 'export const a = 1;\n'],
    ['l2', 'export const b = 2;\n'],
    ['l3', 'export const c = 3;\n'],
    ['l5', 'export const e = 5;\n'],
    ['l6', 'export const f = 6;\n'],
    ['l7', 'export const g = 7;\n'],
  ]) {
    const dir = join(root, 'mls-9', level);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'mod.ts'), body);
  }
}

function emitCount(logPath) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').filter((line) => line === 'emit').length;
  } catch {
    return 0;
  }
}

test('same tree hits without emitting; l1 or l2 misses; other levels, compiler and version miss only when they are part of the key', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emit-project-'));
  const logPath = join(root, 'emit.log');
  const lines = [];
  const prev = console.log;
  console.log = (line) => { lines.push(String(line)); };
  try {
    seed(root);
    writeBin(root, 'tsrs', compilerBin(logPath, 'tsrs 1.0.0'));
    writeBin(root, 'tsc', compilerBin(logPath, 'tsc 5.9.0'));
    const env = {};

    const first = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(first.hit, false);
    assert.equal(emitCount(logPath), 1);

    const second = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(second.hit, true);
    assert.equal(second.dir, first.dir);
    assert.equal(emitCount(logPath), 1);

    writeFileSync(join(root, 'mls-9', 'l1', 'mod.ts'), 'export const a = 2;\n');
    const l1 = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(l1.hit, false);
    assert.notEqual(l1.dir, second.dir);
    assert.equal(emitCount(logPath), 2);

    writeFileSync(join(root, 'mls-9', 'l2', 'mod.ts'), 'export const b = 3;\n');
    const l2 = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(l2.hit, false);
    assert.equal(emitCount(logPath), 3);

    for (const level of ['l3', 'l5', 'l6', 'l7']) {
      writeFileSync(join(root, 'mls-9', level, 'mod.ts'), `export const changed = '${level}';\n`);
    }
    const untouched = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(untouched.hit, true);
    assert.equal(untouched.dir, l2.dir);
    assert.equal(emitCount(logPath), 3);

    writeBin(root, 'tsrs', compilerBin(logPath, 'tsrs 2.0.0'));
    const version = await emitProject(root, '9', { levels: LEVELS, env });
    assert.equal(version.hit, false);
    assert.notEqual(version.dir, l2.dir);
    assert.equal(emitCount(logPath), 4);

    const other = await emitProject(root, '9', { levels: LEVELS, env: { COLLAB_TS_COMPILER: 'tsc' } });
    assert.equal(other.hit, false);
    assert.notEqual(other.dir, version.dir);
    assert.equal(emitCount(logPath), 5);

    assert.deepEqual(lines.filter((line) => line.startsWith('emit mls-')), [
      'emit mls-9: miss (tsrs)',
      'emit mls-9: hit (tsrs)',
      'emit mls-9: miss (tsrs)',
      'emit mls-9: miss (tsrs)',
      'emit mls-9: hit (tsrs)',
      'emit mls-9: miss (tsrs)',
      'emit mls-9: miss (tsc)',
    ]);
  } finally {
    console.log = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test('rebaseSourceMap re-points sources from the cache folder to the folder the map was copied to', () => {
  const root = '/r';
  const fromDir = join(root, '.buildCache', 'emit', '9', 'k', 'mls-9', 'l2');
  const toDir = join(root, 'dist', 'local', '_9_', 'l2');
  const text = JSON.stringify({ version: 3, file: 'a.js', sources: ['../../../../../../mls-9/l2/a.ts'], mappings: 'AAAA' });
  const out = JSON.parse(rebaseSourceMap(text, fromDir, toDir));
  assert.deepEqual(out.sources, ['../../../../mls-9/l2/a.ts']);
  assert.equal(out.mappings, 'AAAA');
});
