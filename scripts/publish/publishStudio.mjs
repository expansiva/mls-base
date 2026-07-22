#!/usr/bin/env node
// publishStudio.mjs — publish/rollback do shell studio (102041) FORA do studio.
// TASK-102041-3: fase A (rollback anti-lockout) + fase A2 (publish CLI).
//
// Port Node do fluxo do servicePublish.ts + buildProject.ts do 102041:
// no studio, o fetch de /_<id>_/l2/*.js passa pelo service worker (compila o .ts
// e roda o onAfterCompileAction do enhancement, que injeta o style no js). Aqui
// o equivalente é: tsc per-file (noEmitOnError=false, mesma receita do
// scripts/build.mjs buildServer) -> scripts/processCssAfterCompile.mjs (rotina
// mls-ci do CI, injeta `if(this.loadStyle) this.loadStyle(...)`) -> esbuild
// nativo bundla a partir do staging. O CSS nunca é reprocessado após o bundle
// (mls-ci exige o header /// <mls per-file).
//
// Credenciais: servers/s3.conf (gitignored; ver servers/s3.conf.example) ou env.
//
// Uso:
//   node scripts/publish/publishStudio.mjs list
//   node scripts/publish/publishStudio.mjs rollback <datetime14> [--lang en]
//   node scripts/publish/publishStudio.mjs publish [--langs en,pt] [--copy-assets]
//        [--skip-compile] [--dry-run] [--project 102041] [--theme Default]

import { createHash, createHmac } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STAGE = resolve(ROOT, '.publishStudio');
const STAGE_DIST = join(STAGE, 'dist');
const STAGE_TMP = join(STAGE, 'tmp');
const STAGE_OUT = join(STAGE, 'out');
const DEFAULT_PROJECT = '102041';
const DEFAULT_THEME = 'Default';
// projetos fora do build (mesmo exclude do tsconfig raiz)
const EXCLUDED_PROJECTS = new Set(['102030', '102050']);

function log(msg) {
  console.log(`[publishStudio] ${msg}`);
}

// ── config (servers/s3.conf + env) ───────────────────────────────────────────
function loadConf() {
  const conf = {};
  const path = join(ROOT, 'servers', 's3.conf');
  if (existsSync(path)) {
    const text = readFileSync(path, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!m) continue;
      let value = m[2].trim();
      if (value.length >= 2 && value[0] === value.at(-1) && `"'`.includes(value[0])) value = value.slice(1, -1);
      conf[m[1]] = value;
    }
  }
  for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_KEY', 'S3_ENDPOINT', 'CDN_BASE']) {
    if (process.env[key]) conf[key] = process.env[key];
  }
  conf.CDN_BASE = (conf.CDN_BASE || 'https://cdn.collab.codes').replace(/\/$/, '');
  return conf;
}

function assertS3Conf(conf) {
  const missing = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_KEY'].filter((k) => !conf[k]);
  if (missing.length) {
    throw new Error(`servers/s3.conf incompleto (faltam: ${missing.join(', ')}). Copie servers/s3.conf.example.`);
  }
}

// ── S3 SigV4 (port do servicePublish.ts) ─────────────────────────────────────
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

function signingKey(secret, dateStamp, region) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function amzTimestamps() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  return { dateStamp, amzDate: `${dateStamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z` };
}

// host/url/canonicalUri por chave — path-style quando o bucket tem pontos
function s3Addr(conf, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (conf.S3_ENDPOINT) {
    const host = new URL(conf.S3_ENDPOINT).host;
    return { host, url: `${conf.S3_ENDPOINT.replace(/\/$/, '')}/${conf.S3_BUCKET}/${key}`, canonicalUri: `/${encodedKey}` };
  }
  if (conf.S3_BUCKET.includes('.')) {
    const host = `s3.${conf.S3_REGION}.amazonaws.com`;
    return { host, url: `https://${host}/${conf.S3_BUCKET}/${key}`, canonicalUri: `/${conf.S3_BUCKET}/${encodedKey}` };
  }
  const host = `${conf.S3_BUCKET}.s3.${conf.S3_REGION}.amazonaws.com`;
  return { host, url: `https://${host}/${key}`, canonicalUri: `/${encodedKey}` };
}

