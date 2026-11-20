import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { scanBrowserL1Imports, shipsAsBrowserJs, valueL1Imports } from './browserL1Import.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PLANTED = "import { a } from '/_102034_/l1/server/layer_1_external/connections/catalogs/cm.js';\n";

/**
 * @param {Record<string, string>} files paths under mls-9/
 */
function scanFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'browser-l1-'));
  try {
    for (const [rel, text] of Object.entries(files)) {
      const abs = join(dir, 'mls-9', rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
    }
    return scanBrowserL1Imports(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('shipsAsBrowserJs follows shipRel', () => {
  assert.equal(shipsAsBrowserJs('l2/shared/contracts/connections/cm.ts'), true);
  assert.equal(shipsAsBrowserJs('l2/fixtures/sample.ts'), false);
  assert.equal(shipsAsBrowserJs('l2/newRelease/helpers/reviewStart.test.ts'), false);
  assert.equal(shipsAsBrowserJs('l2/web/page.spec.js'), false);
  assert.equal(shipsAsBrowserJs('l2/nodejsHost/main.js'), false);
});

test('HEAD browser files have no value import from l1', () => {
  const hits = scanBrowserL1Imports(ROOT);
  assert.deepEqual(hits, [], hits.map((hit) => `${hit.file} ${hit.spec}`).join('\n'));
});

test('a planted value import in a test l2 names the file and the import', () => {
  const hits = scanFixture({ 'l2/shared/plant.js': PLANTED });
  assert.deepEqual(hits, [{
    file: 'mls-9/l2/shared/plant.js',
    spec: '/_102034_/l1/server/layer_1_external/connections/catalogs/cm.js',
  }]);
});

test('fixtures, tests and import type stay out', () => {
  const hits = scanFixture({
    'l2/fixtures/sample.js': PLANTED,
    'l2/newRelease/helpers/reviewStart.test.js': PLANTED,
    'l2/web/page.spec.js': PLANTED,
    'l2/shared/types.ts': "import type { Item } from '/_102034_/l1/workflow/assistantCatalog.js';\n",
  });
  assert.deepEqual(hits, []);
  assert.deepEqual(valueL1Imports("import type { Item } from '/_102034_/l1/workflow/assistantCatalog.js';\n", 'l2/shared/types.ts'), []);
});
