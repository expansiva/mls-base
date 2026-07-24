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
const TSC_BIN = resolve(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const TS_SEGMENTS = ['core', 'l1', 'l2'];
const RES_SEGMENTS = ['core', 'l1', 'l2', 'l5'];
const RES_EXT = new Set(['.html', '.css', '.less', '.json', '.svg', '.md', '.sql']);
const FAIL_ON_TSC_ERRORS = process.env.COLLAB_FAIL_ON_TSC_ERRORS === '1';
const RUN_TSC_TYPECHECK = process.env.COLLAB_RUN_TSC_TYPECHECK === '1' || FAIL_ON_TSC_ERRORS;
const TSC_EMIT_BATCH_SIZE = Number.parseInt(process.env.COLLAB_TSC_EMIT_BATCH_SIZE ?? '40', 10);
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
  if (result.error) {
    throw new Error(`Failed to start command: ${cmd} ${args.join(' ')}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

function runTscCommand(args, label) {
  const fullArgs = [TSC_BIN, ...args];
  const displayBin = toPosix(relative(ROOT, TSC_BIN));
  log(`node ${displayBin} ${args.join(' ')}`);
  const result = spawnSync(process.execPath, fullArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    throw new Error(`Failed to start TypeScript compiler: ${result.error.message}`);
  }
  if (result.status === 0) return { ok: true, label };

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const status = result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
  const fatal = Boolean(result.signal) ||
    /SIGKILL|Killed|ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL|JavaScript heap out of memory/iu.test(output);
  return { ok: false, label, status, fatal, output };
}

async function runTsc(tsconfigPath, ids, compilerOptions) {
  if (RUN_TSC_TYPECHECK) {
    const check = runTscCommand(['-p', tsconfigPath, '--noEmit', '--pretty', 'false'], 'typecheck');
    if (!check.ok) {
      const summary = summarizeTypeScriptOutput(check.output) || tailOutput(check.output);
      if (FAIL_ON_TSC_ERRORS) {
        throw new Error([
          `TypeScript ${check.label} failed during publish (${check.status}).`,
          summary,
        ].filter(Boolean).join('\n'));
      }
      if (check.fatal) {
        log(`tsc typecheck could not complete (${check.status}); continuing with noCheck emit for low-memory publish:\n${summary}`);
      } else {
        log(`tsc reported type errors (continuing because COLLAB_FAIL_ON_TSC_ERRORS is not 1):\n${summary}`);
      }
    }
  } else {
    log('tsc typecheck skipped (set COLLAB_RUN_TSC_TYPECHECK=1 to run it before emit)');
  }

  // Emit one project per tsc process. The monolithic emit can be killed by Lima's
  // small VM memory limit; split emit keeps the release path reliable without swap.
  for (const id of ids) {
    const files = await collectProjectTsFiles(id);
    const emit = await runTscEmitConfig(`mls-${id}`, `.tsconfig.build.${id}.json`, files, compilerOptions);
    if (emit.ok) continue;

    if (emit.fatal && files.length > TSC_EMIT_BATCH_SIZE) {
      log(`tsc emit for mls-${id} could not complete (${emit.status}); retrying in batches of ${TSC_EMIT_BATCH_SIZE}`);
      const batched = await runTscEmitBatches(id, files, compilerOptions);
      if (batched) continue;
    }

    throw new Error([
      `TypeScript emit failed during publish for mls-${id} (${emit.status}).`,
      'No release will be activated because dist/local may be incomplete.',
      summarizeTypeScriptOutput(emit.output) || tailOutput(emit.output),
    ].filter(Boolean).join('\n'));
  }
}

async function runTscEmitConfig(label, configName, files, compilerOptions) {
  const configPath = resolve(ROOT, configName);
  await writeFile(configPath, `${JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: {
      ...compilerOptions,
      noResolve: true,
    },
    files,
  }, null, 2)}\n`, 'utf8');
  try {
    return runTscCommand(['-p', configPath, '--noCheck', '--pretty', 'false'], `emit ${label}`);
  } finally {
    await unlink(configPath).catch(() => undefined);
  }
}

async function runTscEmitBatches(id, files, compilerOptions) {
  const dtsFiles = files.filter((file) => file.endsWith('.d.ts'));
  const tsFiles = files.filter((file) => !file.endsWith('.d.ts'));
  const batchSize = Number.isFinite(TSC_EMIT_BATCH_SIZE) && TSC_EMIT_BATCH_SIZE > 0
    ? TSC_EMIT_BATCH_SIZE
    : 40;
  for (let start = 0, batch = 1; start < tsFiles.length; start += batchSize, batch += 1) {
    const batchFiles = [...dtsFiles, ...tsFiles.slice(start, start + batchSize)];
    const emit = await runTscEmitConfig(
      `mls-${id} batch ${batch}`,
      `.tsconfig.build.${id}.${batch}.json`,
      batchFiles,
      compilerOptions,
    );
    if (!emit.ok) {
      throw new Error([
        `TypeScript emit failed during publish for mls-${id} batch ${batch} (${emit.status}).`,
        'No release will be activated because dist/local may be incomplete.',
        summarizeTypeScriptOutput(emit.output) || tailOutput(emit.output),
      ].filter(Boolean).join('\n'));
    }
  }
  return true;
}

function summarizeTypeScriptOutput(output) {
  const lines = output.split(/\r?\n/u);
  const selected = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\berror TS\d+:/u.test(lines[i])) continue;
    selected.push(lines[i]);
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      if (!lines[j].trim()) break;
      if (/\berror TS\d+:/u.test(lines[j])) break;
      selected.push(lines[j]);
    }
  }
  if (selected.length > 0) return `TypeScript errors:\n${selected.slice(-40).join('\n')}`;
  const tail = lines.filter((line) => line.trim()).slice(-40).join('\n');
  return tail ? `Compiler output:\n${tail}` : '';
}

function tailOutput(output) {
  const tail = output.split(/\r?\n/u).filter((line) => line.trim()).slice(-40).join('\n');
  return tail ? `Compiler output:\n${tail}` : '';
}

function composeGeneratedConfig(clientId) {
  const clientRoot = resolve(ROOT, `mls-${clientId}`);
  const l5Path = existsSync(join(clientRoot, 'l5', 'runtime.project.json'))
    ? join(clientRoot, 'l5', 'runtime.project.json')
    : join(clientRoot, 'l5', 'project.json');
  if (!existsSync(l5Path)) return;
  let l5;
  try { l5 = JSON.parse(readFileSync(l5Path, 'utf8')); } catch { return; }
  for (const side of ['backend', 'frontend']) {
    const master = l5.masters?.[side];
    if (!master) continue;
    if (side === 'frontend' && FAIL_ON_TSC_ERRORS && hasMaterializedFrontendConfig(clientId)) {
      log(`frontend config already materialized for ${clientId}; skipping frontend composer during publish`);
      continue;
    }
    const composer = `mls-${master.masterProject}/l2/${master.agentFolder}/nodejsSaveConfigJson.ts`;
    if (existsSync(resolve(ROOT, composer))) run('pnpm', ['exec', 'tsx', composer, clientId]);
  }
}

function hasMaterializedFrontendConfig(clientId) {
  const configPath = join(ROOT, `mls-${clientId}`, 'l5', 'config.json');
  if (!existsSync(configPath)) return false;
  let config;
  try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { return false; }
  const client = config.projects?.[clientId];
  if (!client || client.type !== 'client') return false;
  return (client.modules ?? []).some((mod) => (mod.frontend?.pages ?? []).length > 0);
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

// Project id -> source root, populated from the generated client config in main().
const projectRoots = new Map();
function projectDir(id) {
  return projectRoots.get(id) ?? resolve(ROOT, `mls-${id}`);
}

function clientConfigPath(id) {
  // Single source of truth: mls-<id>/l5/config.json (composed by the publish generators).
  return join(projectDir(id), 'l5', 'config.json');
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

async function collectProjectTsFiles(id) {
  const roots = [
    resolve(ROOT, 'types'),
    ...TS_SEGMENTS.map((seg) => join(projectDir(id), seg)),
  ];
  const files = [];
  for (const root of roots) {
    for (const file of await walkFiles(root)) {
      if (file.endsWith('.ts') || file.endsWith('.d.ts')) {
        files.push(toPosix(relative(ROOT, file)));
      }
    }
  }
  return files;
}

async function pruneLocalDistProjects(ids) {
  if (!existsSync(LOCAL_DIST)) return;
  const keep = new Set(ids.map((id) => `_${id}_`));
  let pruned = 0;
  for (const entry of await readdir(LOCAL_DIST, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!/^_\d+_$/.test(entry.name)) continue;
    if (keep.has(entry.name)) continue;
    await rm(join(LOCAL_DIST, entry.name), { recursive: true, force: true });
    pruned += 1;
  }
  if (pruned > 0) log(`pruned ${pruned} extra dist/local project dir(s)`);
}

async function validateServerOutput(clientConfig) {
  const files = await walkFiles(LOCAL_DIST);
  const jsFiles = files.filter((file) => extname(file) === '.js');
  if (jsFiles.length === 0) {
    throw new Error([
      'Server build emitted no JavaScript files in dist/local.',
      'This usually means the TypeScript emit was killed or failed before completing.',
      'No release will be activated because PM2 would not find the backend entrypoint.',
    ].join('\n'));
  }

  const masterBackendId = Object.entries(clientConfig.projects ?? {})
    .find(([, project]) => project?.type === 'master backend')?.[0];
  if (masterBackendId) {
    const entrypoint = resolve(
      LOCAL_DIST,
      `_${masterBackendId}_`,
      'l1',
      'server',
      'layer_1_external',
      'transport',
      'http',
      'startServer.js',
    );
    if (!existsSync(entrypoint)) {
      throw new Error([
        `Master backend entrypoint was not emitted: ${entrypoint}`,
        'No release will be activated because PM2 would fail to start this release.',
      ].join('\n'));
    }
  }

  log(`server output validated (${jsFiles.length} js file(s) in dist/local)`);
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
  const compilerOptions = {
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
    noEmitOnError: FAIL_ON_TSC_ERRORS,
  };
  const tsconfig = {
    extends: './tsconfig.json',
    compilerOptions,
    include,
  };
  // Single, inspectable tsconfig at the project root (where the build runs).
  // Overwritten each run; not deleted.
  const tmp = resolve(ROOT, 'tsconfig.build.json');
  await writeFile(tmp, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
  log('tsconfig written: tsconfig.build.json');
  await runTsc('tsconfig.build.json', ids, compilerOptions);

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
  await pruneLocalDistProjects(ids);

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
      // Generated BFF test files (page11 <page>.test.ts) — tsc excludes **/*.test.ts, so the
      // entrypoint-driven esbuild is the only path that emits their compiled .js into the dist the
      // monitor Tests runner resolves. Stored as "_<id>_/..." (no leading slash); normalize to a
      // "/_<id>_/..." specifier so resolveSource matches and falls back to the .test.ts source.
      for (const testPath of fe?.pageTests ?? []) {
        addSource(testPath.startsWith('/') ? testPath : `/${testPath.replace(/^\.\//u, '')}`, projRoot);
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
    const cfgPath = clientConfigPath(id);
    if (!existsSync(cfgPath)) continue;
    let cfg;
    try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { continue; }
    if (cfg.projects?.[id]?.type === 'client' || cfg.defaultProjectId === id) candidates.push(id);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) throw new Error('No generated client config found. Pass --client <id> after composing it.');
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

  // ALWAYS run the composers (idempotent), not only with an explicit --client: the Studio-written
  // l5/config.json lacks the master runtime manifest merge (masterModules.json -> 102034
  // modules/persistenceModules). Publishing it raw ships a runtime without the platform tables —
  // the schema rebuild then creates only the client module's tables and migrate.js dies on
  // INSERT INTO "_schema_migrations" (publish 102049, 17/jul).
  const clientId = detectClientId(args.client);
  composeGeneratedConfig(clientId);
  const clientRoot = resolve(ROOT, `mls-${clientId}`);
  const configPath = clientConfigPath(clientId);
  if (!existsSync(configPath)) throw new Error(`generated config not found: ${configPath}`);
  const clientConfig = JSON.parse(await readFile(configPath, 'utf8'));

  // The project set comes from the generated client config (only what the app needs),
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
    run('node', ['scripts/processCssAfterCompile.mjs', '--dist', 'dist/local', ...ids]);
    await validateServerOutput(clientConfig);
    // make the chosen client config discoverable at the projects-dir root
    await cp(configPath, resolve(ROOT, 'config.json'));
    log('copied generated client config to project root');
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