function s3ListAddr(conf, canonicalQS) {
  if (conf.S3_ENDPOINT) {
    const host = new URL(conf.S3_ENDPOINT).host;
    return { host, url: `${conf.S3_ENDPOINT.replace(/\/$/, '')}/${conf.S3_BUCKET}/?${canonicalQS}`, canonicalUri: '/' };
  }
  if (conf.S3_BUCKET.includes('.')) {
    const host = `s3.${conf.S3_REGION}.amazonaws.com`;
    return { host, url: `https://${host}/${conf.S3_BUCKET}/?${canonicalQS}`, canonicalUri: `/${conf.S3_BUCKET}/` };
  }
  const host = `${conf.S3_BUCKET}.s3.${conf.S3_REGION}.amazonaws.com`;
  return { host, url: `https://${host}/?${canonicalQS}`, canonicalUri: '/' };
}

function authorize(conf, { method, canonicalUri, canonicalQS = '', headers, payloadHash }) {
  const { dateStamp, amzDate } = amzTimestamps();
  const all = { ...headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(all).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders = names.map((h) => `${h}:${all[Object.keys(all).find((k) => k.toLowerCase() === h)]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQS}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credScope = `${dateStamp}/${conf.S3_REGION}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${sha256Hex(canonicalRequest)}`;
  const sig = hmac(signingKey(conf.S3_SECRET_KEY, dateStamp, conf.S3_REGION), stringToSign).toString('hex');
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${conf.S3_ACCESS_KEY_ID}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    amzDate,
  };
}

async function s3Put(conf, key, content, contentType = 'text/html; charset=utf-8') {
  const { host, url, canonicalUri } = s3Addr(conf, key);
  const payloadHash = sha256Hex(content);
  const headers = { 'content-type': contentType, host };
  const { authorization, amzDate } = authorize(conf, { method: 'PUT', canonicalUri, headers, payloadHash });
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization },
    body: content,
  });
  if (!res.ok) throw new Error(`PUT ${key} -> HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
}

async function s3Get(conf, key) {
  const { host, url, canonicalUri } = s3Addr(conf, key);
  const { authorization, amzDate } = authorize(conf, { method: 'GET', canonicalUri, headers: { host }, payloadHash: EMPTY_HASH });
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-amz-content-sha256': EMPTY_HASH, 'x-amz-date': amzDate, Authorization: authorization },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${key} -> HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.text();
}

async function s3Copy(conf, srcKey, dstKey) {
  const { host, url, canonicalUri } = s3Addr(conf, dstKey);
  const copySource = encodeURIComponent(`/${conf.S3_BUCKET}/${srcKey}`);
  const headers = { host, 'x-amz-copy-source': copySource };
  const { authorization, amzDate } = authorize(conf, { method: 'PUT', canonicalUri, headers, payloadHash: EMPTY_HASH });
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'x-amz-content-sha256': EMPTY_HASH, 'x-amz-copy-source': copySource, 'x-amz-date': amzDate, Authorization: authorization },
  });
  if (!res.ok) throw new Error(`Copy ${srcKey} -> ${dstKey}: HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
}

async function s3GetXml(conf, queryParams) {
  const canonicalQS = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const { host, url, canonicalUri } = s3ListAddr(conf, canonicalQS);
  const { authorization, amzDate } = authorize(conf, { method: 'GET', canonicalUri, canonicalQS, headers: { host }, payloadHash: EMPTY_HASH });
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-amz-content-sha256': EMPTY_HASH, 'x-amz-date': amzDate, Authorization: authorization },
  });
  if (!res.ok) throw new Error(`List -> HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.text();
}

const xmlUnescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function s3ListPrefixes(conf, prefix) {
  const xml = await s3GetXml(conf, { 'list-type': '2', prefix, delimiter: '/' });
  return [...xml.matchAll(/<CommonPrefixes><Prefix>([^<]*)<\/Prefix><\/CommonPrefixes>/g)].map((m) => xmlUnescape(m[1]));
}

