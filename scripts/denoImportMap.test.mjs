import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DENO_JSON_NAME,
  buildImports,
  renderDenoJson,
  writeDenoJson,
} from './denoImportMap.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'deno-import-map-'));
  try {
    mkdirSync(join(root, 'mls-102034'));
    mkdirSync(join(root, 'mls-100554'));
    mkdirSync(join(root, 'not-mls'));
    writeFileSync(join(root, 'mls-file'), '');
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('buildImports: uma entrada por pasta mls-*, chave /_<id>_/', () => {
  withRoot((root) => {
    assert.deepEqual(buildImports(root), {
      '/_100554_/': './mls-100554/',
      '/_102034_/': './mls-102034/',
    });
  });
});

test('writeDenoJson é idempotente e inclui sloppy-imports', () => {
  withRoot((root) => {
    const dest = writeDenoJson(root);
    assert.equal(DENO_JSON_NAME, 'deno.check.json');
    assert.equal(dest, join(root, 'deno.check.json'));
    assert.equal(existsSync(join(root, 'deno.json')), false);
    const first = readFileSync(dest, 'utf8');
    writeDenoJson(root);
    const second = readFileSync(dest, 'utf8');
    assert.equal(first, second);
    const parsed = JSON.parse(first);
    assert.deepEqual(parsed.unstable, ['sloppy-imports']);
    assert.equal(parsed.nodeModulesDir, 'auto');
    assert.equal(parsed.imports['/_102034_/'], './mls-102034/');
    assert.equal(first, renderDenoJson(parsed));
  });
});

test('mls-base: mapa cobre o 102034 e gravar duas vezes não muda o arquivo', () => {
  const dest = writeDenoJson(MLS_BASE);
  assert.equal(dest, join(MLS_BASE, 'deno.check.json'));
  assert.equal(existsSync(join(MLS_BASE, 'deno.json')), false);
  const first = readFileSync(dest, 'utf8');
  writeDenoJson(MLS_BASE);
  assert.equal(readFileSync(dest, 'utf8'), first);
  const parsed = JSON.parse(first);
  assert.equal(parsed.imports['/_102034_/'], './mls-102034/');
  assert.equal(Object.keys(parsed.imports).some((k) => k.startsWith('file:')), false);
});
