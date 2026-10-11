import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWeb,
  copyL3Assets,
  RES_EXT,
  RES_SEGMENTS,
  rewriteAbsoluteImportSource,
  rewriteLocalDistAbsoluteImports,
  setProjectRoot,
  withMasterRuntimeManifest,
  assertPlatformPersistence,
  readMasterRuntimeManifest,
} from './build.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = '900001';
const WEB = 'web';

function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return out;
}

test('buildWeb: dist/web é Lit + shells + css, sem JS do app', { timeout: 120_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'gb91-'));
  const proj = join(root, `mls-${ID}`);
  mkdirSync(join(proj, 'l2', 'spa'), { recursive: true });
  writeFileSync(join(proj, 'l2', 'x.ts'), 'export const x = 1;\n');
  writeFileSync(join(proj, 'l2', 'y.css'), 'body { color: red; }\n');
  writeFileSync(
    join(proj, 'l2', 'spa', 'index.html'),
    [
      '<!doctype html>',
      '<html><head>',
      '    <!-- collab:lit-importmap -->',
      '    <!-- /collab:lit-importmap -->',
      '</head><body></body></html>',
      '',
    ].join('\n'),
  );
  setProjectRoot(ID, proj);
  const outdir = join(MLS_BASE, 'dist', WEB);
  const backup = join(MLS_BASE, 'dist', 'web.gb93-test-bak');
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  if (existsSync(outdir)) renameSync(outdir, backup);
  try {
    await buildWeb(
      {
        shellTemplates: { spa: `./_${ID}_/l2/spa/index.html` },
        projects: { [ID]: { type: 'client' } },
      },
      [ID],
    );
    const jsUnderAppL2 = listFiles(join(outdir, `_${ID}_`, 'l2'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => relative(outdir, f));
    assert.deepEqual(jsUnderAppL2, [], `não deve haver JS do app em dist/${WEB}/_${ID}_/l2/`);
    assert.equal(existsSync(join(outdir, '_chunks')), false);
    assert.equal(existsSync(join(outdir, '_libs', 'lit', 'index.js')), true);
    assert.equal(existsSync(join(outdir, `_${ID}_`, 'l2', 'y.css')), true);
    const shell = readFileSync(join(outdir, `_${ID}_`, 'l2', 'spa', 'index.html'), 'utf8');
    assert.match(shell, /<script type="importmap">/);
    assert.match(shell, /"lit": "\/_libs\/lit\/index\.js"/);
  } finally {
    setProjectRoot(ID, undefined);
    rmSync(outdir, { recursive: true, force: true });
    if (existsSync(backup)) renameSync(backup, outdir);
    rmSync(root, { recursive: true, force: true });
  }
});