// ── fase A: list / rollback ──────────────────────────────────────────────────
async function findVersions(conf) {
  const prefixes = await s3ListPrefixes(conf, 'www/');
  return prefixes
    .map((p) => p.replace('www/', '').replace(/\/$/, ''))
    .filter((v) => /^\d{14}$/.test(v))
    .sort()
    .reverse();
}

async function cmdList(conf) {
  assertS3Conf(conf);
  const versions = await findVersions(conf);
  let current = '';
  try {
    const raw = await s3Get(conf, 'latest.json');
    current = raw ? (JSON.parse(raw).www ?? '') : '';
  } catch { /* latest.json ausente/ilegível: segue sem marcador */ }
  let rootVersion = '';
  try {
    const rootIndex = await s3Get(conf, 'index.html');
    rootVersion = rootIndex ? (/\/www\/(\d{14})\//.exec(rootIndex)?.[1] ?? '') : '';
  } catch { /* raiz inacessível: segue */ }
  if (versions.length === 0) {
    log('nenhuma versão publicada em www/');
    return;
  }
  log(`versões publicadas (latest.json=${current || '?'}, root index=${rootVersion || '?'})`);
  for (const v of versions) {
    const marks = [v === current ? 'latest.json' : '', v === rootVersion ? 'root' : ''].filter(Boolean).join(', ');
    console.log(`  ${v}${marks ? `   <- ${marks}` : ''}`);
  }
}

async function cmdRollback(conf, version, lang) {
  assertS3Conf(conf);
  if (!/^\d{14}$/.test(version || '')) throw new Error('informe a versão alvo: rollback <datetime14> (use `list` para ver as versões)');
  const langPrefixes = await s3ListPrefixes(conf, `www/${version}/`);
  const langs = langPrefixes.map((p) => p.replace(`www/${version}/`, '').replace(/\/$/, '')).filter(Boolean);
  if (langs.length === 0) throw new Error(`versão ${version} não encontrada em www/`);
  const chosen = lang || (langs.length === 1 ? langs[0] : '');
  if (!chosen) throw new Error(`versão ${version} tem os idiomas [${langs.join(', ')}]: escolha com --lang`);
  if (!langs.includes(chosen)) throw new Error(`idioma ${chosen} não existe na versão ${version} (tem: ${langs.join(', ')})`);

  log(`rollback: www/${version}/${chosen}/index.html -> index.html (raiz)`);
  await s3Copy(conf, `www/${version}/${chosen}/index.html`, 'index.html');

  const raw = await s3Get(conf, 'latest.json');
  let latest = { www: version };
  if (raw) {
    try { latest = { ...JSON.parse(raw), www: version }; } catch { latest = { www: version }; }
  }
  await s3Put(conf, 'latest.json', JSON.stringify(latest), 'application/json');
  log('latest.json atualizado');

  const rootIndex = await s3Get(conf, 'index.html');
  if (!rootIndex || !rootIndex.includes(`/www/${version}/`)) {
    throw new Error('validação falhou: o index.html da raiz não aponta para a versão alvo');
  }
  log(`OK: raiz aponta para ${version} (${chosen})`);
}

// ── fase A2: publish ─────────────────────────────────────────────────────────

// -- tag <-> file (port de mls-102041/l2/utils.ts) --
const toKebab = (str) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const fromKebab = (str) => str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function convertFileToTag({ shortName, project, folder = '' }) {
  if (shortName.includes('-')) {
    const kebabName = toKebab(shortName);
    if (!folder) return kebabName;
    const last = folder.split('/').at(-1);
    return `${toKebab(last)}--${kebabName}`;
  }
  const kebabName = toKebab(shortName);
  const folderPrefix = folder ? toKebab(folder).replace(/\//g, '--') + '--' : '';
  return `${folderPrefix}${kebabName}-${project}`;
}

function resolveTagToFile(tag, inventory, searchOrder) {
  const isLegacy = /-\d{6}$/.test(tag);
  if (isLegacy) {
    const parts = tag.split('--');
    const namePart = parts.pop() || '';
    const folder = parts.join('/').replace(/-(.)/g, (_, c) => c.toUpperCase());
    const m = /(.+)-(\d+)$/.exec(namePart);
    if (!m) return undefined;
    return { shortName: m[1].replace(/-(.)/g, (_, c) => c.toUpperCase()), project: +m[2], folder };
  }
  const sep = tag.indexOf('--');
  const shortName = sep === -1 ? tag : tag.substring(sep + 2);
  const folderSuffix = sep === -1 ? '' : fromKebab(tag.substring(0, sep));
  if (!shortName) return undefined;
  for (const project of searchOrder) {
    const found = inventory.find((f) => {
      if (f.project !== project) return false;
      if (toKebab(f.shortName) !== shortName) return false;
      if (!folderSuffix) return true;
      return f.folder === folderSuffix || f.folder.endsWith('/' + folderSuffix);
    });
    if (found) return { project, shortName: found.shortName, folder: found.folder };
  }
  return undefined;
}

// inventário de componentes l2 do repo (equivalente CLI do mls.stor.files)
function buildInventory() {
  const inventory = [];
  const projects = [];
  for (const name of readdirSync(ROOT)) {
    const m = /^mls-(\d+)$/.exec(name);
    if (!m || EXCLUDED_PROJECTS.has(m[1])) continue;
    const l2 = join(ROOT, name, 'l2');
    if (!existsSync(l2) || !statSync(l2).isDirectory()) continue;
    projects.push(+m[1]);
    for (const file of walkSync(l2)) {
      if (!file.endsWith('.ts')) continue;
      if (/\.(defs|test|spec|d)\.ts$/.test(file)) continue;
      const rel = relative(l2, file).replace(/\\/g, '/');
      const segs = rel.split('/');
      const shortName = segs.pop().replace(/\.ts$/, '');
      inventory.push({ project: +m[1], shortName, folder: segs.join('/'), path: file });
    }
  }
  return { inventory, projects: projects.sort((a, b) => a - b) };
}

function* walkSync(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkSync(full);
    else if (entry.isFile()) yield full;
  }
}

// tags custom no html, fora de <code> (port do extractTagsCustom)
function extractTagsCustom(html) {
  const withoutCode = html.replace(/<code[\s\S]*?<\/code>/gi, '');
  const tags = new Set();
  for (const m of withoutCode.matchAll(/<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?=[\s/>])/g)) tags.add(m[1]);
  return [...tags];
}

