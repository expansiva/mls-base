import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHIP_LEVELS, shipLevelsFor } from './buildCI.mjs';

test('master backend ships l2 and l4', () => {
  assert.deepEqual(shipLevelsFor('master backend'), ['l2', 'l4']);
});

test('lib ships l2 and l4', () => {
  assert.deepEqual(shipLevelsFor('lib'), ['l2', 'l4']);
});

test('client ships only l2', () => {
  assert.deepEqual(shipLevelsFor('client'), ['l2']);
});

test('missing projectType ships only l2', () => {
  assert.deepEqual(shipLevelsFor(undefined), ['l2']);
  assert.deepEqual(shipLevelsFor(''), ['l2']);
});

test('SHIP_LEVELS stays the client default', () => {
  assert.deepEqual(SHIP_LEVELS, ['l2']);
});
