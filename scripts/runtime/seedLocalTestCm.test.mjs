import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertBenchStorage,
  loadInstalledCm,
  parseArgs,
  seedLocalTestCm,
} from './seedLocalTestCm.mjs';

const SECRET = 'aws-secret-do-not-print';

function storage(prefix = 'desenv_', extra = {}) {
  return { tablePrefix: prefix, bucket: 'bench-bucket', dynamoRegion: 'us-west-1', ...extra };
}

function harness(usersByEmail = new Map()) {
  const writes = [];
  const locks = [];
  let seq = 0;
  class UserRecord {
    constructor() {
      this.userData = { userId: '', name: '', status: 'active', threads: [], kind: 'human' };
    }
    async create(perfil) {
      if (this.userData.userId !== '') return false;
      seq += 1;
      this.userData.userId = `20261018000000.${seq}`;
      writes.push({ ...this.userData });
      await perfil.io.users.addOrUpdate({ ...this.userData });
      return true;
    }
  }
  const perfil = {
    io: {
      lock: {
        async enterCritical(key) { locks.push(['enter', key]); return true; },
        async leaveCritical(key) { locks.push(['leave', key]); },
      },
      users: {
        async findByEmail(email) { return usersByEmail.get(email); },
        async addOrUpdate(user) { usersByEmail.set(user.email, user); },
      },
    },
  };
  return {
    writes,
    locks,
    usersByEmail,
    loaded: {
      version: 'test',
      config: { aws: { secretAccessKey: SECRET }, storage: storage() },
      resolvedStorage: storage(),
      getPerfil() { return perfil; },
      UserRecord,
    },
  };
}

test('prefixo ausente ou produtivo recusa antes de qualquer write', async () => {
  for (const prefix of ['', 'prod_', undefined]) {
    const box = harness();
    let perfilCalled = false;
    box.loaded.resolvedStorage = { bucket: 'bench-bucket', dynamoRegion: 'us-west-1', tablePrefix: prefix };
    box.loaded.getPerfil = () => { perfilCalled = true; throw new Error('perfil'); };
    await assert.rejects(() => seedLocalTestCm(box.loaded, '102047'), /refusing cm storage prefix/);
    assert.equal(perfilCalled, false);
    assert.equal(box.writes.length, 0);
  }
  assert.throws(() => assertBenchStorage({ tablePrefix: 'desenv_' }), /declared local destination/);
});

test('cria os dois humanos e a repetição devolve os mesmos ids sem novo write', async () => {
  const box = harness();
  const first = await seedLocalTestCm(box.loaded, '102047');
  const second = await seedLocalTestCm(box.loaded, '102047');
  assert.equal(first.storagePrefix, 'desenv_');
  assert.deepEqual(first.personas.map((p) => p.alias), ['responsavel', 'membro']);
  assert.deepEqual(second.personas.map((p) => p.cmUserId), first.personas.map((p) => p.cmUserId));
  assert.equal(box.writes.length, 2);
  assert.equal(box.writes[0].kind, 'human');
  assert.equal(box.writes[0].email, 'responsavel.102047@runtime.test');
  assert.equal(box.writes[0].sub, 'local-test:102047:responsavel');
  assert.equal(box.writes[0].name, 'Bench responsible');
  assert.equal(JSON.stringify(first).includes(SECRET), false);
  assert.deepEqual(box.locks.map((entry) => entry[0]), ['enter', 'leave', 'enter', 'leave']);
});

test('humano com sub divergente ou não humano é erro e não cria outro', async () => {
  const email = 'membro.102047@runtime.test';
  const box = harness(new Map([
    ['responsavel.102047@runtime.test', {
      userId: 'kept', name: 'Bench responsible', kind: 'human', sub: 'local-test:102047:responsavel', email: 'responsavel.102047@runtime.test',
    }],
    [email, { userId: 'other', name: 'x', kind: 'human', sub: 'someone-else', email }],
  ]));
  await assert.rejects(() => seedLocalTestCm(box.loaded, '102047'), /not the local bench human/);
  assert.equal(box.writes.length, 0);
  assert.equal(box.locks.at(-1)[0], 'leave');

  const agent = harness(new Map([
    ['responsavel.102047@runtime.test', {
      userId: 'agent', kind: 'agent', sub: 'local-test:102047:responsavel', email: 'responsavel.102047@runtime.test',
    }],
  ]));
  await assert.rejects(() => seedLocalTestCm(agent.loaded, '102047'), /not the local bench human/);
  assert.equal(agent.writes.length, 0);
});

test('export ausente cita a versão instalada', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cm-seed-'));
  try {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9-test', type: 'module' }));
    mkdirSync(path.join(root, 'dist/helpers'), { recursive: true });
    mkdirSync(path.join(root, 'dist/layer_1_external'), { recursive: true });
    mkdirSync(path.join(root, 'dist/layer_3_usecases'), { recursive: true });
    writeFileSync(path.join(root, 'dist/helpers/config.js'), 'export const config = {};\n');
    writeFileSync(path.join(root, 'dist/layer_1_external/perfil.js'), 'export function getPerfil() { return {}; }\n');
    writeFileSync(path.join(root, 'dist/layer_3_usecases/users.js'), 'export const unused = 1;\n');
    await assert.rejects(() => loadInstalledCm(root), /cm 9\.9\.9-test missing export/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('argv sem cm-root ou projeto recusa antes de importar', () => {
  assert.throws(() => parseArgs(['--project', '102047']), /--cm-root is required/);
  assert.throws(() => parseArgs(['--cm-root', '/opt/cm']), /project id/);
  assert.deepEqual(parseArgs(['--cm-root', '/opt/cm', '--project', '102047']), {
    cmRoot: '/opt/cm',
    project: '102047',
  });
});