const importUrl = ({ project, shortName, folder }) => (folder ? `/_${project}_/l2/${folder}/${shortName}` : `/_${project}_/l2/${shortName}`);

function stagedPath(url) {
  // '/_102041_/l2/collab-nav-1' | '/_102027_/l2/serviceBase.js' -> caminho no staging
  const m = /^\/_(\d+)_\/(.+)$/.exec(url);
  if (!m) return null;
  let rest = m[2];
  if (!rest.endsWith('.js')) rest += '.js';
  return join(STAGE_DIST, `mls-${m[1]}`, rest);
}

function mlsHeaderOf(source) {
  const line = source.split(/\r?\n/).find((l) => l.trim().startsWith('/// <mls '));
  if (!line) return null;
  return /enhancement="([^"]+)"/.exec(line)?.[1] ?? null;
}

// bundla um módulo do staging e importa no Node (metadados: requires/tokens/designSystemBase)
async function bundleAndImport(esbuild, absPath, label) {
  const out = join(STAGE_TMP, `${label}-${sha256Hex(absPath).slice(0, 8)}.mjs`);
  await esbuild.build({
    entryPoints: [absPath],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    outfile: out,
    plugins: [{
      name: 'staged-fs',
      setup(build) {
        build.onResolve({ filter: /^\/_\d+_\// }, (args) => {
          const p = stagedPath(args.path);
          return p && existsSync(p) ? { path: p } : { path: args.path, external: true };
        });
        // bare specifiers (lit, less, ...) ficam externos: o Node resolve via node_modules do repo
        build.onResolve({ filter: /^[^./]/ }, (args) => (existsSync(args.path) ? null : { path: args.path, external: true }));
      },
    }],
  });
  return import(pathToFileURL(out).href);
}

