import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SHARED_APPS, mainProjectOf, readSharedConfig, readSharedVersions, setMainProject, sharedAppByName,
} from './sharedApps.mjs';

function withEtc(fn) {
  const root = mkdtempSync(join(tmpdir(), 'shared-'));
  try {
    const etc = join(root, 'etc');
    mkdirSync(join(etc, 'projects'), { recursive: true });
    return fn(etc, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the register has the cm, with what is needed to find, update and watch it', () => {
  assert.equal(SHARED_APPS.length, 1);
  assert.deepEqual(sharedAppByName('cm'), {
    nome: 'cm', pasta: '/data/msg.collab.codes', arquivoVersao: 'node/collab-messages.version',
    comandoAtualizar: 'collab msg update', processos: ['msg', 'msg-worker'], porta: 8180,
  });
  assert.equal(sharedAppByName('other'), null);
});

test('the installed version comes from the register, and an app that is not installed is left out', () => {
  withEtc((_etc, root) => {
    mkdirSync(join(root, 'cm', 'node'), { recursive: true });
    writeFileSync(join(root, 'cm', 'node', 'collab-messages.version'), '20261102-155346\n');
    assert.deepEqual(readSharedVersions({ env: { COLLAB_MESSAGES_DEPLOY_ROOT: join(root, 'cm') } }), { cm: '20261102-155346' });
    assert.deepEqual(readSharedVersions({ env: { COLLAB_MESSAGES_DEPLOY_ROOT: join(root, 'none') } }), {});
  });
});

test('shared.json is read with the reason when it is missing, unreadable or not an object', () => {
  withEtc((etc) => {
    assert.match(readSharedConfig({ etcDir: etc }).reason, /does not exist/u);
    writeFileSync(join(etc, 'shared.json'), '{not json');
    assert.match(readSharedConfig({ etcDir: etc }).reason, /is unreadable/u);
    writeFileSync(join(etc, 'shared.json'), '[1]');
    assert.match(readSharedConfig({ etcDir: etc }).reason, /is not an object/u);
    writeFileSync(join(etc, 'shared.json'), '{"cm":{"projetoPrincipal":102056}}');
    assert.deepEqual(readSharedConfig({ etcDir: etc }), { config: { cm: { projetoPrincipal: 102056 } }, reason: '' });
  });
});

test('the main project: the sites variable, then shared.json, then the smallest id with a log line, else null', () => {
  withEtc((etc) => {
    const lines = [];
    assert.equal(mainProjectOf('cm', { env: {}, etcDir: etc, log: (line) => lines.push(line) }), null);
    writeFileSync(join(etc, 'projects', '102056.json'), '{}');
    writeFileSync(join(etc, 'projects', '102047.json'), '{}');
    assert.deepEqual(mainProjectOf('cm', { env: {}, etcDir: etc, log: (line) => lines.push(line) }), { projectId: '102047', source: 'menor projetoId' });
    assert.match(lines[0], /does not exist; the smallest of 2 projects \(102047\)/u);
    writeFileSync(join(etc, 'shared.json'), '{"cm":{"projetoPrincipal":102056}}');
    assert.deepEqual(mainProjectOf('cm', { env: {}, etcDir: etc }), { projectId: '102056', source: 'shared.json' });
    assert.deepEqual(mainProjectOf('cm', { env: { COLLAB_RELEASE_PROJECT_ID: '102099' }, etcDir: etc }), { projectId: '102099', source: 'COLLAB_RELEASE_PROJECT_ID' });
    assert.deepEqual(mainProjectOf('cm', { env: { COLLAB_RELEASE_PROJECT_ID: 'x' }, etcDir: etc }), { projectId: '102056', source: 'shared.json' }, 'not a number: ignored');
  });
});

test('set-main writes shared.json atomically, keeps other entries, is idempotent and has a dry-run', () => {
  withEtc((etc) => {
    const first = setMainProject('cm', '102047', { etcDir: etc });
    assert.deepEqual([first.changed, first.reason], [true, 'set']);
    assert.deepEqual(JSON.parse(readFileSync(join(etc, 'shared.json'), 'utf8')), { cm: { projetoPrincipal: 102047 } });
    assert.equal(setMainProject('cm', '102047', { etcDir: etc }).changed, false, 'same value: nothing to do');
    assert.equal(setMainProject('cm', '102056', { etcDir: etc, ifAbsent: true }).changed, false, 'an update never replaces it');
    assert.equal(JSON.parse(readFileSync(join(etc, 'shared.json'), 'utf8')).cm.projetoPrincipal, 102047);
    const dry = setMainProject('cm', '102056', { etcDir: etc, dryRun: true });
    assert.deepEqual([dry.changed, dry.dryRun], [true, true]);
    assert.equal(JSON.parse(readFileSync(join(etc, 'shared.json'), 'utf8')).cm.projetoPrincipal, 102047, 'dry-run wrote nothing');
    writeFileSync(join(etc, 'shared.json'), '{"future":{"x":1},"cm":{"projetoPrincipal":102047,"nota":"keep"}}');
    assert.equal(setMainProject('cm', '102056', { etcDir: etc }).reason, 'changed from 102047');
    assert.deepEqual(JSON.parse(readFileSync(join(etc, 'shared.json'), 'utf8')), { future: { x: 1 }, cm: { projetoPrincipal: 102056, nota: 'keep' } });
    assert.equal(readdirSync(etc).filter((name) => name.endsWith('.tmp')).length, 0);
    assert.throws(() => setMainProject('nope', '1', { etcDir: etc }), /unknown shared app/u);
    assert.throws(() => setMainProject('cm', 'abc', { etcDir: etc }), /not a number/u);
  });
});

test('the cli sets the main project without touching anything else, and shows it', () => {
  withEtc((etc) => {
    const script = join(import.meta.dirname, 'sharedApps.mjs');
    const out = execFileSync(process.execPath, [script, 'set-main', '--nome', 'cm', '--projeto', '102047', '--etc', etc], { encoding: 'utf8' });
    assert.match(out, /^set cm main project 102047/u);
    assert.match(execFileSync(process.execPath, [script, 'set-main', '--projeto', '102056', '--if-absent', '--etc', etc], { encoding: 'utf8' }), /^kept cm main project 102047 \(already set\)/u);
    assert.match(execFileSync(process.execPath, [script, 'set-main', '--projeto', '102056', '--dry-run', '--etc', etc], { encoding: 'utf8' }), /^would set/u);
    assert.equal(execFileSync(process.execPath, [script, 'show', '--etc', etc], { encoding: 'utf8' }).trim(), '{"cm":{"projetoPrincipal":102047}}');
    assert.equal(existsSync(join(etc, 'shared.json')), true);
  });
});
