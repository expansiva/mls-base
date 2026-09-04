import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MLS_BASE = join(dirname(fileURLToPath(import.meta.url)), '..');

test('.npmrc da raiz desliga frozen-lockfile e so isso (Wagner 04/09)', () => {
  const npmrc = readFileSync(join(MLS_BASE, '.npmrc'), 'utf8');
  const lines = npmrc.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(lines, ['frozen-lockfile=false']);
});