// port do getGlobalCss (designSystemBase 102027): project.less + tokens -> css
async function buildGlobalCss(esbuild, project, theme) {
  const lessPath = join(ROOT, `mls-${project}`, 'l2', 'project.less');
  if (!existsSync(lessPath)) {
    log(`aviso: mls-${project}/l2/project.less não existe -> globalCss vazio`);
    return '';
  }
  let less = await readFile(lessPath, 'utf8');
  less = less.replace(/project-\d+\s*{([\s\S]*)}$/m, '$1');

  const dsPath = stagedPath(`/_${project}_/l2/designSystem.js`);
  if (!existsSync(dsPath)) {
    log(`aviso: designSystem.js não encontrado no staging -> globalCss vazio`);
    return '';
  }
  const ds = await bundleAndImport(esbuild, dsPath, 'designSystem');
  const tokens = ds.tokens ?? ds.default?.tokens;
  if (!tokens) {
    log('aviso: designSystem sem export `tokens` -> globalCss vazio');
    return '';
  }
  const dsbPath = stagedPath('/_102027_/l2/designSystemBase.js');
  const dsb = await bundleAndImport(esbuild, dsbPath, 'designSystemBase');
  // preCompileLessAction = mesmos passos do getGlobalCss do studio, já Node-compatible
  return dsb.preCompileLessAction(less, tokens, theme);
}

// -- compile: tsc noEmitOnError=false (receita do buildServer). A injeção de
// CSS (mls-ci) roda depois, só nos projetos que o bundle realmente usa — os
// demais projetos do repo podem ter .less/tokens quebrados sem afetar o shell.
async function compileStage() {
  log('compilando (tsc, noEmitOnError=false) -> .publishStudio/dist');
  const tsconfig = {
    extends: './tsconfig.json',
    compilerOptions: {
      noEmit: false,
      noEmitOnError: false,
      module: 'esnext',
      moduleResolution: 'bundler',
      outDir: './.publishStudio/dist',
      rootDir: '.',
      sourceMap: false,
      declaration: false,
    },
  };
  const tsconfigPath = join(ROOT, 'tsconfig.publishStudio.json');
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
  await rm(STAGE_DIST, { recursive: true, force: true });

  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.publishStudio.json'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (tsc.status !== 0) log('tsc reportou erros (baseline pré-existente) — seguindo com o emit');
  if (!existsSync(join(STAGE_DIST, `mls-${DEFAULT_PROJECT}`, 'l2'))) {
    throw new Error('tsc não emitiu .publishStudio/dist/mls-102041/l2 — build abortado');
  }
}

function injectCssForProjects(ids) {
  log(`injetando CSS por arquivo (mls-ci) nos projetos usados: ${ids.join(', ')}`);
  const css = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'processCssAfterCompile.mjs'), '--dist', '.publishStudio/dist', ...ids],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (css.status !== 0) throw new Error('processCssAfterCompile falhou');
  fixLoadStyleEscapes(ids);
}

