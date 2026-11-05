import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RollbackRefused, aliasPath, rollbackRelease } from './rollbackRelease.mjs';
import { readPendingNotice, recordsDir } from './releaseRecord.mjs';

function release(root, id, stamp = {}) {
  mkdirSync(join(root, 'releases', id, 'dist'), { recursive: true });
  writeFileSync(join(root, 'releases', id, 'release.json'), JSON.stringify({ id, client: '102047', platformCommit: `p-${id}`, versionRef: `v-${id}`, libs: '1', monaco: '2', deps: {}, ...stamp }));
}

function tree(kind) {
  const base = mkdtempSync(join(tmpdir(), 'rollback-'));
  const root = kind === 'project' ? join(base, 'app102047', 'mls-base') : join(base, 'mls-base');
  mkdirSync(root, { recursive: true });
  release(root, '20261105100000');
  release(root, '20261105110000');
  symlinkSync(join(root, 'releases', '20261105110000'), aliasPath(root, '102047'));
  return { base, root };
}

const fakes = (extra = {}) => {
  const calls = { reload: 0, health: [] };
  return {
    calls,
    options: {
      reload: () => { calls.reload += 1; },
      health: async (url) => { calls.health.push(url); },
      log: () => {},
      env: { COLLAB_VM_ID: 'vm-t', COLLAB_RELEASE_REQUESTED_BY: 'user-3' },
      ...extra,
    },
  };
};

for (const kind of ['old', 'project']) {
  test(`goes back to a kept release in the ${kind} tree, reloads pm2, waits for health and records the return`, async () => {
    const { base, root } = tree(kind);
    try {
      const { calls, options } = fakes();
      const result = await rollbackRelease({ root, projectId: '102047', releaseId: '20261105100000', ...options });
      assert.deepEqual([result.from, result.to], ['20261105110000', '20261105100000']);
      assert.equal(readlinkSync(aliasPath(root, '102047')), join(root, 'releases', '20261105100000'));
      assert.equal(calls.reload, 1);
      assert.deepEqual(calls.health, ['http://127.0.0.1:2047/health']);
      assert.equal(readdirSync(join(root, 'releases')).filter((name) => name.includes('rollback')).length, 0, 'no temporary link is left');
      const dir = recordsDir(root, 'app');
      const [file] = readdirSync(dir).filter((name) => name.endsWith('.json'));
      const record = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      assert.equal(record.versaoContrato, 2);
      assert.equal(record.resultado, 'ok');
      assert.equal(record.fila, 'app');
      assert.equal(record.projetoId, 102047);
      assert.equal(record.anterior, '20261105110000');
      assert.equal(record.pedidoPor, 'user-3');
      assert.deepEqual(record.passos.map((step) => step.nome), ['voltar:20261105100000']);
      assert.equal(record.pecas.app.commit, 'v-20261105100000', 'the pieces are those of the restored release');
      assert.equal(record.pecas.app.commitAnterior, 'v-20261105110000');
      assert.deepEqual(readPendingNotice(dir, record.releaseId), ['release.started', 'release.finished']);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
}

test('a release that is not on disk any more is refused with the reason, and nothing changes', async () => {
  const { base, root } = tree('old');
  try {
    const { calls, options } = fakes();
    await assert.rejects(() => rollbackRelease({ root, projectId: '102047', releaseId: '20261101000000', ...options }), (error) => error instanceof RollbackRefused && /not on disk any more/u.test(error.message));
    assert.equal(readlinkSync(aliasPath(root, '102047')), join(root, 'releases', '20261105110000'));
    assert.equal(calls.reload, 0);
    await assert.rejects(() => rollbackRelease({ root, projectId: '102047', releaseId: '20261105110000', ...options }), /already the active one/u);
    await assert.rejects(() => rollbackRelease({ root, projectId: '102047', releaseId: 'latest', ...options }), /14 digits/u);
    assert.equal(readdirSync(join(root, 'releases')).includes('registro'), false, 'a refusal writes no record');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('a health failure puts the previous release back, reloads again and records falhou', async () => {
  const { base, root } = tree('project');
  try {
    const { calls, options } = fakes({ health: async () => { throw new Error('health http://127.0.0.1:2047/health not ready after 60000 ms: ECONNREFUSED'); } });
    await assert.rejects(() => rollbackRelease({ root, projectId: '102047', releaseId: '20261105100000', ...options }), /not ready/u);
    assert.equal(readlinkSync(aliasPath(root, '102047')), join(root, 'releases', '20261105110000'), 'the release that was running is back');
    assert.equal(calls.reload, 2, 'once to go, once to come back');
    const dir = recordsDir(root, 'app');
    const [file] = readdirSync(dir).filter((name) => name.endsWith('.json'));
    const record = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.equal(record.resultado, 'falhou');
    assert.equal(record.falha.passo, 'voltar');
    assert.equal(record.anterior, '20261105110000');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('--dry-run says what it would do and changes nothing', async () => {
  const { base, root } = tree('old');
  try {
    const lines = [];
    const { calls, options } = fakes({ log: (line) => lines.push(line) });
    const result = await rollbackRelease({ root, projectId: '102047', releaseId: '20261105100000', dryRun: true, ...options });
    assert.equal(result.dryRun, true);
    assert.match(lines[0], /dry-run: .*current-102047 20261105110000 -> 20261105100000; reaponta current-102047, pm2, health on app2047 port 2047/u);
    assert.equal(readlinkSync(aliasPath(root, '102047')), join(root, 'releases', '20261105110000'));
    assert.equal(calls.reload, 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
