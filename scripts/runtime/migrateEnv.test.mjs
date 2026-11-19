import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envFileValue, planManualMigrate } from './migrateEnv.mjs';

const PASSWORD = 'migrate_secret_not_for_the_log';

function box(appEnv, envText) {
  const root = mkdtempSync(join(tmpdir(), 'migrate-env-'));
  mkdirSync(join(root, 'mls-102047', 'l5'), { recursive: true });
  writeFileSync(join(root, 'mls-102047', 'l5', 'project.json'), `${JSON.stringify({ appEnv })}\n`);
  if (envText != null) writeFileSync(join(root, '.env'), envText);
  const config = { projects: { '102047': { type: 'client' }, '102034': { type: 'master backend' } } };
  return { root, config };
}

test('presentation com URL de teste: o migrate recebe DATABASE_URL_TEST e o log não tem senha', () => {
  const { root, config } = box('presentation', `PGUSER=migrate_user\nPGPASSWORD=${PASSWORD}\n`);
  try {
    const plan = planManualMigrate(root, config, { PGDATABASE: 'mdm', PGPASSWORD: PASSWORD });
    assert.equal(plan.refused, false);
    assert.match(plan.migrateEnv.DATABASE_URL_TEST, /\/collab_app_test$/);
    assert.match(plan.line, /project=102047/);
    assert.match(plan.line, /appEnv=presentation/);
    assert.match(plan.line, /database=collab_app_test/);
    assert.equal(plan.line.includes(PASSWORD), false);
    assert.equal(plan.line.includes('migrate_user'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('presentation sem URL de teste: para e não há ambiente de migrate', () => {
  const { root, config } = box('presentation', 'PGUSER=migrate_user\n');
  try {
    const plan = planManualMigrate(root, config, { PGDATABASE: 'mdm', PGPASSWORD: PASSWORD });
    assert.equal(plan.refused, true);
    assert.equal(plan.migrateEnv, undefined);
    assert.match(plan.message, /no test database URL/);
    assert.equal(plan.message.includes(PASSWORD), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('produção: roda sem DATABASE_URL_TEST e nomeia o banco padrão', () => {
  const { root, config } = box('production', `PGUSER=migrate_user\nPGPASSWORD=${PASSWORD}\n`);
  try {
    const plan = planManualMigrate(root, config, { PGDATABASE: 'mdm', PGPASSWORD: PASSWORD });
    assert.equal(plan.refused, false);
    assert.equal(plan.migrateEnv, undefined);
    assert.match(plan.line, /appEnv=production/);
    assert.match(plan.line, /database=mdm/);
    assert.equal(plan.line.includes(PASSWORD), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('o nome do banco do app de produção vem do .env da release, sem usuário nem senha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-env-file-'));
  try {
    const file = join(dir, '.env');
    writeFileSync(file, '# comment\nPGUSER=ubuntu\nPGPASSWORD=never-printed\nPGDATABASE=collab_prod\n');
    assert.equal(envFileValue(file, 'PGDATABASE'), 'collab_prod');
    assert.equal(envFileValue(file, 'PGMISSING'), '');
    assert.equal(envFileValue(join(dir, 'nope'), 'PGDATABASE'), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
