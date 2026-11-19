import test from 'node:test';
import assert from 'node:assert/strict';
import { browserJsFromEmit, shipRel } from './pack.mjs';

test('browserJsFromEmit drops the sourceMappingURL line the cache emits', () => {
  const js = 'export const a = 1;\n//# sourceMappingURL=a.js.map\n';
  assert.equal(browserJsFromEmit(js), 'export const a = 1;\n');
  assert.equal(browserJsFromEmit('export const a = 1;\n'), 'export const a = 1;\n');
});

test('shipRel drops the files the code tsconfig excludes', () => {
  assert.equal(shipRel('monitor/web/shared/process.test.js'), false);
  assert.equal(shipRel('monitor/web/shared/process.js'), true);
  assert.equal(shipRel('nodejsHost/main.js'), false);
  assert.equal(shipRel('fixtures/sample.js'), false);
});
