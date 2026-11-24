#!/usr/bin/env node
// build.mjs — mls-base runtime build
//
//   server  -> dist/local/_<id>_/...   (tsc emit; /_<id>_/ imports rewritten to
//                                        relative, completing .js when the target
//                                        exists in dist; resources copied; .js.map)
//   web     -> dist/web/                 (Lit único + shells com importmap + css +
//                                        l3; módulos do app vêm do compiled.zip)
//
// Source folders stay as mls-<id>; the output uses the _<id>_ layout the Forge
// runtime expects (resolveProjectDistPath -> dist/local/_<id>_, resolveWebDistPath
// -> dist/web).
//
// Usage:
//   node scripts/build.mjs                 # server + web
//   node scripts/build.mjs --only server   # only dist/local
//   node scripts/build.mjs --only web      # only dist/web
//   node scripts/build.mjs --client 102043 # pick the client app config
//   node scripts/build.mjs --client 102043 --use-existing-config --only server
//                                             # publish: compile without recomposing config

import { spawnSync } from 'node:child_process';
import { shipLevelsFor } from './buildCI/buildCI.mjs';
import { emitProject, rebaseSourceMapsInTree } from './emitProject.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildLitImportMap,
  contentVersionHash,
  emitLitRuntime,
  injectImportMap,
  litEntryContentVersions,
  litExportEntries,
  litPackageDir,
  readLitRuntimeConfig,
  stampTailwindHref,
} from './litRuntime.mjs';
import {
  cacheDisabled,
  gitHead,
  gitPorcelain,
  hashFile,
  legacyCacheReason,
  loadCheck,
  planLibCache,
  snapshotTypeCheck,
  typescriptVersion,
  writeCheckEntry,
} from './buildCache.mjs';
import { planVerification } from './releaseVerification.mjs';
import { readTypeCheckPolicy } from './typeCheckPolicy.mjs';
import { formatTypeCheckTsconfigLog, typeCheckProject } from './typeCheckRun.mjs';
import { timeStage } from './buildTimings.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
// VM compile uses the unversioned pruned copy written by addNewVersion
// (gb63). Mac `pnpm compile` without a prior release keeps extending tsconfig.json.
function baseTsconfigRel() {
  return existsSync(resolve(ROOT, 'tsconfig.vm.json')) ? './tsconfig.vm.json' : './tsconfig.json';
}
const LOCAL_DIST = resolve(DIST, 'local');
const WEB_DIST_DIR = 'web';
const TS_SEGMENTS = ['core', 'l1', 'l2'];
export const RES_SEGMENTS = ['core', 'l1', 'l2', 'l3', 'l5'];
export const RES_EXT = new Set([
  '.html', '.css', '.less', '.json', '.svg', '.md', '.sql',
  // Servable binary assets. `cp` copies bytes (not utf8); a text copy would
  // corrupt .wav/.png and the browser would get a 200 with garbage.
  '.wav', '.mp3', '.ogg',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico',
  '.woff2',
]);
// Matches absolute project specifiers in emitted JS: from '/_102034_/l1/...'
// Matches every form of project specifier in emitted JS:
//   from '/_..._/...'  | import '/_..._/...'  | import('/_..._/...')  | require('/_..._/...')
const ABS_IMPORT_RE =
  /(?<prefix>\b(?:from|import)\s+["']|\b(?:import|require)\s*\(\s*["'])(?<spec>\/_\d+_\/(?:core|l1|l2)\/[^"']+)(?<suffix>["'](?:\s*\))?)/gu;
const KNOWN_SPEC_EXT = /\.(?:d\.ts|defs\.ts|ts|tsx|js|jsx|mjs|cjs|json|css|less|html|node)$/u;

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

function logTypeCheck(report) {
  if (report.overrideLog) log(report.overrideLog);
  log(`typeCheck ${report.reportLine}`);
  if (report.toleratedLog) log(report.toleratedLog);
  for (const line of report.excerpt) log(`typeCheck ${line}`);
  log(report.marker);
}

function throwIfTypeCheckBlocked(blocked) {
  if (blocked.length === 0) return;
  const first = blocked[0];
  const status = first.policy?.status ?? first.policyStatus;
  throw new Error([
    `TypeScript typeCheck blocked mls-${first.projectId} (status=${status}).`,
    'permissive tolerates type, syntax and broken-import errors; emit/config failures and a tsc crash block in both modes (rt34).',
    (first.excerpt ?? []).join('\n') || first.reportLine,
  ].filter(Boolean).join('\n'));
}

// `release`: libs are not verified (only emitted); the app is verified here only when
// it is `strict` — a `permissive` app is verified after activation (rt192).
async function runTsc(_tsconfigPath, ids, compilerOptions, clientId, { release = false } = {}) {
  if (process.env.COLLAB_RUN_TSC_TYPECHECK === '0') {
    log('COLLAB_RUN_TSC_TYPECHECK=0 is ignored: typecheck always runs; the verdict is l5/project.json typeCheck.status');
  }
  const cacheOff = cacheDisabled();
  if (cacheOff) log('COLLAB_BUILD_CACHE=0: build cache off');
  const cacheRoot = resolve(ROOT, '.buildCache');
  const baseRel = baseTsconfigRel();
  const baseAbs = resolve(ROOT, baseRel);
  const plans = cacheOff ? [] : planLibCache({
    ids,
    clientId,
    dirs: Object.fromEntries(ids.map((id) => [id, projectDir(id)])),
    compilerOptions,
    tsVersion: typescriptVersion(ROOT),
    baseHash: existsSync(baseAbs) ? hashFile(baseAbs) : 'missing-base',
  });
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  if (!cacheOff) {
    const legacy = legacyCacheReason(cacheRoot);
    if (legacy) log(`build cache ignored: ${legacy}`);
  }
  const blocked = [];
  const freshCheck = new Map();
  const depNow = (depId) => {
    const dir = projectDir(depId);
    return { head: gitHead(dir), porcelain: gitPorcelain(dir) };
  };
  console.log(formatTypeCheckTsconfigLog(ROOT));
  const verification = release
    ? planVerification({
      ids,
      clientId,
      statusOf: (id) => readTypeCheckPolicy(projectDir(id)).status,
    })
    : null;
  for (const id of ids) {
    const extra = { alvo: String(id) };
    await timeStage('typeCheck', async () => {
      if (verification && !verification.now.includes(String(id))) {
        log(`typeCheck mls-${id} skipped: ${verification.deferred.includes(String(id)) ? 'deferred until after activation (permissive)' : 'library, release does not verify it'}`);
        return;
      }
      const plan = planById.get(String(id));
      if (plan?.eligible) {
        const loaded = await loadCheck(cacheRoot, id, plan.checkBase, depNow);
        if (loaded.hit) {
          extra.cache = 'hit';
          logTypeCheck(loaded.report);
          log(`typeCheck mls-${id} cached ${plan.checkBase.slice(0, 12)}`);
          if (loaded.report.block) blocked.push(loaded.report);
          return;
        }
        if (loaded.reason !== 'miss') log(`build cache mls-${id} ignored: ${loaded.reason}`);
      }
      extra.cache = 'miss';
      const report = typeCheckProject({ root: ROOT, projectId: id });
      logTypeCheck(report);
      const snap = snapshotTypeCheck(report);
      if (!snap.block && plan?.eligible) {
        const deps = (report.loadedProjectIds ?? []).map((depId) => {
          const now = depNow(depId);
          return { id: String(depId), head: now.head, porcelain: now.porcelain };
        });
        const saveCheck = deps.every((dep) => dep.head && dep.porcelain === '');
        if (!saveCheck) {
          log(`build cache mls-${id} check not written: dependency not a clean HEAD`);
        }
        freshCheck.set(String(id), {
          checkBase: plan.checkBase,
          report: snap,
          deps: deps.map((dep) => ({ id: dep.id, head: dep.head ?? '' })),
          saveCheck,
        });
      }
      if (report.verdict.block) blocked.push(report);
    }, extra);
  }
  throwIfTypeCheckBlocked(blocked);

  /** @type {Map<string, { hit: boolean, dir: string }>} */
  const emitted = new Map();
  for (const id of ids) {
    const extra = { alvo: String(id), cache: 'miss' };
    const result = await timeStage('emit', async () => {
      const emittedProject = await emitProject(ROOT, String(id), { levels: emitLevelsFor(id) });
      extra.cache = emittedProject.hit ? 'hit' : 'miss';
      return emittedProject;
    }, extra);
    emitted.set(String(id), result);
  }
  return { cacheRoot, freshCheck, emitted };
}

// Server reads core, l1 and l2. Platform libs also emit l4 into the same tree
// so the browser zip can take it from this emission.
function emitLevelsFor(id) {
  const levels = ['core', 'l1', 'l2'];
  const projectJson = join(projectDir(id), 'l5', 'project.json');
  if (!existsSync(projectJson)) return levels;
  let projectType;
  try {
    projectType = JSON.parse(readFileSync(projectJson, 'utf8')).projectType;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`mls-${id} l5/project.json unreadable (${message}); emitting without l4`);
    return levels;
  }
  if (shipLevelsFor(projectType).includes('l4')) levels.push('l4');
  return levels;
}

// Bytes, not git checkout: an uncommitted edit in l5/config.json must survive the build.
export function snapshotClientFiles(clientRoot, relPaths) {
  const snaps = relPaths.map((rel) => {
    const abs = join(clientRoot, rel);
    if (!existsSync(abs)) return { rel, abs, absent: true };
    const st = statSync(abs);
    return { rel, abs, absent: false, bytes: readFileSync(abs), atime: st.atime, mtime: st.mtime };
  });
  return function restore() {
    const changed = [];
    for (const snap of snaps) {
      const nowAbsent = !existsSync(snap.abs);
      if (snap.absent) {
        if (!nowAbsent) {
          unlinkSync(snap.abs);
          changed.push(snap.rel);
        }
        continue;
      }
      const now = nowAbsent ? null : readFileSync(snap.abs);
      if (nowAbsent || !now.equals(snap.bytes)) {
        mkdirSync(dirname(snap.abs), { recursive: true });
        writeFileSync(snap.abs, snap.bytes);
        // Same bytes, same mtime: a new mtime makes buildProjectsObj.isStale see the
        // app as always "old" and rebuild it on every release (rt192).
        utimesSync(snap.abs, snap.atime, snap.mtime);
        changed.push(snap.rel);
      }
    }
    if (changed.length > 0) log(`client files restored after compose: ${changed.join(', ')}`);
  };
}

export async function withClientFilesRestored(clientRoot, relPaths, fn) {
  const restore = snapshotClientFiles(clientRoot, relPaths);
  try {
    return await fn();
  } finally {
    restore();
  }
}

function composeGeneratedConfig(clientId) {
  const clientRoot = resolve(ROOT, `mls-${clientId}`);
  const l5Path = existsSync(join(clientRoot, 'l5', 'runtime.project.json'))
    ? join(clientRoot, 'l5', 'runtime.project.json')
    : join(clientRoot, 'l5', 'project.json');
  if (!existsSync(l5Path)) return;
  let l5;
  try { l5 = JSON.parse(readFileSync(l5Path, 'utf8')); } catch { return; }
  // Projeto sem modulos = scaffold recem-criado (projectInit) numa VM: nao ha backend nem frontend
  // para compor, e os composers tratam "nada a compor" como erro (o do backend faz `throw`). Sem
  // isto o primeiro release de uma VM nova e impossivel: o app nao sobe, a porta /git/ da 502 e o
  // primeiro push nao tem para onde ir. Medido em 03/09 no 102043 (gb56).
  if (!Array.isArray(l5.modules) || l5.modules.length === 0) {
    log(`${clientId} declares no modules yet; skipping config composers`);
    return;
  }
  for (const side of ['backend', 'frontend']) {
    const master = l5.masters?.[side];
    if (!master) continue;
    const typeCheck = readTypeCheckPolicy(clientRoot);
    if (side === 'frontend' && typeCheck.status === 'strict' && hasMaterializedFrontendConfig(clientId)) {
      log(`frontend config already materialized for ${clientId}; skipping frontend composer during publish`);
      continue;
    }
    const composer = `mls-${master.masterProject}/l2/${master.agentFolder}/nodejsSaveConfigJson.ts`;
    if (existsSync(resolve(ROOT, composer))) {
      timeStage('main.nodejsSaveConfigJson', () => {
        run('pnpm', ['exec', 'tsx', composer, clientId]);
      }, { alvo: String(master.masterProject) });
    }
    else log(`composer ausente: ${composer} (agentFolder=${master.agentFolder})`);
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

// Master modules always come from mls-<master>/masterModules.json. The copy in the
// client's l5/config.json is ignored (git is never rewritten here).
export function withMasterRuntimeManifest(config, readManifest) {
  const entry = Object.entries(config?.projects ?? {}).find(([, project]) => project?.type === 'master backend');
  if (!entry) return { config, replaced: [], differed: [] };
  const [masterId, master] = entry;
  const manifest = readManifest(masterId);
  if (manifest == null || typeof manifest !== 'object') {
    throw new Error(`masterModules.json de ${masterId} ausente ou inválido: manifesto vazio`);
  }
  const replaced = [];
  const differed = [];
  const merged = { ...master };
  for (const key of ['modules', 'persistenceModules']) {
    const fromManifest = manifest[key] ?? [];
    const current = master[key] ?? [];
    merged[key] = fromManifest;
    replaced.push(key);
    if (current.length > 0 && JSON.stringify(current) !== JSON.stringify(fromManifest)) {
      differed.push(key);
    }
  }
  return { config: { ...config, projects: { ...config.projects, [masterId]: merged } }, replaced, differed };
}

export function assertPlatformPersistence(config) {
  const master = Object.values(config?.projects ?? {}).find((project) => project?.type === 'master backend');
  if (!master) return;
  const hasPlatform = (master.persistenceModules ?? []).some((mod) => mod?.moduleId === 'platform');
  if (!hasPlatform) {
    throw new Error("master persistenceModules missing moduleId 'platform'");
  }
}

export function readMasterRuntimeManifest(masterId) {
  const path = resolve(ROOT, `mls-${masterId}`, 'masterModules.json');
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('não é um objeto JSON');
    }
    return parsed;
  } catch (err) {
    throw new Error(`masterModules.json de ${masterId} ausente ou inválido: ${err.message}`);
  }
}

export function setProjectRoot(id, absPath) {
  if (absPath == null) projectRoots.delete(id);
  else projectRoots.set(id, absPath);
}

function clientConfigPath(id) {
  // Single source of truth: mls-<id>/l5/config.json (composed by the publish generators).
  return join(projectDir(id), 'l5', 'config.json');
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

/**
 * Emit the L4 definitions (the `.defs.ts` files under `l4/`: journeys, ontology, workflows, ...) of every project into
 * `<destRoot>/_<id>_/l4/` as `.defs.js`. They are data the runtime reads (the assistant catalog); they are only
 * transpiled, never type-checked or rewritten here, so the release's typeCheck stays what it was. Each file holds
 * `import type` only, which the transpile erases.
 */
export async function emitL4Defs(ids, destRoot) {
  const { default: ts } = await import('typescript');
  let emitted = 0;
  for (const id of ids) {
    const root = join(projectDir(id), 'l4');
    for (const file of await walkFiles(root)) {
      if (!file.endsWith('.defs.ts')) continue;
      const out = ts.transpileModule(await readFile(file, 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      const dest = resolve(destRoot, `_${id}_`, toPosix(relative(projectDir(id), file)).replace(/\.ts$/u, '.js'));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, out.outputText, 'utf8');
      emitted += 1;
    }
  }
  return emitted;
}

/**
 * Copy the L2 contract sources (`l2/<module>/web/contracts/*.defs.ts`) of every project, as text, into
 * `<destRoot>/_<id>_/l2/<module>/web/contracts/` next to the emitted `.defs.js` (which is `export {}`: the types are
 * the only place that says what a route takes and returns). The runtime reads this text to describe the app's
 * actions; nothing here compiles or rewrites it.
 */
export async function copyContractSources(ids, destRoot) {
  let copied = 0;
  for (const id of ids) {
    const root = join(projectDir(id), 'l2');
    for (const file of await walkFiles(root)) {
      const rel = toPosix(relative(projectDir(id), file));
      if (!/^l2\/[^/]+\/web\/contracts\/[^/]+\.defs\.ts$/u.test(rel)) continue;
      const dest = resolve(destRoot, `_${id}_`, rel);
      await mkdir(dirname(dest), { recursive: true });
      await cp(file, dest);
      copied += 1;
    }
  }
  return copied;
}

/**
 * Copy every project's l3 ASSET payload into `<destRoot>/_<id>_/l3/...`.
 *
 * Two layouts:
 *   `l3/<module>/assets/**` — registered app (seed images; BFF returns `/cafeFlow/assets/...`)
 *   `l3/assets/**`          — library / project-level (e.g. collab-messages notification wav)
 *
 * No extension filter: an `assets` directory IS static payload by definition. `cp` copies
 * bytes, so wav/png/woff2 stay intact.
 */
export async function copyL3Assets(ids, destRoot) {
  let copied = 0;
  for (const id of ids) {
    const l3 = join(projectDir(id), 'l3');
    if (!existsSync(l3)) continue;
    for (const file of await walkFiles(l3)) {
      const rel = toPosix(relative(l3, file));
      // <module>/assets/** (app) OR assets/** (library, no module prefix)
      if (!/^(?:[^/]+\/)?assets\//u.test(rel)) continue;
      const dest = resolve(destRoot, `_${id}_`, 'l3', rel);
      await mkdir(dirname(dest), { recursive: true });
      await cp(file, dest);
      copied += 1;
    }
  }
  return copied;
}

export async function collectProjectTsFiles(id) {
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

// Node ESM (dist/local is `"type":"module"`) requires a file extension. This
// rewrite already turns `/_<id>_/...` into a relative path; complete `.js` in
// the same pass when that file exists, so an LLM-omitted extension does not
// ship as an unresolvable specifier. Missing target stays extensionless —
// inventing `.js` would hide a genuinely broken import.
function makeAbsImportRe() {
  return new RegExp(ABS_IMPORT_RE.source, ABS_IMPORT_RE.flags);
}

export function rewriteAbsoluteImportSource(source, fromFile, localDist) {
  let completed = 0;
  const updated = source.replace(makeAbsImportRe(), (...args) => {
    const g = args.at(-1);
    let spec = g.spec;
    if (!KNOWN_SPEC_EXT.test(spec)) {
      const jsPath = `${resolve(localDist, spec.slice(1))}.js`;
      if (existsSync(jsPath)) {
        spec = `${spec}.js`;
        completed += 1;
      }
    }
    const targetPath = resolve(localDist, spec.slice(1));
    let rel = toPosix(relative(dirname(fromFile), targetPath));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `${g.prefix}${rel}${g.suffix}`;
  });
  return { updated, completed };
}

export async function rewriteLocalDistAbsoluteImports(localDist = LOCAL_DIST) {
  let rewritten = 0;
  let completed = 0;
  for (const file of (await walkFiles(localDist)).filter((f) => extname(f) === '.js')) {
    const current = await readFile(file, 'utf8');
    const result = rewriteAbsoluteImportSource(current, file, localDist);
    if (result.updated !== current) {
      await writeFile(file, result.updated, 'utf8');
      rewritten += 1;
    }
    completed += result.completed;
  }
  log(`rewrote absolute imports in ${rewritten} file(s); completed .js on ${completed} specifier(s)`);
  return { rewritten, completed };
}

// The cache keeps the compiler output. dist/local receives core, l1 and l2,
// then the import rewrite. l4 stays in the cache for the browser zip.
async function copyEmittedProject(id, dir) {
  const src = join(dir, `mls-${id}`);
  const target = join(LOCAL_DIST, `_${id}_`);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const seg of TS_SEGMENTS) {
    const from = join(src, seg);
    if (!existsSync(from)) continue;
    await cp(from, join(target, seg), { recursive: true });
    await rebaseSourceMapsInTree(from, join(target, seg));
  }
  const typesFrom = join(dir, 'types');
  if (existsSync(typesFrom)) {
    await cp(typesFrom, join(LOCAL_DIST, 'types'), { recursive: true });
  }
}

// ── server build (dist/local) ────────────────────────────────────────────────
async function buildServer(ids, clientId, { release = false } = {}) {
  log(`server build -> dist/local (${ids.map((i) => 'mls-' + i).join(' ')})`);
  await timeStage('buildServer.cleanLocalDist', () => rm(LOCAL_DIST, { recursive: true, force: true }));

  // dynamic tsconfig: paths from the project set, emit to dist/local, sourcemaps on.
  // Relative path values (leading "./") resolve correctly without baseUrl, so the
  // file lives at the project root and stays forward-compatible (no baseUrl).
  const { compilerOptions } = await timeStage('buildServer.tsconfig', async () => {
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
    const options = {
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
    };
    const tsconfig = {
      extends: baseTsconfigRel(),
      compilerOptions: options,
      include,
    };
    // Single, inspectable tsconfig at the project root (where the build runs).
    // Overwritten each run; not deleted.
    const tmp = resolve(ROOT, 'tsconfig.build.json');
    await writeFile(tmp, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
    log('tsconfig written: tsconfig.build.json');
    return { compilerOptions: options };
  });
  const { cacheRoot, freshCheck, emitted } = await runTsc('tsconfig.build.json', ids, compilerOptions, clientId, { release });
  await timeStage('buildServer.copyEmitted', async () => {
    await mkdir(LOCAL_DIST, { recursive: true });
    for (const [id, result] of emitted) {
      await copyEmittedProject(id, result.dir);
    }
  });
  await timeStage('buildServer.writeCheck', async () => {
    for (const [id, saved] of freshCheck) {
      if (!saved.saveCheck) continue;
      try {
        const written = await writeCheckEntry({
          cacheRoot,
          id,
          baseKey: saved.checkBase,
          report: saved.report,
          deps: saved.deps,
        });
        if (written.cleanupError) log(`build cache mls-${id} cleanup: ${written.cleanupError}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`build cache mls-${id} check not written: ${message}`);
      }
    }
  });
  await timeStage('buildServer.pruneLocalDist', () => pruneLocalDistProjects(ids));

  // mark the emitted tree as ESM so Node treats the .js as modules
  await timeStage('buildServer.packageJson', async () => {
    await mkdir(LOCAL_DIST, { recursive: true });
    await writeFile(resolve(LOCAL_DIST, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`, 'utf8');
  });

  // rewrite /_<id>_/... imports to relative paths within dist/local
  await timeStage('buildServer.rewriteImports', () => rewriteLocalDistAbsoluteImports(LOCAL_DIST));

  // copy non-TS resources (sql/html/css/less/json/svg/md + binary assets) into dist/local/_<id>_
  let copied = 0;
  copied += await timeStage('buildServer.copyResources', async () => {
    let count = 0;
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
          count += 1;
        }
      }
    }
    return count;
  });
  copied += await timeStage('buildServer.copyL3Assets', () => copyL3Assets(ids, LOCAL_DIST));
  log(`copied ${copied} resource file(s) to dist/local`);
  await timeStage('buildServer.emitL4Defs', async () => {
    log(`emitted ${await emitL4Defs(ids, LOCAL_DIST)} L4 def file(s) to dist/local`);
  });
  await timeStage('buildServer.copyContractSources', async () => {
    log(`copied ${await copyContractSources(ids, LOCAL_DIST)} L2 contract source(s) to dist/local`);
  });
}

// ── web build (dist/web) ─────────────────────────────────────────────────────
// Resolve a virtual path like "./_102033_/l2/.../index.html" to its real source
// file and its dist-relative path (which keeps the _<id>_ form).
function resolveVirtual(p) {
  const rel = p.replace(/^\.\//u, '');
  const m = /^_(\d+)_\/(.+)$/u.exec(rel);
  const abs = m ? resolve(projectDir(m[1]), m[2]) : resolve(ROOT, rel);
  return { abs, rel };
}

export async function buildWeb(clientConfig, ids) {
  const outdir = resolve(DIST, WEB_DIST_DIR);
  await timeStage('buildWeb.clean', () => rm(outdir, { recursive: true, force: true }));

  // O Lit sai UMA vez em _libs/lit/ (ver scripts/litRuntime.mjs). O importmap
  // dos shells, gerado abaixo, é a única forma de `lit` chegar ao browser.
  const lit = await timeStage('buildWeb.lit', async () => {
    const litConfig = readLitRuntimeConfig(ROOT);
    const { dir: litPkgDir, pkgJson: litPkgJson } = litPackageDir(ROOT, litConfig.package);
    const litEntries = litExportEntries(litPkgJson);
    const litCount = await emitLitRuntime({
      root: ROOT, outdir, config: litConfig, entries: litEntries, pkgDir: litPkgDir,
    });
    log(`lit runtime -> ${litConfig.outDir} (${litCount} modules, served at ${litConfig.baseUrl})`);
    return { litConfig, litEntries };
  });
  await timeStage('buildWeb.echarts', async () => {
    const echartsSource = resolve(ROOT, 'node_modules/echarts/dist/echarts.min.js');
    const echartsTarget = resolve(outdir, '_libs/echarts.min.js');
    if (!existsSync(echartsSource)) throw new Error(`local ECharts runtime not found at ${echartsSource}`);
    await mkdir(dirname(echartsTarget), { recursive: true });
    await cp(echartsSource, echartsTarget);
    log('echarts runtime -> _libs/echarts.min.js');
  });
  log(`web build -> dist/${WEB_DIST_DIR} (Lit + shells + css + l3; app modules come from the zip)`);

  // copy l2/l3 static resources (html/css/svg/json/md/wav/png/…) into dist/web
  let copied = 0;
  copied += await timeStage('buildWeb.copyStatic', async () => {
    let count = 0;
    for (const id of ids) {
      for (const layer of ['l2', 'l3']) {
        const src = join(projectDir(id), layer);
        if (!existsSync(src)) continue;
        for (const file of await walkFiles(src)) {
          const ext = extname(file);
          if (!RES_EXT.has(ext) && ext !== '') continue;
          if (ext === '.ts' || ext === '.tsx') continue;
          const rel = toPosix(relative(src, file));
          const dest = resolve(outdir, `_${id}_`, layer, rel);
          await mkdir(dirname(dest), { recursive: true });
          await cp(file, dest);
          count += 1;
        }
      }
    }
    return count;
  });
  copied += await timeStage('buildWeb.copyL3Assets', () => copyL3Assets(ids, outdir));
  log(`copied ${copied} static file(s) to dist/${WEB_DIST_DIR}`);

  // compile Tailwind for each master-frontend project, overwriting the copied
  // source css with the built one. @source covers every project's l2 so
  // cross-project class names are included.
  await timeStage('buildWeb.tailwind', async () => {
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
  });

  // copy shell templates referenced by config.json (kept in their _<id>_ path),
  // injetando o importmap do Lit gerado acima.
  await timeStage('buildWeb.importmap', async () => {
    const { litConfig, litEntries } = lit;
    const litVersions = litEntryContentVersions(outdir, litConfig.outDir, litEntries);
    const litImportMap = buildLitImportMap(litConfig.package, litConfig.baseUrl, litEntries, litVersions);
    let shells = 0;
    for (const shellPath of Object.values(clientConfig.shellTemplates ?? {})) {
      const { abs, rel } = resolveVirtual(shellPath);
      if (!existsSync(abs)) continue;
      const dest = resolve(outdir, rel);
      await mkdir(dirname(dest), { recursive: true });
      const html = stampTailwindHref(injectImportMap(await readFile(abs, 'utf8'), litImportMap), (href) => {
        const file = resolve(outdir, href.replace(/^\//u, ''));
        if (!existsSync(file)) throw new Error(`tailwind.css missing for ${href}`);
        return contentVersionHash(readFileSync(file));
      });
      await writeFile(dest, html, 'utf8');
      shells += 1;
    }
    log(`lit importmap injetado em ${shells} shell(s), ${Object.keys(litImportMap.imports).length} specifiers`);
  });
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
  const args = { only: '', client: '', useExistingConfig: false, release: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--only') args.only = argv[++i] ?? '';
    else if (argv[i] === '--client') args.client = argv[++i] ?? '';
    else if (argv[i] === '--use-existing-config') args.useExistingConfig = true;
    else if (argv[i] === '--release') args.release = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const clientId = detectClientId(args.client);
  const clientRoot = resolve(ROOT, `mls-${clientId}`);
  const { clientConfig, ids } = await withClientFilesRestored(
    clientRoot,
    ['l5/config.json', 'mlsDep.json'],
    async () => {
      if (args.useExistingConfig) {
        log(`using existing client config for ${clientId} (composer skipped)`);
      } else {
        // Normally run the composers: the Studio-written l5/config.json lacks the
        // master runtime manifest merge (masterModules.json -> 102034
        // modules/persistenceModules). The publish client validates that merge
        // before invoking this build with --use-existing-config.
        // nodejsSaveConfigJson is its own stage inside composeGeneratedConfig.
        timeStage('main.composeConfig', () => {
          composeGeneratedConfig(clientId);
        });
      }
      const configPath = clientConfigPath(clientId);
      if (!existsSync(configPath)) throw new Error(`generated config not found: ${configPath}`);
      const composed = JSON.parse(await timeStage('main.readConfig', () => readFile(configPath, 'utf8')));
      const { config, replaced, differed } = withMasterRuntimeManifest(composed, readMasterRuntimeManifest);
      if (replaced.length > 0) log(`master manifest replaced ${replaced.join(', ')}`);
      if (differed.length > 0) log(`master manifest differed ${differed.join(', ')} (client copy ignored)`);
      assertPlatformPersistence(config);

      // The project set comes from the generated client config (only what the app needs),
      // with each project's source root resolved from its `root` field.
      const projectIds = Object.keys(config.projects ?? {});
      if (projectIds.length === 0) throw new Error('config.json declares no projects.');
      for (const id of projectIds) {
        const root = config.projects[id]?.root ?? `../mls-${id}`;
        projectRoots.set(id, resolve(clientRoot, root));
      }
      log(`client=${clientId} projects=${projectIds.join(' ')}`);

      if (args.only !== 'web') {
        await buildServer(projectIds, clientId, { release: args.release });
        // post-compile: compile each project's .less and inject into the per-file JS
        // (same mls-ci routine the GitHub Action uses; requires the /// <mls header,
        // so it applies to dist/local only)
        timeStage('main.processCss', () => {
          run('node', ['scripts/processCssAfterCompile.mjs', '--dist', 'dist/local', ...projectIds]);
        });
        await timeStage('main.validateServer', () => validateServerOutput(config));
        // make the chosen client config discoverable at the projects-dir root
        await timeStage('main.writeRootConfig', async () => {
          await writeFile(resolve(ROOT, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
          log('copied generated client config to project root');
        });
      }
      return { clientConfig: config, ids: projectIds };
    },
  );

  if (args.only !== 'server') {
    await buildWeb(clientConfig, ids);
  }

  log('build finished');
}

// realpath on BOTH sides: import.meta.url is already resolved, process.argv[1]
// is whatever the caller typed (symlink, relative path).
function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  const real = (path) => { try { return realpathSync(path); } catch { return resolve(path); } };
  try {
    return real(fileURLToPath(import.meta.url)) === real(entry);
  } catch {
    return false;
  }
}

if (invokedAsMain()) {
  main().catch((error) => {
    console.error(`[build] aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
