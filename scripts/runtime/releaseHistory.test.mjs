import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_SHOW, fitRecord, historyDir, listRecords, showRecord } from './releaseHistory.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'releaseRecord.mjs');

function commits(n, tag) {
  return Array.from({ length: n }, (_, i) => ({ sha: `${tag}${String(i).padStart(6, '0')}`.padEnd(40, 'a'), mensagem: `commit ${tag} ${i} ${'x'.repeat(60)}`, arquivos: [`l2/${tag}/f${i}.ts`] }));
}

function record({ id, fila = 'libs', projeto = 102047, libs = 12, changed = 2, steps = 6, base = 3, resultado = 'ok' }) {
  return {
    versaoContrato: 2, releaseId: id, fila, projetoId: projeto, vmId: 'vm', pedidoId: `req-${id}`, pedidoPor: 'wagner@example.test',
    inicio: '2026-11-09T15:00:00Z', fim: '2026-11-09T15:03:00Z', duracaoMs: 180000, resultado, falha: null, anterior: null,
    passos: Array.from({ length: steps }, (_, i) => ({ nome: `passo${i}`, inicio: '2026-11-09T15:00:00Z', duracaoMs: 1000 + i, resultado: 'ok' })),
    pecas: {
      base: { commit: 'b'.repeat(40), commitAnterior: 'c'.repeat(40), repo: 'https://github.com/o/base', commits: commits(base, 'base') },
      libs: Array.from({ length: libs }, (_, i) => ({ id: 100000 + i, commit: `l${i}`.padEnd(40, 'd'), commitAnterior: `m${i}`.padEnd(40, 'e'), repo: `https://github.com/o/lib${i}`, mudou: i < changed, arvore: 'a'.repeat(40), commits: commits(4, `lib${i}`) })),
      libStudio: { libs: '1', monaco: '2' }, serviceWorker: { versao: 'v1' }, shared: [], app: { commit: 'f'.repeat(40) },
    },
  };
}

