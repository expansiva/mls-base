import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWeb,
  rewriteAbsoluteImportSource,
  rewriteLocalDistAbsoluteImports,
  setProjectRoot,
} from './build.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = '900001';
const TARGET = 'web-test-gb91';

function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return out;
}

test('buildWeb: dist/<target> é Lit + shells + css, sem JS do app', { timeout: 120_000 }, async () => {
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
  const outdir = join(MLS_BASE, 'dist', TARGET);
  try {
    await buildWeb(
      {
        publication: { targets: { [TARGET]: {} } },
        shellTemplates: { spa: `./_${ID}_/l2/spa/index.html` },
        projects: { [ID]: { type: 'client' } },
      },
      TARGET,
      [ID],
    );
    const jsUnderAppL2 = listFiles(join(outdir, `_${ID}_`, 'l2'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => relative(outdir, f));
    assert.deepEqual(jsUnderAppL2, [], `não deve haver JS do app em dist/${TARGET}/_${ID}_/l2/`);
    assert.equal(existsSync(join(outdir, '_chunks')), false);
    assert.equal(existsSync(join(outdir, '_libs', 'lit', 'index.js')), true);
    assert.equal(existsSync(join(outdir, `_${ID}_`, 'l2', 'y.css')), true);
    const shell = readFileSync(join(outdir, `_${ID}_`, 'l2', 'spa', 'index.html'), 'utf8');
    assert.match(shell, /<script type="importmap">/);
    assert.match(shell, /"lit": "\/_libs\/lit\/index\.js"/);
  } finally {
    setProjectRoot(ID, undefined);
    rmSync(outdir, { recursive: true, force: true });
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