// mls-ci injeta a CSS crua num template literal: `this.loadStyle(\`${css}\`)`.
// Barras da CSS (ex.: content:'\f054' do Font Awesome) não são escapadas, então
// o JS interpreta \f como form-feed em runtime → ícone perdido E o caractere de
// controle cru corrompe o parse da CSS, derrubando regras seguintes. Fix: dobrar
// as barras (e escapar ${) dentro de cada loadStyle. Roda só após o mls-ci (que
// sempre produz barra simples), então nunca duplica.
function fixLoadStyleEscapes(ids) {
  let fixedCalls = 0;
  let touchedFiles = 0;
  for (const id of ids) {
    const l2 = join(STAGE_DIST, `mls-${id}`, 'l2');
    if (!existsSync(l2)) continue;
    for (const file of walkSync(l2)) {
      if (!file.endsWith('.js')) continue;
      const src = readFileSync(file, 'utf8');
      let count = 0;
      const out = src.replace(/this\.loadStyle\(`([^`]*)`\)/g, (whole, body) => {
        if (!body.includes('\\') && !body.includes('${')) return whole;
        count += 1;
        const esc = body.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');
        return 'this.loadStyle(`' + esc + '`)';
      });
      if (count) { writeFileSync(file, out, 'utf8'); fixedCalls += count; touchedFiles += 1; }
    }
  }
  if (fixedCalls) log(`escapes de CSS corrigidos: ${fixedCalls} loadStyle(s) em ${touchedFiles} arquivo(s)`);
}

// -- bundle final (port do buildJs) --
async function buildIndexHtml(esbuild, project, theme, freshCompile) {
  const htmlPath = join(ROOT, `mls-${project}`, 'l2', 'index.html');
  if (!existsSync(htmlPath)) throw new Error(`não achei ${htmlPath}`);
  const contentHTML = await readFile(htmlPath, 'utf8');

  const { inventory, projects } = buildInventory();
  const searchOrder = [+project, ...projects.filter((p) => p !== +project)];

  const tags = extractTagsCustom(contentHTML);
  const ownTag = convertFileToTag({ project: +project, shortName: 'index', folder: '' });
  if (!tags.includes(ownTag)) tags.push(ownTag);

  const imports = [];
  const importsMap = [];
  const errors = [];
  const enhancementCache = new Map();

  for (const tag of tags) {
    try {
      const info = resolveTagToFile(tag, inventory, searchOrder);
      if (!info) throw new Error(`tag não resolvida: ${tag}`);
      const srcPath = join(ROOT, `mls-${info.project}`, 'l2', ...(info.folder ? info.folder.split('/') : []), `${info.shortName}.ts`);
      if (!existsSync(srcPath)) throw new Error(`fonte não encontrada: ${srcPath}`);
      const enhancement = mlsHeaderOf(await readFile(srcPath, 'utf8'));
      if (!enhancement) throw new Error(`sem header /// <mls em ${srcPath}`);
      const url = importUrl(info);

      if (enhancement === '_blank') {
        if (!imports.includes(url)) imports.push(url);
        continue;
      }
      if (!enhancementCache.has(enhancement)) {
        // enhancement vem como "_102041_/l2/enhancementCollab.ts"
        const target = stagedPath(`/${enhancement.replace(/^\//, '').replace(/\.ts$/, '')}`);
        if (!target || !existsSync(target)) throw new Error(`enhancement não compilado: ${enhancement}`);
        const mod = await bundleAndImport(esbuild, target, 'enh');
        enhancementCache.set(enhancement, mod.requires ?? []);
        for (const r of mod.requires ?? []) {
          if (r.type === 'cdn') importsMap.push({ name: r.name, ref: r.ref });
        }
      }
      for (const r of enhancementCache.get(enhancement)) {
        if (r.type === 'import' && !imports.includes(r.ref)) imports.push(r.ref);
      }
      if (!imports.includes(url)) imports.push(url);
    } catch (e) {
      errors.push({ tag, error: e.message });
    }
  }

  if (errors.length) {
    for (const err of errors) log(`ERRO [${err.tag}]: ${err.error}`);
    throw new Error(`${errors.length} tag(s) com erro — publish abortado (o studio seguiria com warnings; aqui é fail-fast)`);
  }

  const globalCss = await buildGlobalCss(esbuild, project, theme);

  // entry virtual: injeção do global css + imports (só os locais entram no bundle)
  const allImports = [...new Set(imports.filter((i) => i.startsWith('/')))];
  const externalModules = new Set(importsMap.map((i) => i.name));
  const virtualEntryContent = `
(() => {

    const style = document.createElement('style');
    style.setAttribute('data-build-css', 'global');
    style.textContent = ${JSON.stringify(globalCss)};
    document.head.appendChild(style);

})();

${allImports.map((path) => `import "${path}";`).join('\n')}
`;

  const runBundle = (metafile) => esbuild.build({
    stdin: { contents: virtualEntryContent, resolveDir: ROOT, sourcefile: 'virtual-entry.js', loader: 'js' },
    bundle: true,
    minify: false,
    format: 'esm',
    sourcemap: false,
    write: false,
    metafile,
    treeShaking: true,
    plugins: [{
      name: 'staged-fs',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (externalModules.has(args.path) || [...externalModules].some((m) => args.path.startsWith(m + '/'))) {
            return { path: args.path, external: true };
          }
          if (args.path.startsWith('http://') || args.path.startsWith('https://')) {
            return { path: args.path, external: true };
          }
          if (/^\/_\d+_\//.test(args.path)) {
            const p = stagedPath(args.path);
            if (!p || !existsSync(p)) throw new Error(`[staged-fs] não achei no staging: ${args.path}`);
            return { path: p };
          }
          return null; // relativos resolvem no FS normalmente
        });
      },
    }],
  });

  // passada 1: descobre os projetos do fecho de dependências (metafile);
  // injeta o CSS (mls-ci) só neles; passada 2 bundla o js já com styles.
  let result = await runBundle(true);
  const usedIds = [...new Set(
    Object.keys(result.metafile.inputs)
      .map((p) => /[/\\]mls-(\d+)[/\\]/.exec(p)?.[1])
      .filter(Boolean),
  )].sort();
  if (freshCompile) {
    injectCssForProjects(usedIds);
    result = await runBundle(false);
  } else {
    log(`--skip-compile: usando staging já processado (projetos no bundle: ${usedIds.join(', ')})`);
  }
  const js = result.outputFiles[0].text;

  // port do prepareHTMLFinal: style no <head>, script module no fim do <body>
  let html = contentHTML;
  if (globalCss.trim()) {
    html = html.replace(/<\/head>/i, `<style id="build-global-css">${globalCss}</style></head>`);
  }
  html = html.replace(/<\/body>/i, `<script type="module">${js}</script></body>`);
  return { html, stats: { tags: tags.length, imports: allImports.length, bundleBytes: js.length, loadStyleCount: (js.match(/this\.loadStyle\(/g) || []).length, globalCssBytes: globalCss.length } };
}

