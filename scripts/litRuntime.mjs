// litRuntime.mjs — o Lit em UM lugar só, para o app inteiro.
//
// Antes: o `dist/web` empacotava o Lit do node_modules dentro dos chunks, e o
// importmap dos shells mandava o `lit` bare para o jsdelivr. Quem era servido
// pelo `obj/compiled.zip` (fonte crua) pegava o CDN; quem vinha do `dist/web`
// pegava a cópia inlinada. Dois Lit no mesmo documento — `instanceof` mente,
// e um custom element compartilhado registra duas vezes.
//
// Agora: os módulos do Lit são emitidos UMA vez em `<dist>/_libs/lit/` (com
// `splitting`, então o `reactive-element` existe em um único chunk), o esbuild
// do app marca `lit` como `external`, e o importmap dos shells — gerado daqui —
// aponta os dois mundos para essas mesmas URLs.
//
// A configuração mora no master frontend aura (`mls-102033/l2/shared/litRuntime.json`),
// não aqui: é decisão de plataforma, não de script de build.
//
// A lista de specifiers NÃO é escrita à mão — sai do `exports` do pacote
// instalado. Uma lista à mão cobria 18 dos 38 exports do lit 3.3.3, e marcar
// `external` com uma lista incompleta quebraria em runtime todo import de
// `lit/static-html.js` ou `lit/decorators/property.js` que hoje funciona por
// estar inlinado.

import { build as esbuild } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const LIT_CONFIG_REL = 'mls-102033/l2/shared/litRuntime.json';

const IMPORTMAP_OPEN = '<!-- collab:lit-importmap -->';
const IMPORTMAP_CLOSE = '<!-- /collab:lit-importmap -->';

export function readLitRuntimeConfig(root) {
  const path = resolve(root, LIT_CONFIG_REL);
  if (!existsSync(path)) {
    throw new Error(`litRuntime.json não encontrado em ${LIT_CONFIG_REL} — é ele que diz onde o Lit mora.`);
  }
  const config = JSON.parse(readFileSync(path, 'utf8'));
  for (const key of ['package', 'baseUrl', 'outDir']) {
    if (typeof config[key] !== 'string' || !config[key]) {
      throw new Error(`${LIT_CONFIG_REL}: campo "${key}" ausente ou vazio.`);
    }
  }
  if (!config.baseUrl.startsWith('/') || !config.baseUrl.endsWith('/')) {
    throw new Error(`${LIT_CONFIG_REL}: "baseUrl" tem de ser absoluta e terminar em "/" (está "${config.baseUrl}").`);
  }
  return config;
}

// './directives/repeat.js' -> 'lit/directives/repeat.js'; '.' -> 'lit'
export function specifierOf(pkg, exportKey) {
  return exportKey === '.' ? pkg : `${pkg}/${exportKey.replace(/^\.\//u, '')}`;
}

// './directives/repeat.js' -> 'directives/repeat'; '.' -> 'index'
export function outputNameOf(exportKey) {
  if (exportKey === '.') return 'index';
  return exportKey.replace(/^\.\//u, '').replace(/\.js$/u, '');
}

// O `exports` do lit usa condições ({types, default}); só o `default` é o ESM
// que o browser executa. Entradas sem `default` (ou o ./package.json) ficam de fora.
export function litExportEntries(pkgJson) {
  const exportsMap = pkgJson?.exports ?? {};
  const entries = [];
  for (const [key, value] of Object.entries(exportsMap)) {
    if (key === './package.json') continue;
    const target = typeof value === 'string' ? value : value?.default;
    if (typeof target !== 'string' || !target.endsWith('.js')) continue;
    entries.push({ exportKey: key, target });
  }
  return entries.sort((left, right) => left.exportKey.localeCompare(right.exportKey));
}

export function buildLitImportMap(pkg, baseUrl, entries) {
  const imports = {};
  for (const { exportKey } of entries) {
    imports[specifierOf(pkg, exportKey)] = `${baseUrl}${outputNameOf(exportKey)}.js`;
  }
  return { imports };
}

// O esbuild precisa saber que `lit` e tudo abaixo dele NÃO entram no bundle.
// Um `lit/*` só não basta: o próprio `lit` (sem barra) tem de estar na lista.
export function litExternals(pkg, entries) {
  return entries.map(({ exportKey }) => specifierOf(pkg, exportKey));
}

/**
 * Troca o bloco marcado do shell pelo importmap gerado. Lança se os marcadores
 * não existirem: um shell sem importmap injetado é um shell que não carrega
 * `lit` bare nenhum — melhor falhar no build do que servir uma página morta.
 */
export function injectImportMap(html, importMap, { indent = '    ' } = {}) {
  const open = html.indexOf(IMPORTMAP_OPEN);
  const close = html.indexOf(IMPORTMAP_CLOSE);
  if (open < 0 || close < 0 || close < open) {
    throw new Error(
      `shell sem os marcadores ${IMPORTMAP_OPEN} … ${IMPORTMAP_CLOSE} — o importmap do Lit é gerado, não escrito à mão.`,
    );
  }
  const body = JSON.stringify(importMap, null, 2)
    .split('\n')
    .map((line) => `${indent}  ${line}`)
    .join('\n');
  const block = [
    IMPORTMAP_OPEN,
    `${indent}<script type="importmap">`,
    body,
    `${indent}</script>`,
    `${indent}${IMPORTMAP_CLOSE}`,
  ].join('\n');
  return html.slice(0, open) + block + html.slice(close + IMPORTMAP_CLOSE.length);
}

/**
 * Emite os módulos do Lit em <outdir>/<outDir>. `splitting: true` é o que
 * garante UM `reactive-element` para todas as entradas — sem ele cada
 * specifier levaria a sua cópia e o problema mudaria de lugar, não sumiria.
 */
export async function emitLitRuntime({ root, outdir, config, entries, pkgDir }) {
  const entryPoints = {};
  for (const { exportKey, target } of entries) {
    entryPoints[outputNameOf(exportKey)] = resolve(pkgDir, target);
  }

  await esbuild({
    absWorkingDir: root,
    entryPoints,
    outdir: join(outdir, config.outDir),
    platform: 'browser',
    format: 'esm',
    bundle: true,
    splitting: true,
    target: ['es2022'],
    chunkNames: 'shared-[hash]',
    logLevel: 'silent',
  });

  return Object.keys(entryPoints).length;
}

export function litPackageDir(root, pkg) {
  const dir = resolve(root, 'node_modules', pkg);
  const pkgJsonPath = join(dir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(`node_modules/${pkg} não encontrado a partir de ${root} — rode pnpm install.`);
  }
  return { dir, pkgJson: JSON.parse(readFileSync(pkgJsonPath, 'utf8')) };
}

export function resolveShellDir(shellPath, root) {
  return dirname(resolve(root, shellPath.replace(/^\.\//u, '')));
}
