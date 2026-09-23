import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { updateTsconfigPaths } from './runtime/addNewVersion.mjs';
import { addMissingTsconfigPaths, pathIdsOf, versionedTsconfigPathsFile } from './syncTsconfigPaths.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readConfig(name) {
  const file = join(ROOT, name);
  const result = ts.readConfigFile(file, ts.sys.readFile);
  assert.equal(result.error, undefined, `${name} must exist and contain valid JSONC`);
  return result.config;
}

test('browser, backend, aggregate and test runtime inherit the shared base directly', () => {
  const base = readConfig('tsconfig.base.json');
  assert.deepEqual(Object.keys(base), ['compilerOptions']);
  assert.ok(base.compilerOptions.paths['/_102020_/*']);

  for (const name of ['tsconfig.json', 'tsconfig.frontend.json', 'tsconfig.backend.json']) {
    assert.equal(readConfig(name).extends, './tsconfig.base.json', `${name} must extend the shared base`);
  }
  assert.equal(readConfig('test/tsconfig.runtime.json').extends, '../tsconfig.base.json');
  assert.equal(versionedTsconfigPathsFile(ROOT), join(ROOT, 'tsconfig.base.json'));
});

test('browser excludes Node/test evidence and does not receive Node globals', () => {
  const frontend = readConfig('tsconfig.frontend.json');
  const excluded = new Set(frontend.exclude);
  for (const pattern of ['**/*.test.ts', '**/nodejs*', '**/l2/certificacao/**/*']) {
    assert.ok(excluded.has(pattern), `frontend must exclude ${pattern}`);
  }
  assert.deepEqual(frontend.compilerOptions.types, []);
});

test('backend and test runtime declare their distinct host environments', () => {
  const backend = readConfig('tsconfig.backend.json');
  assert.deepEqual(backend.compilerOptions.types, ['node']);
  assert.deepEqual(backend.compilerOptions.lib, ['ES2022']);

  const runtime = readConfig('test/tsconfig.runtime.json');
  assert.deepEqual(runtime.compilerOptions.types, ['node']);
  assert.deepEqual(runtime.compilerOptions.lib, ['ES2022', 'DOM', 'DOM.Iterable']);
  assert.equal(runtime.compilerOptions.noEmit, true);
});

test('alias writers update the shared base while the VM config extends the aggregate config', () => {
  const root = mkdtempSync(join(tmpdir(), 'tsconfig-boundary-'));
  try {
    const baseFile = join(root, 'tsconfig.base.json');
    const rootFile = join(root, 'tsconfig.json');
    writeFileSync(baseFile, '{"compilerOptions":{"paths":{"/_100554_/*":["./mls-100554/*"]}}}\n');
    writeFileSync(rootFile, '{"extends":"./tsconfig.base.json","include":["**/l2/**/*"]}\n');
    mkdirSync(join(root, 'mls-102077', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102077', 'l5', 'config.json'), '{}\n');

    assert.deepEqual(addMissingTsconfigPaths(root), ['102077']);
    assert.deepEqual(pathIdsOf(readFileSync(baseFile, 'utf8')), ['100554', '102077']);
    assert.equal(readFileSync(rootFile, 'utf8'), '{"extends":"./tsconfig.base.json","include":["**/l2/**/*"]}\n');

    assert.deepEqual(updateTsconfigPaths(root, ['102088']), ['100554', '102077', '102088']);
    const vm = JSON.parse(readFileSync(join(root, 'tsconfig.vm.json'), 'utf8'));
    assert.equal(vm.extends, './tsconfig.json');
    assert.deepEqual(Object.keys(vm.compilerOptions.paths), ['/_100554_/*', '/_102077_/*', '/_102088_/*']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
