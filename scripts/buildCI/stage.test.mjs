import test from 'node:test';
import assert from 'node:assert/strict';
import { isL4TracePath } from './stage.mjs';

test('isL4TracePath skips module and bare l4/trace dumps, not other layers', () => {
  assert.equal(isL4TracePath('/mls-102047/l4/petShop/trace/193-agent-cb-seeds.defs.ts'), true);
  assert.equal(isL4TracePath('/mls-102047/l4/trace/cb-health-report.json'), true);
  assert.equal(isL4TracePath('/mls-102047/l4/petShop/ontology/Pet.defs.ts'), false);
  assert.equal(isL4TracePath('/mls-102047/l2/petShop/trace/catalog.json'), false);
});
