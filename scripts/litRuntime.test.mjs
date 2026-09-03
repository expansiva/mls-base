import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLitImportMap,
  injectImportMap,
  litExportEntries,
  litExternals,
  litPackageDir,
  outputNameOf,
  readLitRuntimeConfig,
  specifierOf,
} from './litRuntime.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

test('a configuração mora no master frontend aura, não no script de build', () => {
  const config = readLitRuntimeConfig(ROOT);
  assert.equal(config.package, 'lit');
  assert.match(config.baseUrl, /^\/.*\/$/u);
  assert.ok(config.outDir);
});

test('specifier e nome de saída saem da chave do exports', () => {
  assert.equal(specifierOf('lit', '.'), 'lit');
  assert.equal(specifierOf('lit', './directives/repeat.js'), 'lit/directives/repeat.js');
  assert.equal(outputNameOf('.'), 'index');
  assert.equal(outputNameOf('./directives/repeat.js'), 'directives/repeat');
  assert.equal(outputNameOf('./decorators.js'), 'decorators');
});

test('litExportEntries lê o `default` das condições e ignora o package.json', () => {
  const entries = litExportEntries({
    exports: {
      '.': { types: './development/index.d.ts', default: './index.js' },
      './decorators.js': { default: './decorators.js' },
      './package.json': './package.json',
      './só-tipos': { types: './x.d.ts' },
      './string.js': './string.js',
    },
  });
  assert.deepEqual(entries.map((e) => e.exportKey), ['.', './decorators.js', './string.js']);
});

test('a lista de externals cobre TODO o exports do lit instalado, não uma amostra', () => {
  // O importmap escrito à mão cobria 18 dos 38 exports do lit 3.3.3. Marcar
  // `external` com uma lista curta quebraria em runtime todo import fora dela
  // (lit/static-html.js, lit/decorators/property.js…) que hoje só funciona por
  // estar inlinado no bundle.
  const { pkgJson } = litPackageDir(ROOT, 'lit');
  const entries = litExportEntries(pkgJson);
  const externals = litExternals('lit', entries);
  assert.ok(entries.length >= 30, `esperava o exports inteiro, veio ${entries.length}`);
  assert.ok(externals.includes('lit'), 'o `lit` puro tem de estar na lista, não só lit/*');
  for (const spec of ['lit/decorators.js', 'lit/static-html.js', 'lit/decorators/property.js', 'lit/directives/repeat.js']) {
    assert.ok(externals.includes(spec), `faltou ${spec}`);
  }
});

test('o importmap manda todo specifier para o baseUrl da configuração', () => {
  const map = buildLitImportMap('lit', '/_libs/lit/', [
    { exportKey: '.' },
    { exportKey: './decorators.js' },
    { exportKey: './directives/repeat.js' },
  ]);
  assert.deepEqual(map.imports, {
    lit: '/_libs/lit/index.js',
    'lit/decorators.js': '/_libs/lit/decorators.js',
    'lit/directives/repeat.js': '/_libs/lit/directives/repeat.js',
  });
  // nada de CDN em lugar nenhum do mapa
  assert.equal(JSON.stringify(map).includes('jsdelivr'), false);
});

test('injectImportMap troca só o bloco marcado', () => {
  const html = [
    '<head>',
    '    <!-- collab:lit-importmap -->',
    '    <script type="importmap">',
    '      { "imports": {} }',
    '    </script>',
    '    <!-- /collab:lit-importmap -->',
    '    <script type="module" src="/x.js"></script>',
    '</head>',
  ].join('\n');
  const out = injectImportMap(html, { imports: { lit: '/_libs/lit/index.js' } });
  assert.match(out, /"lit": "\/_libs\/lit\/index\.js"/u);
  assert.match(out, /<script type="module" src="\/x\.js">/u);
  assert.equal(out.includes('{ "imports": {} }'), false);
  // idempotente: reinjetar sobre o resultado dá o mesmo
  assert.equal(injectImportMap(out, { imports: { lit: '/_libs/lit/index.js' } }), out);
});

test('shell sem os marcadores FALHA o build — nunca cai calado para o CDN', () => {
  assert.throws(
    () => injectImportMap('<head><script type="importmap">{}</script></head>', { imports: {} }),
    /marcadores/u,
  );
});

test('os dois shells do runtime carregam os marcadores e nenhum CDN', () => {
  for (const shell of ['mls-102033/l2/shared/spa/index.html', 'mls-102033/l2/shared/pwa/index.html']) {
    const html = readFileSync(resolve(ROOT, shell), 'utf8');
    assert.ok(html.includes('<!-- collab:lit-importmap -->'), `${shell} sem marcador de abertura`);
    assert.ok(html.includes('<!-- /collab:lit-importmap -->'), `${shell} sem marcador de fecho`);
    assert.equal(html.includes('jsdelivr'), false, `${shell} ainda aponta para o CDN`);
  }
});

// ── manifesto dos módulos empacotados (o que impede o gêmeo do zip) ──────────
test('bundledModuleUrls traduz os inputs do metafile para as URLs que o runtime serve', async () => {
  const { bundledModuleUrls } = await import('./bundleManifest.mjs');
  const urls = bundledModuleUrls({
    outputs: {
      'dist/web/_chunks/chunk-A.js': {
        inputs: {
          'mls-102020/l2/molecules/ml-scenary.ts': {},
          'mls-102029/l2/interactionRuntime.ts': {},
          'node_modules/lit/index.js': {},
        },
      },
      'dist/web/_102043_/l2/x/page11/a.js': {
        inputs: {
          'mls-102043/l2/x/web/desktop/page11/a.ts': {},
          'mls-102020/l2/molecules/ml-scenary.ts': {},
        },
      },
    },
  });
  assert.deepEqual(urls, [
    '_102020_/l2/molecules/ml-scenary.js',
    '_102029_/l2/interactionRuntime.js',
    '_102043_/l2/x/web/desktop/page11/a.js',
  ]);
  // node_modules e caminhos fora de mls-<id>/l2 não viram URL de projeto
  assert.equal(urls.some((u) => u.includes('lit')), false);
});

test('bundledModuleUrls não repete o mesmo módulo citado por vários outputs', async () => {
  const { bundledModuleUrls } = await import('./bundleManifest.mjs');
  const urls = bundledModuleUrls({
    outputs: {
      a: { inputs: { 'mls-102020/l2/m.ts': {} } },
      b: { inputs: { 'mls-102020/l2/m.ts': {} } },
    },
  });
  assert.deepEqual(urls, ['_102020_/l2/m.js']);
});