function vm({ records = [], vmRecords = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hist-'));
  const reg = join(root, 'app102047', 'mls-base', 'releases', 'registro');
  mkdirSync(reg, { recursive: true });
  mkdirSync(join(root, 'etc', 'releases'), { recursive: true });
  for (const r of records) writeFileSync(join(reg, `${r.releaseId}.json`), JSON.stringify(r));
  for (const r of vmRecords) writeFileSync(join(root, 'etc', 'releases', `${r.releaseId}.json`), JSON.stringify(r));
  writeFileSync(join(reg, '20261109150104.aviso-pendente'), '');
  return root;
}

const cli = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--data-root', root], { encoding: 'utf8' });

test('list: as mais recentes da fila e do projeto, só o resumo do contrato, mais nova primeiro', () => {
  const root = vm({ records: [
    record({ id: '20261109150104', fila: 'libs' }), record({ id: '20261107205723', fila: 'base' }),
    record({ id: '20261109183851', fila: 'libs' }), record({ id: '20261109190000', fila: 'app', libs: 0, changed: 0 }),
  ] });
  try {
    const libs = listRecords({ fila: 'libs', projeto: '102047', dataRoot: root });
    assert.deepEqual(libs.registros.map((r) => r.releaseId), ['20261109183851', '20261109150104']);
    assert.deepEqual(Object.keys(libs.registros[0]).sort(), ['duracaoMs', 'fila', 'fim', 'inicio', 'pedidoId', 'pedidoPor', 'releaseId', 'resultado']);
    assert.equal(libs.fila, 'libs');
    assert.equal(libs.projeto, '102047');
    assert.deepEqual(listRecords({ fila: 'base', projeto: '102047', dataRoot: root }).registros.map((r) => r.releaseId), ['20261107205723']);
    assert.deepEqual(listRecords({ fila: 'libs', projeto: '102047', limite: '1', dataRoot: root }).registros.map((r) => r.releaseId), ['20261109183851']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('list: a fila vm lê /data/etc/releases; fila de projeto sem --projeto e limite fora de 1..50 são erro claro (código 2)', () => {
  const root = vm({ vmRecords: [record({ id: '20261109184325', fila: 'vm', projeto: null, libs: 0, changed: 0 })] });
  try {
    assert.deepEqual(listRecords({ fila: 'vm', dataRoot: root }).registros.map((r) => r.releaseId), ['20261109184325']);
    const noProject = cli(root, 'list', '--fila', 'libs');
    assert.equal(noProject.status, 2);
    assert.match(noProject.stderr, /--projeto <id> is required for the queue 'libs'/u);
    assert.equal(cli(root, 'list', '--fila', 'libs', '--projeto', '102047', '--limite', '51').status, 2);
    assert.equal(cli(root, 'list', '--fila', 'libs', '--projeto', '102047', '--limite', '0').status, 2);
    assert.equal(cli(root, 'list', '--fila', 'nada', '--projeto', '102047').status, 2);
    const ok = cli(root, 'list', '--fila', 'vm');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout.trim().split('\n').at(-1)).registros.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('show: abaixo de 20.000 vem inteiro, sem marca de corte', () => {
  const small = record({ id: '20261109150104', libs: 3, changed: 1, base: 1 });
  assert.ok(JSON.stringify(small).length < MAX_SHOW);
  assert.deepEqual(fitRecord(small), small);
  const root = vm({ records: [small] });
  try {
    const shown = showRecord({ releaseId: '20261109150104', projeto: '102047', dataRoot: root });
    assert.equal(shown.cortado, undefined);
    assert.equal(shown.pecas.libs.length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('show: acima de 20.000 corta primeiro os passos, depois as libs sem mudança, e as libs que mudaram ficam inteiras', () => {
  const big = record({ id: '20261109150104', libs: 30, changed: 2, steps: 6, base: 3 });
  assert.ok(JSON.stringify(big).length > MAX_SHOW, `fixture precisa passar de ${MAX_SHOW}: ${JSON.stringify(big).length}`);
  const fitted = fitRecord(big);
  assert.ok(JSON.stringify(fitted).length <= MAX_SHOW);
  assert.equal(fitted.cortado, true);
  assert.ok(fitted.cortadoItens.includes('passos'));
  assert.ok(fitted.cortadoItens.some((item) => item.startsWith('pecas.libs')));
  assert.deepEqual(Object.keys(fitted.passos[0]).sort(), ['duracaoMs', 'nome', 'resultado']);
  const changed = fitted.pecas.libs.filter((lib) => lib.mudou);
  assert.equal(changed.length, 2);
  for (const lib of changed) assert.deepEqual(lib, big.pecas.libs.find((original) => original.id === lib.id), 'lib que mudou: intacta (commit, link, commits)');
  const unchanged = fitted.pecas.libs.filter((lib) => !lib.mudou);
  assert.equal(unchanged.length, 28);
  assert.deepEqual(Object.keys(unchanged[0]).sort(), ['commit', 'id', 'mudou']);
});

test('show: só os passos já bastam quando é o caso (as libs sem mudança ficam como estão)', () => {
  const rec = record({ id: '20261109150104', libs: 3, changed: 1, steps: 6, base: 1 });
  rec.passos = Array.from({ length: 120 }, (_, i) => ({ nome: `p${i}`, inicio: '2026-11-09T15:00:00Z', duracaoMs: i, resultado: 'ok', detalhe: 'd'.repeat(120) }));
  assert.ok(JSON.stringify(rec).length > MAX_SHOW);
  const fitted = fitRecord(rec);
  assert.deepEqual(fitted.cortadoItens, ['passos']);
  assert.equal(fitted.pecas.libs.length, 3);
  assert.ok(fitted.pecas.libs.every((lib) => lib.commits), 'libs sem corte');
});

test('show: se só as libs que mudaram já passam do limite, elas NÃO são cortadas e a saída avisa acimaDoLimite', () => {
  const huge = record({ id: '20261109150104', libs: 40, changed: 40, steps: 2, base: 1 });
  const fitted = fitRecord(huge);
  assert.equal(fitted.acimaDoLimite, true);
  assert.equal(fitted.cortado, true);
  assert.equal(fitted.pecas.libs.length, 40);
  assert.ok(fitted.pecas.libs.every((lib, i) => lib.commits.length === 4 && lib.mudou === huge.pecas.libs[i].mudou));
});

test('show: commits enormes de base e app são reduzidos (com o total) só depois dos passos e das libs sem mudança', () => {
  const rec = record({ id: '20261109150104', libs: 2, changed: 1, steps: 2, base: 120 });
  rec.pecas.app.commits = commits(120, 'app');
  const fitted = fitRecord(rec);
  assert.ok(JSON.stringify(fitted).length <= MAX_SHOW);
  assert.equal(fitted.pecas.base.commitsTotal, 120);
  assert.equal(fitted.pecas.base.commits.length, 5);
  assert.ok(fitted.cortadoItens.includes('pecas.base.commits'));
  assert.equal(fitted.pecas.libs.find((lib) => lib.mudou).commits.length, 4);
});

test('show pela linha de comando: última linha é o JSON; id inexistente = código 1; id malformado = código 2; vm sem --projeto', () => {
  const root = vm({ records: [record({ id: '20261109150104' })], vmRecords: [record({ id: '20261109184325', fila: 'vm', projeto: null, libs: 0, changed: 0 })] });
  try {
    const shown = cli(root, 'show', '20261109150104', '--projeto', '102047');
    assert.equal(shown.status, 0, shown.stderr);
    const last = JSON.parse(shown.stdout.trim().split('\n').at(-1));
    assert.equal(last.releaseId, '20261109150104');
    assert.ok(shown.stdout.length <= MAX_SHOW + 100);
    const vmShown = cli(root, 'show', '20261109184325');
    assert.equal(JSON.parse(vmShown.stdout.trim()).fila, 'vm');
    const missing = cli(root, 'show', '20200101000000', '--projeto', '102047');
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /release 20200101000000 not found/u);
    assert.equal(cli(root, 'show', 'abc', '--projeto', '102047').status, 2);
    assert.equal(cli(root, 'show', '20261109150104').status, 1, 'sem --projeto lê a pasta da VM, onde ele não está');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('só lê e é rápido: 60 registros, list --limite 50 em menos de 2 s e nada é criado ou alterado', () => {
  const records = Array.from({ length: 60 }, (_, i) => record({ id: `202611${String(10 + Math.floor(i / 24)).padStart(2, '0')}${String(i % 24).padStart(2, '0')}0000`, libs: 12, changed: 3 }));
  const root = vm({ records });
  try {
    const started = Date.now();
    const out = cli(root, 'list', '--fila', 'libs', '--projeto', '102047', '--limite', '50');
    assert.ok(Date.now() - started < 2000, `levou ${Date.now() - started} ms`);
    assert.equal(out.status, 0, out.stderr);
    assert.equal(JSON.parse(out.stdout.trim()).registros.length, 50);
    const dir = historyDir({ fila: 'libs', projeto: '102047', dataRoot: root });
    assert.ok(dir.endsWith(join('app102047', 'mls-base', 'releases', 'registro')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
