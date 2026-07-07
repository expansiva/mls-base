#!/usr/bin/env node
// build.mjs — mls-base runtime build
//
//   server  -> dist/local/_<id>_/...   (tsc emit; /_<id>_/ imports rewritten to
//                                        relative; resources copied; .js.map)
//   web     -> dist/web/_<id>_/...      (esbuild bundle of the frontend; .map)
//
// Source folders stay as mls-<id>; the output uses the _<id>_ layout the Forge
// runtime expects (resolveProjectDistPath -> dist/local/_<id>_, and the active
// publication target serves from dist/<target>).
//
// Usage:
//   node scripts/build.mjs                 # server + web (default target)
//   node scripts/build.mjs --only server   # only dist/local
//   node scripts/build.mjs --only web      # only dist/web
//   node scripts/build.mjs --client 102043 # pick the client app config
//   node scripts/build.mjs --targets web,cdncloudflare

import { build as esbuild } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const LOCAL_DIST = resolve(DIST, 'local');
const TS_SEGMENTS = ['core', 'l1', 'l2'];
const RES_SEGMENTS = ['core', 'l1', 'l2', 'l5'];
const RES_EXT = new Set(['.html', '.css', '.less', '.json', '.svg', '.md', '.sql']);
// Matches absolute project specifiers in emitted JS: from '/_102034_/l1/...'
// Matches every form of project specifier in emitted JS:
//   from '/_..._/...'  | import '/_..._/...'  | import('/_..._/...')  | require('/_..._/...')
const ABS_IMPORT_RE =
  /(?<prefix>\b(?:from|import)\s+["']|\b(?:import|require)\s*\(\s*["'])(?<spec>\/_\d+_\/(?:core|l1|l2)\/[^"']+)(?<suffix>["'](?:\s*\))?)/gu;

function log(msg) {
  console.log(`[build] ${msg}`);
}

function run(cmd, args) {
  log(`${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

function toPosix(p) {
  return p.split('\\').join('/');
}

// All mls-<id> source directories on disk (single source of truth).
function discoverProjects() {
  return readdirSync(ROOT)
    .filter((name) => /^mls-\d+$/.test(name) && statSync(join(ROOT, name)).isDirectory())
    .map((name) => name.slice('mls-'.length))
    .sort();
}

// Project id -> source root, populated from the client config.json in main().
const projectRoots = new Map();
function projectDir(id) {
  return projectRoots.get(id) ?? resolve(ROOT, `mls-${id}`);
}

// Resolve a "/_<id>_/rest" specifier (or relative source) to a real .ts/.js file.
function resolveSource(spec, fromDir) {
  let base;
  const m = /^\/_(\d+)_\/(.+)$/u.exec(spec);
  if (m) {
    base = resolve(projectDir(m[1]), m[2]);
  } else if (spec.startsWith('/')) {
    base = resolve(ROOT, spec.slice(1));
  } else {
    base = resolve(fromDir, spec);
  }

  const candidates = [base];
  if (extname(base) === '.js') {
    candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  }
  if (!extname(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'));
  }
  return candidates.find((c) => existsSync(c));
}

// Output key (_<id>_/relpath without extension) for an absolute source file.
function outputKey(absFile) {
  const posix = toPosix(absFile);
  const m = /\/mls-(\d+)\/(.+)$/u.exec(posix);
  if (!m) return undefined;
  return `_${m[1]}_/${m[2].replace(/\.(ts|tsx|js|jsx)$/u, '')}`;
}

async function pathExists(p) {
  try {
    await readdir(p);
    return true;
  } catch {
    return existsSync(p);
  }
}

async function walkFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return out;
}

// ── server build (dist/local) ────────────────────────────────────────────────
async function buildServer(ids) {
  log(`server build -> dist/local (${ids.map((i) => 'mls-' + i).join(' ')})`);
  await rm(LOCAL_DIST, { recursive: true, force: true });

  // dynamic tsconfig: paths from the project set, emit to dist/local, sourcemaps on.
  // Relative path values (leading "./") resolve correctly without baseUrl, so the
  // file lives at the project root and stays forward-compatible (no baseUrl).
  const paths = {};
  const include = ['./types/*.d.ts'];
  for (const id of ids) {
    for (const seg of TS_SEGMENTS) {
      const segDir = join(projectDir(id), seg);
      if (!existsSync(segDir)) continue;
      const segRel = toPosix(relative(ROOT, segDir));
      paths[`/_${id}_/${seg}/*`] = [`./${segRel}/*`];
      include.push(`./${segRel}/**/*.ts`, `./${segRel}/**/*.d.ts`);
    }
  }
  const tsconfig = {
    extends: './tsconfig.json',
    compilerOptions: {
      // Force consistent ESM output for every file (dist/local/package.json is
      // type:module). nodenext would emit CJS for files without a package.json
      // type:module context, mixing CJS+ESM and breaking at runtime.
      module: 'esnext',
      moduleResolution: 'bundler',
      outDir: toPosix(relative(ROOT, LOCAL_DIST)),
      rootDir: '.',
      paths,
      sourceMap: true,
      declaration: false,
      noEmit: false,
      noEmitOnError: false,
    },
    include,
  };
  // Single, inspectable tsconfig at the project root (where the build runs).
  // Overwritten each run; not deleted.
  const tmp = resolve(ROOT, 'tsconfig.build.json');
  await writeFile(tmp, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
  log('tsconfig written: tsconfig.build.json');
  try {
    run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json']);
  } catch (error) {
    // noEmitOnError=false: files are emitted even if pinned deps report errors.
    log(`tsc reported errors (continuing): ${error instanceof Error ? error.message : error}`);
  }

  // rename dist/local/mls-<id> -> dist/local/_<id>_
  if (existsSync(LOCAL_DIST)) {
    for (const entry of await readdir(LOCAL_DIST, { withFileTypes: true })) {
      const rm2 = /^mls-(\d+)$/u.exec(entry.name);
      if (entry.isDirectory() && rm2) {
        const target = join(LOCAL_DIST, `_${rm2[1]}_`);
        await rm(target, { recursive: true, force: true });
        await rename(join(LOCAL_DIST, entry.name), target);
      }
    }
  }

  // mark the emitted tree as ESM so Node treats the .js as modules
  await mkdir(LOCAL_DIST, { recursive: true });
  await writeFile(resolve(LOCAL_DIST, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`, 'utf8');

  // rewrite /_<id>_/... imports to relative paths within dist/local
  let rewritten = 0;
  for (const file of (await walkFiles(LOCAL_DIST)).filter((f) => extname(f) === '.js')) {
    const current = await readFile(file, 'utf8');
    const updated = current.replace(ABS_IMPORT_RE, (...args) => {
      const g = args.at(-1);
      const targetPath = resolve(LOCAL_DIST, g.spec.slice(1));
      let rel = toPosix(relative(dirname(file), targetPath));
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `${g.prefix}${rel}${g.suffix}`;
    });
    if (updated !== current) {
      await writeFile(file, updated, 'utf8');
      rewritten += 1;
    }
  }
  log(`rewrote absolute imports in ${rewritten} file(s)`);

  // copy non-TS resources (sql/html/css/less/json/svg/md) into dist/local/_<id>_
  let copied = 0;
  for (const id of ids) {
    for (const seg of RES_SEGMENTS) {
      const segDir = join(projectDir(id), seg);
      if (!existsSync(segDir)) continue;
      for (const file of await walkFiles(segDir)) {
        if (!RES_EXT.has(extname(file))) continue;
        const rel = toPosix(relative(projectDir(id), file));
        const dest = resolve(LOCAL_DIST, `_${id}_`, rel);
        await mkdir(dirname(dest), { recursive: true });
        await cp(file, dest);
        copied += 1;
      }
    }
  }
  log(`copied ${copied} resource file(s) to dist/local`);
}

// ── web build (dist/<target>) ────────────────────────────────────────────────
function aliasPlugin() {
  return {
    name: 'collab-alias',
    setup(api) {
      api.onResolve({ filter: /^\/_\d+_\/(core|l1|l2)\// }, (args) => {
        const resolved = resolveSource(args.path, args.resolveDir);
        return resolved ? { path: resolved } : null;
      });
    },
  };
}

// Resolve a virtual path like "./_102033_/l2/.../index.html" to its real source
// file and its dist-relative path (which keeps the _<id>_ form).
function resolveVirtual(p) {
  const rel = p.replace(/^\.\//u, '');
  const m = /^_(\d+)_\/(.+)$/u.exec(rel);
  const abs = m ? resolve(projectDir(m[1]), m[2]) : resolve(ROOT, rel);
  return { abs, rel };
}

function collectEntrypoints(clientConfig, clientRoot) {
  const entries = {};
  const addSource = (src, fromDir) => {
    const file = resolveSource(src, fromDir);
    if (!file) return;
    const key = outputKey(file);
    if (key) entries[key] = file;
  };

  // entrypoints declared inside each module's moduleFrontendDefinition (module.ts):
  //   headerRenderer/asideRenderer/routes -> entrypoint: '/_<id>_/l2/.../x.js'
  const entryRe = /entrypoint\s*:\s*["'](\/_\d+_\/[^"']+\.js)["']/gu;
  for (const [projId, project] of Object.entries(clientConfig.projects ?? {})) {
    const projRoot = projectDir(projId);
    for (const mod of project.modules ?? []) {
      const fe = mod.frontend;
      if (fe?.moduleSource) addSource(fe.moduleSource, projRoot);
      for (const page of fe?.pages ?? []) {
        if (page.source) addSource(page.source, projRoot);
      }
      // covers modules without config "pages" (e.g. the master-backend monitor)
      const moduleFile = fe?.moduleSource
        ? resolve(projRoot, fe.moduleSource)
        : join(projRoot, 'l2', mod.moduleId, 'module.ts');
      if (existsSync(moduleFile)) {
        const src = readFileSync(moduleFile, 'utf8');
        let mm;
        while ((mm = entryRe.exec(src)) !== null) addSource(mm[1], projRoot);
      }
    }
  }

  const regions = clientConfig.clientShell?.regions ?? {};
  for (const region of Object.values(regions)) {
    for (const profile of Object.values(region.profiles ?? {})) {
      const src = profile.renderer?.source;
      if (src) addSource(src, clientRoot);
    }
  }

  // The shell HTML declares the initial module script (the frontend bootstrap),
  // e.g. <script type="module" src="/_102033_/l2/shared/bootstrap.js">. Collect
  // every module script referenced there as an entrypoint.
  const scriptRe = /<script[^>]+type=["']module["'][^>]+src=["'](\/_\d+_\/[^"']+)\.js["']/gu;
  for (const shellPath of Object.values(clientConfig.shellTemplates ?? {})) {
    const { abs } = resolveVirtual(shellPath);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, 'utf8');
    let m;
    while ((m = scriptRe.exec(html)) !== null) addSource(`${m[1]}.ts`, clientRoot);
  }

  return entries;
}

async function buildWeb(clientConfig, clientRoot, targetName, ids) {
  const target = clientConfig.publication?.targets?.[targetName];
  if (!target) throw new Error(`Unknown publication target "${targetName}" in config.json`);

  const outdir = resolve(DIST, targetName);
  await rm(outdir, { recursive: true, force: true });

  const entryPoints = collectEntrypoints(clientConfig, clientRoot);
  log(`web build -> dist/${targetName} (${Object.keys(entryPoints).length} entrypoints)`);

  await esbuild({
    absWorkingDir: ROOT,
    entryPoints,
    outdir,
    platform: 'browser',
    format: 'esm',
    bundle: true,
    splitting: true,
    sourcemap: target.sourcemap === true,
    minify: target.minify === true,
    target: ['es2022'],
    // Lit needs legacy (experimentalDecorators) semantics; with es2022 esbuild would
    // otherwise default useDefineForClassFields=true and break @property fields
    // ("Unsupported decorator location: field").
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
    chunkNames: '_chunks/[name]-[hash]',
    plugins: [aliasPlugin()],
    logLevel: 'info',
  });

  // copy l2 static resources (html/css/svg/json/md/assets) into dist/<target>
  let copied = 0;
  for (const id of ids) {
    const l2 = join(projectDir(id), 'l2');
    if (!existsSync(l2)) continue;
    for (const file of await walkFiles(l2)) {
      const ext = extname(file);
      if (!RES_EXT.has(ext) && ext !== '') continue;
      if (ext === '.ts' || ext === '.tsx') continue;
      const rel = toPosix(relative(l2, file));
      const dest = resolve(outdir, `_${id}_`, 'l2', rel);
      await mkdir(dirname(dest), { recursive: true });
      await cp(file, dest);
      copied += 1;
    }
  }
  log(`copied ${copied} static file(s) to dist/${targetName}`);

  // compile Tailwind for each master-frontend project, overwriting the copied
  // source css with the built one. @source covers every project's l2 so
  // cross-project class names are included.
  for (const [projId, project] of Object.entries(clientConfig.projects ?? {})) {
    if (project.type !== 'master frontend') continue;
    const cssSrc = join(projectDir(projId), 'l2', 'shared', 'tailwind.css');
    if (!existsSync(cssSrc)) continue;
    const cssOut = resolve(outdir, `_${projId}_`, 'l2', 'shared', 'tailwind.css');
    await mkdir(dirname(cssOut), { recursive: true });
    const sources = ids
      .map((id) => `@source "${toPosix(relative(dirname(cssSrc), join(projectDir(id), 'l2')))}/**/*.{ts,html}";`)
      .join('\n');
    const tmpCss = join(dirname(cssSrc), '.tailwind.build.css');
    await writeFile(tmpCss, `${readFileSync(cssSrc, 'utf8').trimEnd()}\n${sources}\n`, 'utf8');
    try {
      run('pnpm', ['exec', 'tailwindcss', '-i', tmpCss, '-o', cssOut, '--minify']);
      log(`tailwind compiled -> ${toPosix(relative(outdir, cssOut))}`);
    } finally {
      await rm(tmpCss, { force: true });
    }
  }

  await writeComponentStylesForWeb(clientConfig, outdir, ids);

  // copy shell templates referenced by config.json (kept in their _<id>_ path)
  for (const shellPath of Object.values(clientConfig.shellTemplates ?? {})) {
    const { abs, rel } = resolveVirtual(shellPath);
    if (!existsSync(abs)) continue;
    const dest = resolve(outdir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(abs, dest);
  }
}

function extractInjectedCss(source) {
  const blocks = [];
  const re = /if\s*\(\s*this\.loadStyle\s*\)\s*this\.loadStyle\s*\(\s*`([\s\S]*?)`\s*\)\s*;/gu;
  let match;
  while ((match = re.exec(source)) !== null) blocks.push(match[1]);
  return blocks;
}

async function writeComponentStylesForWeb(clientConfig, outdir, ids) {
  if (!existsSync(LOCAL_DIST)) {
    log('component styles skipped (dist/local not found)');
    return;
  }

  const blocks = [];
  for (const id of ids) {
    const l2 = resolve(LOCAL_DIST, `_${id}_`, 'l2');
    if (!existsSync(l2)) continue;
    for (const file of (await walkFiles(l2)).filter((f) => extname(f) === '.js')) {
      const cssBlocks = extractInjectedCss(await readFile(file, 'utf8'));
      for (const css of cssBlocks) blocks.push(css);
    }
  }

  const css = `${blocks.join('\n\n')}\n`;
  let written = 0;
  for (const [projId, project] of Object.entries(clientConfig.projects ?? {})) {
    if (project.type !== 'master frontend') continue;
    const cssOut = resolve(outdir, `_${projId}_`, 'l2', 'shared', 'component-styles.css');
    await mkdir(dirname(cssOut), { recursive: true });
    await writeFile(cssOut, css, 'utf8');
    written += 1;
  }
  log(`component styles compiled -> ${written} file(s), ${blocks.length} block(s)`);
}

// ── client config discovery ──────────────────────────────────────────────────
function detectClientId(explicit) {
  if (explicit) return explicit;
  const candidates = [];
  for (const id of discoverProjects()) {
    const cfgPath = join(projectDir(id), 'config.json');
    if (!existsSync(cfgPath)) continue;
    let cfg;
    try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { continue; }
    if (cfg.projects?.[id]?.type === 'client' || cfg.defaultProjectId === id) candidates.push(id);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) throw new Error('No client config.json found. Pass --client <id>.');
  throw new Error(`Multiple client apps found (${candidates.join(', ')}). Pass --client <id>.`);
}

function parseArgs(argv) {
  const args = { only: '', client: '', targets: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--only') args.only = argv[++i] ?? '';
    else if (argv[i] === '--client') args.client = argv[++i] ?? '';
    else if (argv[i] === '--targets') args.targets = argv[++i] ?? '';
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const clientId = detectClientId(args.client);
  const clientRoot = resolve(ROOT, `mls-${clientId}`);
  const clientConfig = JSON.parse(await readFile(join(clientRoot, 'config.json'), 'utf8'));

  // The project set comes from the client config.json (only what the app needs),
  // with each project's source root resolved from its `root` field.
  const ids = Object.keys(clientConfig.projects ?? {});
  if (ids.length === 0) throw new Error('config.json declares no projects.');
  for (const id of ids) {
    const root = clientConfig.projects[id]?.root ?? `../mls-${id}`;
    projectRoots.set(id, resolve(clientRoot, root));
  }
  log(`client=${clientId} projects=${ids.join(' ')}`);

  if (args.only !== 'web') {
    await buildServer(ids);
    // post-compile: compile each project's .less and inject into the per-file JS
    // (same mls-ci routine the GitHub Action uses; requires the /// <mls header,
    // so it applies to dist/local only — esbuild output strips it)
    run('node', ['scripts/processCssAfterCompile.mjs', '--dist', 'dist/local']);
    // make the chosen client config discoverable at the projects-dir root
    await cp(join(clientRoot, 'config.json'), resolve(ROOT, 'config.json'));
    log('copied client config.json to project root');
  }

  if (args.only !== 'server') {
    const targets = args.targets
      ? args.targets.split(',').map((t) => t.trim()).filter(Boolean)
      : [clientConfig.publication?.defaultTarget ?? 'web'];
    for (const t of targets) {
      await buildWeb(clientConfig, clientRoot, t, ids);
    }
  }

  log('build finished');
}

main().catch((error) => {
  console.error(`[build] aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
