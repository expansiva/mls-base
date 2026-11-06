import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planVerification } from './releaseVerification.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');

test('rt192: libs nunca são verificadas; app permissive é adiado; app strict verifica antes', () => {
  const ids = ['102020', '102029', '102034', '102047'];
  const permissive = planVerification({ ids, clientId: '102047', statusOf: () => 'permissive' });
  assert.deepEqual(permissive, { now: [], deferred: ['102047'], skipped: ['102020', '102029', '102034'] });
  // lib strict continua sem verificação: só o app conta
  const strict = planVerification({ ids, clientId: '102047', statusOf: (id) => (id === '102047' || id === '102034' ? 'strict' : 'permissive') });
  assert.deepEqual(strict, { now: ['102047'], deferred: [], skipped: ['102020', '102029', '102034'] });
});

test('rt192: o app strict aparece uma vez só (um laço de verificação)', () => {
  const plan = planVerification({ ids: ['1', '2', '3'], clientId: '3', statusOf: () => 'strict' });
  assert.deepEqual(plan.now, ['3']);
  assert.equal(plan.now.length + plan.deferred.length + plan.skipped.length, 3);
});

test('rt192: a release chama o build com --release; o laço pula quem o plano não manda verificar', () => {
  assert.match(read('runtime/addNewVersion.mjs'), /node scripts\/build\.mjs --release\$\{clientArg\}/u);
  const build = read('build.mjs');
  assert.match(build, /else if \(argv\[i\] === '--release'\) args\.release = true;/u);
  assert.match(build, /planVerification\(/u);
  assert.match(build, /verification && !verification\.now\.includes\(String\(id\)\)/u);
});

test('rt192: buildProjectsObj --only só verifica com --typecheck; senão marca deferred', () => {
  const src = read('runtime/buildProjectsObj.mjs');
  assert.match(src, /const withTypeCheck = argv\.includes\('--typecheck'\);/u);
  assert.match(src, /if \(only && !withTypeCheck\) \{\s*console\.log\(`##typeCheck deferred project=\$\{id\} reason=release##`\);/u);
});