function withLocalDist(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'gb86-rewrite-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  try {
    const result = fn(root);
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

const REWRITE_FROM = join(
  '_102052_',
  'l1',
  'controleChamados',
  'layer_1_external',
  'adapters',
  'http',
  'controllers',
  'atendenteCatalogue.js',
);
const REWRITE_USECASE = join(
  '_102052_',
  'l1',
  'controleChamados',
  'layer_2_application',
  'usecases',
  'listAtendente.js',
);
const REWRITE_CONTRACTS = join('_102034_', 'l1', 'server', 'layer_2_controllers', 'contracts.js');

test('rewrite: specifier with .js stays intact', () => {
  withLocalDist({
    [REWRITE_FROM]: "import { ok } from '/_102034_/l1/server/layer_2_controllers/contracts.js';\n",
    [REWRITE_CONTRACTS]: 'export function ok() {}\n',
  }, (localDist) => {
    const fromFile = join(localDist, REWRITE_FROM);
    const { updated, completed } = rewriteAbsoluteImportSource(
      readFileSync(fromFile, 'utf8'),
      fromFile,
      localDist,
    );
    assert.equal(completed, 0);
    assert.match(updated, /from ['"]\.\.\/.+contracts\.js['"]/);
    assert.doesNotMatch(updated, /from ['"]\/_102034_/);
    assert.doesNotMatch(updated, /contracts\.js\.js/);
  });
});

test('rewrite: extensionless + existing .js target gains .js', () => {
  withLocalDist({
    [REWRITE_FROM]: "import { listAtendente } from '/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente';\n",
    [REWRITE_USECASE]: 'export function listAtendente() {}\n',
  }, (localDist) => {
    const fromFile = join(localDist, REWRITE_FROM);
    const { updated, completed } = rewriteAbsoluteImportSource(
      readFileSync(fromFile, 'utf8'),
      fromFile,
      localDist,
    );
    assert.equal(completed, 1);
    assert.match(updated, /from ['"]\.\.\/.+usecases\/listAtendente\.js['"]/);
    assert.doesNotMatch(updated, /from ['"]\/_102052_/);
  });
});

test('rewrite: extensionless without target stays extensionless', () => {
  withLocalDist({
    [REWRITE_FROM]: "import { ghost } from '/_102052_/l1/controleChamados/layer_2_application/usecases/doesNotExist';\n",
  }, (localDist) => {
    const fromFile = join(localDist, REWRITE_FROM);
    const { updated, completed } = rewriteAbsoluteImportSource(
      readFileSync(fromFile, 'utf8'),
      fromFile,
      localDist,
    );
    assert.equal(completed, 0);
    assert.match(updated, /from ['"][^'"]+usecases\/doesNotExist['"]/);
    assert.doesNotMatch(updated, /doesNotExist\.js/);
  });
});

test('rewrite: from / import / import() / require() all four forms', () => {
  withLocalDist({
    [REWRITE_FROM]: [
      "import { listAtendente } from '/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente';",
      "import '/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente';",
      "const lazy = await import('/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente');",
      "const cjs = require('/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente');",
    ].join('\n'),
    [REWRITE_USECASE]: 'export function listAtendente() {}\n',
  }, (localDist) => {
    const fromFile = join(localDist, REWRITE_FROM);
    const { updated, completed } = rewriteAbsoluteImportSource(
      readFileSync(fromFile, 'utf8'),
      fromFile,
      localDist,
    );
    assert.equal(completed, 4);
    assert.equal((updated.match(/listAtendente\.js/g) ?? []).length, 4);
    assert.match(updated, /await import\(['"][^'"]+listAtendente\.js['"]\)/);
    assert.match(updated, /require\(['"][^'"]+listAtendente\.js['"]\)/);
  });
});

test('rewrite: log counts completed specifiers', async (t) => {
  const lines = [];
  t.mock.method(console, 'log', (msg) => { lines.push(String(msg)); });
  await withLocalDist({
    [REWRITE_FROM]: [
      "import { ok } from '/_102034_/l1/server/layer_2_controllers/contracts.js';",
      "import { listAtendente } from '/_102052_/l1/controleChamados/layer_2_application/usecases/listAtendente';",
      "import { ghost } from '/_102052_/l1/controleChamados/layer_2_application/usecases/doesNotExist';",
    ].join('\n'),
    [REWRITE_USECASE]: 'export function listAtendente() {}\n',
    [REWRITE_CONTRACTS]: 'export function ok() {}\n',
  }, async (localDist) => {
    const result = await rewriteLocalDistAbsoluteImports(localDist);
    assert.equal(result.completed, 1);
    assert.equal(result.rewritten, 1);
    assert.equal(
      lines.some((l) => l.includes('rewrote absolute imports in 1 file(s); completed .js on 1 specifier(s)')),
      true,
      lines.join('\n'),
    );
    const out = readFileSync(join(localDist, REWRITE_FROM), 'utf8');
    assert.match(out, /listAtendente\.js/);
    assert.match(out, /contracts\.js/);
    assert.match(out, /doesNotExist['"]/);
    assert.doesNotMatch(out, /doesNotExist\.js/);
  });
});

test('RES_SEGMENTS includes l3 and RES_EXT includes servable binary assets', () => {
  assert.equal(RES_SEGMENTS.includes('l3'), true);
  for (const ext of ['.wav', '.mp3', '.ogg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff2']) {
    assert.equal(RES_EXT.has(ext), true, ext);
  }
});

test('copyL3Assets still copies module-scoped l3/<app>/assets (registered app)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'not23-mod-'));
  const id = '102051';
  const srcDir = join(root, 'l3', 'cafeFlow', 'assets', 'seed');
  mkdirSync(srcDir, { recursive: true });
  const payload = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xff]);
  writeFileSync(join(srcDir, 'espresso.webp'), payload);
  const destRoot = mkdtempSync(join(tmpdir(), 'not23-mod-dist-'));
  setProjectRoot(id, root);
  try {
    const copied = await copyL3Assets([id], destRoot);
    assert.equal(copied, 1);
    const destFile = join(destRoot, `_${id}_`, 'l3', 'cafeFlow', 'assets', 'seed', 'espresso.webp');
    assert.deepEqual(readFileSync(destFile), payload);
  } finally {
    setProjectRoot(id, undefined);
    rmSync(root, { recursive: true, force: true });
    rmSync(destRoot, { recursive: true, force: true });
  }
});

test('T5: copyL3Assets copies l3/assets wav byte-identical (binary, not text)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'not23-l3-'));
  const id = '102025';
  const srcDir = join(root, 'l3', 'assets');
  mkdirSync(srcDir, { recursive: true });
  // Bytes that are invalid UTF-8: a text copy would replace them and change length/content.
  const payload = Buffer.from([0x52, 0x49, 0x46, 0x46, 0xff, 0xfe, 0x00, 0x80, 0xc0, 0x00]);
  const srcFile = join(srcDir, 'collabNotification.wav');
  writeFileSync(srcFile, payload);
  const destRoot = mkdtempSync(join(tmpdir(), 'not23-dist-'));
  setProjectRoot(id, root);
  try {
    const copied = await copyL3Assets([id], destRoot);
    assert.equal(copied, 1);
    const destFile = join(destRoot, `_${id}_`, 'l3', 'assets', 'collabNotification.wav');
    assert.equal(existsSync(destFile), true);
    assert.equal(statSync(destFile).size, payload.length);
    assert.deepEqual(readFileSync(destFile), payload);
  } finally {
    setProjectRoot(id, undefined);
    rmSync(root, { recursive: true, force: true });
    rmSync(destRoot, { recursive: true, force: true });
  }
});

test('T5: real collabNotification.wav copies at 13934 bytes', async () => {
  const wav = resolve(MLS_BASE, 'mls-102025', 'l3', 'assets', 'collabNotification.wav');
  assert.equal(existsSync(wav), true, 'wav must live at mls-102025/l3/assets/');
  assert.equal(statSync(wav).size, 13934);
  const destRoot = mkdtempSync(join(tmpdir(), 'not23-wav-'));
  try {
    const copied = await copyL3Assets(['102025'], destRoot);
    assert.equal(copied >= 1, true);
    const destFile = join(destRoot, '_102025_', 'l3', 'assets', 'collabNotification.wav');
    assert.equal(existsSync(destFile), true);
    assert.equal(statSync(destFile).size, 13934);
    assert.deepEqual(readFileSync(destFile), readFileSync(wav));
  } finally {
    rmSync(destRoot, { recursive: true, force: true });
  }
});

test('withMasterRuntimeManifest: forma 102056 (só root/type) recebe o manifesto', () => {
  const manifest = { modules: [{ moduleId: 'mdm' }], persistenceModules: [{ moduleId: 'platform' }] };
  const base = { projects: { 102056: { type: 'client' }, 102034: { root: '../mls-102034', type: 'master backend' } } };
  const out = withMasterRuntimeManifest(base, (id) => (id === '102034' ? manifest : null));
  assert.deepEqual(out.replaced, ['modules', 'persistenceModules']);
  assert.deepEqual(out.differed, []);
  assert.deepEqual(out.config.projects[102034].modules, manifest.modules);
  assert.deepEqual(out.config.projects[102034].persistenceModules, manifest.persistenceModules);
  assert.equal(base.projects[102034].persistenceModules, undefined);
});

test('withMasterRuntimeManifest: cópia igual à 102047 não marca differed', () => {
  const manifest = { modules: [{ moduleId: 'mdm' }], persistenceModules: [{ moduleId: 'platform' }] };
  const complete = {
    projects: {
      102034: { type: 'master backend', modules: manifest.modules, persistenceModules: manifest.persistenceModules },
    },
  };
  const same = withMasterRuntimeManifest(complete, () => manifest);
  assert.deepEqual(same.replaced, ['modules', 'persistenceModules']);
  assert.deepEqual(same.differed, []);
  assert.deepEqual(same.config.projects[102034].modules, manifest.modules);
});

test('withMasterRuntimeManifest: cópia diferente cede ao manifesto e marca differed', () => {
  const manifest = { modules: [{ moduleId: 'mdm' }], persistenceModules: [{ moduleId: 'platform' }] };
  const stale = {
    projects: {
      102034: {
        type: 'master backend',
        modules: [{ moduleId: 'old' }],
        persistenceModules: [{ moduleId: 'old' }],
      },
    },
  };
  const out = withMasterRuntimeManifest(stale, () => manifest);
  assert.deepEqual(out.replaced, ['modules', 'persistenceModules']);
  assert.deepEqual(out.differed, ['modules', 'persistenceModules']);
  assert.deepEqual(out.config.projects[102034].persistenceModules, manifest.persistenceModules);
});

test('withMasterRuntimeManifest: manifesto ausente ou inválido lança', () => {
  const base = { projects: { 102034: { type: 'master backend' } } };
  assert.throws(
    () => withMasterRuntimeManifest(base, () => null),
    /masterModules.json de 102034 ausente ou inválido/,
  );
  assert.throws(
    () => readMasterRuntimeManifest('000000'),
    /masterModules.json de 000000 ausente ou inválido/,
  );
  assert.deepEqual(
    withMasterRuntimeManifest({ projects: { 1: { type: 'client' } } }, () => ({ modules: [] })).replaced,
    [],
  );
});

test('assertPlatformPersistence: master sem platform lança', () => {
  const manifest = { modules: [{ moduleId: 'mdm' }], persistenceModules: [{ moduleId: 'mdm' }] };
  const out = withMasterRuntimeManifest(
    { projects: { 102034: { type: 'master backend' } } },
    () => manifest,
  );
  assert.throws(() => assertPlatformPersistence(out.config), /platform/);
  assertPlatformPersistence(
    withMasterRuntimeManifest(
      { projects: { 102034: { type: 'master backend' } } },
      () => ({ persistenceModules: [{ moduleId: 'platform' }] }),
    ).config,
  );
});

test('l5/config.json: alphaAllAuthorities true chega igual ao config gravado na release', () => {
  const l5 = {
    alphaAllAuthorities: true,
    projects: { 102034: { type: 'master backend', modules: [], persistenceModules: [] } },
  };
  const { config } = withMasterRuntimeManifest(l5, () => ({
    modules: [{ moduleId: 'mdm' }],
    persistenceModules: [{ moduleId: 'platform' }],
  }));
  const written = JSON.parse(`${JSON.stringify(config, null, 2)}\n`);
  assert.equal(written.alphaAllAuthorities, true);
  assert.equal(written.alphaAllAuthorities, l5.alphaAllAuthorities);
});

test('withMasterRuntimeManifest: arquivos reais — 102047 sem differed, plataforma presente', () => {
  const real = JSON.parse(readFileSync(join(MLS_BASE, 'mls-102047', 'l5', 'config.json'), 'utf8'));
  const out = withMasterRuntimeManifest(real, readMasterRuntimeManifest);
  assert.deepEqual(out.differed, []);
  assertPlatformPersistence(out.config);
  const shape102056 = { ...real, projects: { ...real.projects, 102034: { root: '../mls-102034', type: 'master backend' } } };
  const filled = withMasterRuntimeManifest(shape102056, readMasterRuntimeManifest);
  assert.deepEqual(filled.config.projects[102034].persistenceModules, out.config.projects[102034].persistenceModules);
  assertPlatformPersistence(filled.config);
});
