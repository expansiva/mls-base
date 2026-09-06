import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clientConfigMarker,
  formatClientConfigCli,
  formatClientConfigWarn,
  validateClientConfig,
  validateClientConfigFile,
} from './validateClientConfig.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'validateClientConfig.mjs');

const OK_CONFIG = {
  defaultProjectId: '102039',
  shellTemplates: { spa: './_102033_/l2/shared/spa/index.html' },
  projects: {
    102039: {
      type: 'client',
      modules: [{
        moduleId: 'hello',
        backendRouter: './router.ts',
        frontend: { pages: [{ id: 'home' }] },
      }],
      persistenceModules: ['hello'],
    },
    102033: { type: 'master frontend' },
    102034: { type: 'master backend' },
  },
};

function withFile(json, run) {
  const dir = mkdtempSync(join(tmpdir(), 'client-config-'));
  try {
    mkdirSync(join(dir, 'l5'), { recursive: true });
    const path = join(dir, 'l5', 'config.json');
    if (json !== null) writeFileSync(path, typeof json === 'string' ? json : `${JSON.stringify(json, null, 2)}\n`);
    return run(path, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('config completo passa; o que o 502 precisava está na lista nomeada', () => {
  const ok = validateClientConfig(OK_CONFIG);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.errors, []);

  const empty = validateClientConfig({});
  assert.equal(empty.ok, false);
  for (const needle of [
    'must declare exactly 1 project of type "client"',
    'must declare at least 1 project of type "master frontend"',
    'must declare at least 1 project of type "master backend"',
    'shellTemplates.spa is required',
  ]) {
    assert.ok(empty.errors.some((row) => row.includes(needle.split(' (found')[0])), needle);
  }
});

test('arquivo ausente / JSON inválido não lançam — devolvem errors', () => {
  const missing = validateClientConfigFile(join(tmpdir(), 'no-such-config.json'));
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.errors, ['l5/config.json is missing']);

  withFile('{', (path) => {
    const invalid = validateClientConfigFile(path);
    assert.equal(invalid.ok, false);
    assert.match(invalid.errors[0], /invalid json/);
    assert.ok(invalid.invalidJson);
  });
});

test('WARN nomeia o que faltou e diz que não bloqueia; marker carrega o count', () => {
  const result = { ok: false, errors: ['shellTemplates.spa is required', 'client project declares no modules'], path: 'x' };
  const warn = formatClientConfigWarn(result, '[publishGit]');
  assert.match(warn, /WARN \(does not block\)/);
  assert.match(warn, /shellTemplates\.spa is required/);
  assert.match(warn, /client project declares no modules/);
  assert.equal(clientConfigMarker(result), '##clientConfig warn n=2##');
  assert.equal(clientConfigMarker({ ok: true, errors: [] }), '##clientConfig ok##');
  assert.equal(formatClientConfigWarn({ ok: true, errors: [] }, 'gitPostReceive:'), 'gitPostReceive: clientConfig: OK');
});

test('CLI continua saindo 1 no vermelho (uso à mão); 0 no verde', () => {
  withFile({}, (path) => {
    const failed = spawnSync(process.execPath, [SCRIPT, path], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.match(`${failed.stderr}${failed.stdout}`, /shellTemplates\.spa is required/);
    assert.match(`${failed.stderr}${failed.stdout}`, /config validation FAILED/);
  });
  withFile(OK_CONFIG, (path) => {
    const ok = spawnSync(process.execPath, [SCRIPT, path], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
    assert.match(`${ok.stdout}${ok.stderr}`, /config validation OK/);
  });
  const usage = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /usage:/);
});

test('importar o módulo não dispara process.exit (argv de outro script)', () => {
  const imported = spawnSync(process.execPath, ['-e', `
    process.argv.push('publishGit.mjs', '102039', 'local');
    const m = await import(${JSON.stringify(resolve(SCRIPT))});
    if (typeof m.validateClientConfig !== 'function') process.exit(2);
  `], { encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr);
});

test('formatClientConfigCli preserva o texto que o projectInit testa', () => {
  const failed = formatClientConfigCli({
    ok: false,
    path: '/tmp/config.json',
    errors: ['shellTemplates.spa is required'],
  });
  assert.match(failed, /config validation FAILED for \/tmp\/config.json/);
  assert.match(failed, /  - shellTemplates\.spa is required/);
});