function localVersion() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ── assets l3 (upload local, por idioma) ─────────────────────────────────────
// O shell referencia assets como `./l3/...` — com o <base href> em
// www/<v>/<lang>/ isso resolve para www/<v>/<lang>/l3/..., então CADA idioma
// recebe a árvore completa. Fonte = mls-<project>/l3 (onde os arquivos vivem no
// git). Substitui a cópia S3-da-versão-anterior do servicePublish.
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm',
};
function contentTypeFor(path) {
  const ext = /\.[^./\\]+$/.exec(path)?.[0].toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

function collectL3(project) {
  const l3Root = join(ROOT, `mls-${project}`, 'l3');
  if (!existsSync(l3Root)) return { l3Root, files: [] };
  const files = [...walkSync(l3Root)].map((abs) => ({ abs, rel: relative(l3Root, abs).replace(/\\/g, '/') }));
  return { l3Root, files };
}

async function cmdPublish(conf, opts) {
  const project = opts.project || DEFAULT_PROJECT;
  const theme = opts.theme || DEFAULT_THEME;
  if (!opts.dryRun) assertS3Conf(conf);

  // idiomas: --langs ou todos do l5/project.json (studio: seleção manual)
  let langs = opts.langs;
  if (!langs.length) {
    const l5Path = join(ROOT, `mls-${project}`, 'l5', 'project.json');
    if (existsSync(l5Path)) {
      const l5 = JSON.parse(await readFile(l5Path, 'utf8'));
      langs = (l5.languages ?? []).map((l) => l.language);
    }
  }
  if (!langs.length) throw new Error('nenhum idioma (use --langs en,pt)');

  if (!opts.skipCompile) await compileStage();
  else if (!existsSync(join(STAGE_DIST, `mls-${project}`, 'l2'))) throw new Error('--skip-compile sem staging anterior (.publishStudio/dist vazio)');

  await rm(STAGE_TMP, { recursive: true, force: true });
  await mkdir(STAGE_TMP, { recursive: true });
  const esbuild = (await import('esbuild')).default ?? (await import('esbuild'));

  const version = localVersion();
  log(`versão: ${version} | idiomas: ${langs.join(', ')} | theme: ${theme}${opts.dryRun ? ' | DRY-RUN' : ''}`);

  const built = await buildIndexHtml(esbuild, project, theme, !opts.skipCompile);
  log(`index gerado: ${built.stats.tags} tags, ${built.stats.imports} imports, bundle ${(built.stats.bundleBytes / 1024).toFixed(0)} KB, ` +
    `${built.stats.loadStyleCount} loadStyle(), globalCss ${(built.stats.globalCssBytes / 1024).toFixed(1)} KB`);

  // assets l3 locais (mls-<project>/l3) — subidos em cada idioma, salvo --skip-assets
  const { l3Root, files: l3Files } = opts.skipAssets ? { l3Root: '', files: [] } : collectL3(project);
  if (!opts.skipAssets) {
    if (l3Files.length) log(`assets l3: ${l3Files.length} arquivo(s) de ${relative(ROOT, l3Root)} → cada idioma`);
    else log(`assets l3: nenhum arquivo em mls-${project}/l3 (nada a subir)`);
  }

  for (const [i, lang] of langs.entries()) {
    const baseHref = `${conf.CDN_BASE}/www/${version}/${lang}/`;
    const indexHtml = built.html.replace(/<base\s+href="[^"]*"\s*\/?>/i, `<base href="${baseHref}">`);

    if (opts.dryRun) {
      const outPath = join(STAGE_OUT, version, lang, 'index.html');
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, indexHtml, 'utf8');
      for (const f of l3Files) {
        const dst = join(STAGE_OUT, version, lang, 'l3', f.rel);
        await mkdir(dirname(dst), { recursive: true });
        await cp(f.abs, dst);
      }
      log(`dry-run: ${relative(ROOT, outPath)}${l3Files.length ? ` (+ ${l3Files.length} asset l3)` : ''}`);
      if (i === 0) {
        await writeFile(join(STAGE_OUT, version, 'root-index.html'), indexHtml, 'utf8');
        await writeFile(join(STAGE_OUT, version, 'latest.json'), JSON.stringify({ www: version }), 'utf8');
      }
      continue;
    }

    const s3Key = `www/${version}/${lang}/index.html`;
    log(`upload: ${s3Key}`);
    await s3Put(conf, s3Key, indexHtml);
    if (i === 0) {
      log('upload: index.html (raiz)');
      await s3Put(conf, 'index.html', indexHtml);
    }
    if (l3Files.length) {
      log(`upload assets: ${lang}/l3/ (${l3Files.length} arquivo(s))`);
      for (const f of l3Files) {
        const buf = await readFile(f.abs);
        await s3Put(conf, `www/${version}/${lang}/l3/${f.rel}`, buf, contentTypeFor(f.abs));
      }
    }
  }

  if (!opts.dryRun) {
    const raw = await s3Get(conf, 'latest.json');
    let latest = { www: version };
    if (raw) {
      try { latest = { ...JSON.parse(raw), www: version }; } catch { latest = { www: version }; }
    }
    await s3Put(conf, 'latest.json', JSON.stringify(latest), 'application/json');
    log('latest.json atualizado');
    const rootIndex = await s3Get(conf, 'index.html');
    if (!rootIndex || !rootIndex.includes(`/www/${version}/`)) throw new Error('validação falhou: raiz não aponta para a nova versão');
    log(`publicação concluída: ${version}`);
  } else {
    log(`dry-run concluído: .publishStudio/out/${version}/`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { command: '', version: '', lang: '', langs: [], skipAssets: false, skipCompile: false, dryRun: false, project: '', theme: '' };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lang') opts.lang = argv[++i] ?? '';
    else if (a === '--langs') opts.langs = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--skip-assets') opts.skipAssets = true;
    else if (a === '--skip-compile') opts.skipCompile = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--project') opts.project = argv[++i] ?? '';
    else if (a === '--theme') opts.theme = argv[++i] ?? '';
    else positional.push(a);
  }
  opts.command = positional[0] ?? '';
  opts.version = positional[1] ?? '';
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conf = loadConf();
  if (opts.command === 'list') return cmdList(conf);
  if (opts.command === 'rollback') return cmdRollback(conf, opts.version, opts.lang);
  if (opts.command === 'publish') return cmdPublish(conf, opts);
  console.log('uso: publishStudio.mjs <list | rollback <datetime14> [--lang x] | publish [--langs en,pt] [--skip-assets] [--skip-compile] [--dry-run]>');
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[publishStudio] abortado: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
