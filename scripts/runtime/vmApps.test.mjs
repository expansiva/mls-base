import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appNameOf, ProjectPortError, projectIdToPort, releaseAliasOf } from './projectPorts.mjs';
import { ensureProjectApp, isAggregator, pm2AggregatorConfig, pm2AppConfig } from './vmApps.mjs';

// ── porta: a MESMA regra do collab-sites (sites.ts:265) ─────────────────────
test('projectIdToPort repete a regra do sites, caso a caso', () => {
  assert.equal(projectIdToPort('102048'), 2048);
  assert.equal(projectIdToPort(5030), 2030);
  assert.equal(projectIdToPort('102999'), 2999);
  assert.equal(projectIdToPort('102043'), 2043);
});

test('projectIdToPort recusa o que não é só dígito — mls-102048 não é id', () => {
  assert.throws(() => projectIdToPort('mls-102048'), ProjectPortError);
  assert.throws(() => projectIdToPort(''), ProjectPortError);
});

test('nome do app e alias do release saem da porta e do id', () => {
  assert.equal(appNameOf(2043), 'app2043');
  assert.equal(releaseAliasOf('102043'), 'current-102043');
});

// ── conteúdo: o git e o sites têm de escrever o MESMO arquivo ───────────────
test('pm2AppConfig aponta para o alias do projeto, nunca para o `current` global', () => {
  const text = pm2AppConfig('102043', 2043, '/data/mls-base');
  assert.match(text, /name: "app2043"/u);
  assert.match(text, /cwd: "\/data\/mls-base\/current-102043"/u);
  assert.match(text, /PORT: "2043"/u);
  assert.match(text, /COLLAB_PROJECT_ID: "102043"/u);
  // o `current` global serve o último push de qualquer projeto — um app
  // multiprojeto pendurado nele serviria o app do vizinho
  assert.equal(/cwd: "\/data\/mls-base\/current"/u.test(text), false);
});

test('o agregador é reconhecido pelo próprio conteúdo', () => {
  assert.equal(isAggregator(pm2AggregatorConfig()), true);
  assert.equal(isAggregator("module.exports = { apps: [{ name: 'app', cwd: '/data/mls-base/current' }] };"), false);
});

// ── ensureProjectApp ────────────────────────────────────────────────────────
function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'vmapps-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('cria pm2.apps.d/<app>.config.js e o agregador; rodar de novo é no-op', () => {
  withRoot((root) => {
    const first = ensureProjectApp({ root, projectId: '102043', remoteBase: '/data/mls-base' });
    assert.equal(first.port, 2043);
    assert.equal(first.wrote, true);
    assert.equal(first.replacedLegacy, false);
    assert.ok(readFileSync(join(root, 'pm2.apps.d', 'app2043.config.js'), 'utf8').includes('current-102043'));
    assert.equal(isAggregator(readFileSync(join(root, 'pm2.config.js'), 'utf8')), true);

    const again = ensureProjectApp({ root, projectId: '102043', remoteBase: '/data/mls-base' });
    assert.equal(again.wrote, false, 'idempotente: sem mudança não reescreve');
  });
});

test('dois projetos = dois arquivos e duas portas, sem tocar um no outro', () => {
  withRoot((root) => {
    ensureProjectApp({ root, projectId: '102043', remoteBase: '/data/mls-base' });
    const before = readFileSync(join(root, 'pm2.apps.d', 'app2043.config.js'), 'utf8');
    const second = ensureProjectApp({ root, projectId: '102047', remoteBase: '/data/mls-base' });
    assert.equal(second.port, 2047);
    assert.equal(readFileSync(join(root, 'pm2.apps.d', 'app2043.config.js'), 'utf8'), before);
    assert.ok(readFileSync(join(root, 'pm2.apps.d', 'app2047.config.js'), 'utf8').includes('current-102047'));
  });
});

test('pm2.config.js legado (app único no `current`) é trocado e AVISADO', () => {
  withRoot((root) => {
    writeFileSync(join(root, 'pm2.config.js'), "module.exports = { apps: [{ name: 'app', cwd: '/data/mls-base/current' }] };\n");
    const result = ensureProjectApp({ root, projectId: '102043', remoteBase: '/data/mls-base' });
    assert.equal(result.replacedLegacy, true, 'quem chama precisa saber para mandar remover o app antigo');
    assert.equal(isAggregator(readFileSync(join(root, 'pm2.config.js'), 'utf8')), true);
  });
});

test('agregador já existente não é reescrito nem marcado como legado', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'pm2.apps.d'), { recursive: true });
    writeFileSync(join(root, 'pm2.config.js'), pm2AggregatorConfig());
    const result = ensureProjectApp({ root, projectId: '102043', remoteBase: '/data/mls-base' });
    assert.equal(result.replacedLegacy, false);
  });
});
