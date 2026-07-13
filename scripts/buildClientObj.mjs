#!/usr/bin/env node
// buildClientObj.mjs — generate the collab.codes obj/ artifacts for a CLIENT app project locally.
//
// Why this exists
// ---------------
// The masters and libs (mls-102021, 102025, ...) are git repos with a GitHub Action that runs
// `mls-ci` (`runCI`), which writes obj/{source.zip,compiled.zip} on every push. A CLIENT app that is
// synced with collab.codes instead of git (e.g. mls-102051) has no .git and no Action, so its obj is
// never produced. collab.codes hydrates a project's sources on cache-miss from the stored file
// `<prj>_0_obj_source.zip` (see cfe-collab-front-end/src/stor/stor.server.ts `unzipSourcesIfNeeded`),
// so without obj/source.zip the web service cannot serve the client's files. This script fills that
// gap for the client only ("os outros projetos não precisa" — they still get obj from CI).
//
// What it produces (matching the real mls-ci output layout, verified against a CI-built project)
// ----------------------------------------------------------------------------------------------
//   obj/source.zip    zip of l1..l7 with entry names `l<level>/<...>` (mirrors mls-ci/compactSource).
//                     This is the artifact `unzipSourcesIfNeeded` consumes. Always generated here.
//   obj/compiled.zip  `_<id>_/l2/*.js` (compiled + LESS-enhanced) + `types/importsMap.json` +
//                     `types/index.d.ts` (mirrors mls-ci/compact, which drops l1). The enhanced JS is
//                     the output of the local build (`dist/local/_<id>_`, produced by scripts/build.mjs
//                     — the SAME mls-ci enhancement routine the Action uses). Because that build needs
//                     a working esbuild, run `pnpm compile` (or `pnpm build --client <id>`) on a real
//                     machine first; if dist/local/_<id>_ is missing this step is skipped with a note.
//
// Usage:
//   node scripts/buildClientObj.mjs [--client <id>] [--source-only]
//   (client id defaults to the generated config whose project is type "client" / defaultProjectId)

import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function clientConfigPath(id) {
  // Single source of truth: mls-<id>/l5/config.json.
  return join(ROOT, `mls-${id}`, 'l5', 'config.json');
}
const SOURCE_FOLDERS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
const SKIP_NAMES = new Set(['.DS_Store']);
const SKIP_PATTERNS = [/^publish\.[A-Za-z0-9_.-]+\.conf$/];
const STABLE_ZIP_TIME = new Date('2000-01-01T00:00:00.000Z');

function log(msg) {
  console.log(`[buildClientObj] ${msg}`);
}

function sortedDirEntries(absDir) {
  return readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function addStableFile(zip, zipPath, content) {
  const entry = zip.addFile(zipPath, content);
  entry.header.time = STABLE_ZIP_TIME;
  return entry;
}

function writeZipIfChanged(zip, out, writtenMessage, unchangedMessage) {
  const next = zip.toBuffer();
  if (existsSync(out)) {
    const current = readFileSync(out);
    if (current.equals(next)) {
      log(unchangedMessage);
      return false;
    }
  }
  writeFileSync(out, next);
  log(writtenMessage);
  return true;
}

function parseArgs(argv) {
  const args = { client: '', projects: [], sourceOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--client') args.client = argv[++i] ?? '';
    else if (argv[i] === '--projects') args.projects = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--source-only') args.sourceOnly = true;
  }
  return args;
}

// A client app is a project whose generated config marks it type "client" (or names it defaultProjectId).
function detectClientId(explicit) {
  if (explicit) return explicit;
  const candidates = [];
  for (const name of readdirSync(ROOT).sort((a, b) => a.localeCompare(b))) {
    const m = /^mls-(\d+)$/.exec(name);
    if (!m || !statSync(join(ROOT, name)).isDirectory()) continue;
    const id = m[1];
    const cfgPath = clientConfigPath(id);
    if (!existsSync(cfgPath)) continue;
    let cfg;
    try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { continue; }
    if (cfg.projects?.[id]?.type === 'client' || cfg.defaultProjectId === id) candidates.push(id);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) throw new Error('No generated client config found. Pass --client <id>.');
  throw new Error(`Multiple client apps found (${candidates.join(', ')}). Pass --client <id>.`);
}

// Recursively add a source folder to the zip under `l<n>/...`, skipping junk files. Mirrors
// mls-ci/compactSource (adm-zip addLocalFolder) but filters .DS_Store so a macOS checkout produces
// the same entries a Linux CI run would.
function addSourceFolder(zip, absFolder, zipBase) {
  for (const entry of sortedDirEntries(absFolder)) {
    if (SKIP_NAMES.has(entry.name)) continue;
    if (SKIP_PATTERNS.some((pattern) => pattern.test(entry.name))) continue;
    const abs = join(absFolder, entry.name);
    const zipPath = `${zipBase}/${entry.name}`;
    if (entry.isDirectory()) addSourceFolder(zip, abs, zipPath);
    else if (entry.isFile()) addStableFile(zip, zipPath, readFileSync(abs));
  }
}

function buildSourceZip(clientRoot, objDir) {
  const zip = new AdmZip();
  let folders = 0;
  for (const folder of SOURCE_FOLDERS) {
    const abs = join(clientRoot, folder);
    if (!existsSync(abs)) continue;
    addSourceFolder(zip, abs, folder);
    folders += 1;
  }
  if (folders === 0) throw new Error(`client project has no l1..l7 source folders under ${clientRoot}`);
  const out = join(objDir, 'source.zip');
  writeZipIfChanged(
    zip,
    out,
    `source.zip written (${folders} source folder(s)) -> ${relative(ROOT, out)}`,
    `source.zip unchanged (${folders} source folder(s)) -> ${relative(ROOT, out)}`,
  );
}

// Reproduces mls-ci/createJsonImports: for each TOP-LEVEL .ts file in l2, record its import
// specifiers. Keyed by filename. Pure TS parsing — no build needed.
function buildImportsMap(clientRoot) {
  const l2 = join(clientRoot, 'l2');
  const map = {};
  if (!existsSync(l2)) return map;
  for (const entry of sortedDirEntries(l2)) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const source = ts.createSourceFile('temp.ts', readFileSync(join(l2, entry.name), 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const imports = [];
    ts.forEachChild(source, (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    });
    map[entry.name] = imports;
  }
  return map;
}

// Reproduces mls-ci/createFileInfo: fileinfos.json indexes the project's SOURCE files
// ({lastModified, files:[{shortPath,versionRef,Length,update_at}]}). Both the central cbe and the
// runtime cbe module (mls-102034) use it to build the login filesInfo — a compiled.zip WITHOUT it
// yields an empty filesInfo and breaks the frontend ("Invalid project information ... file length:0").
// The CI uses git OIDs as versionRef; a collab-synced client has no git, so we use a content sha1
// (stable across runs, changes when the file changes — enough for the update comparison).
function readPreviousFileInfos(objDir) {
  const compiledZip = join(objDir, 'compiled.zip');
  if (!existsSync(compiledZip)) return null;
  try {
    const entry = new AdmZip(compiledZip).getEntry('fileinfos.json');
    if (!entry) return null;
    const parsed = JSON.parse(entry.getData().toString('utf8'));
    if (!Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildFileInfos(clientRoot, previousFileInfos) {
  const previousByPath = new Map((previousFileInfos?.files ?? []).map((file) => [file.shortPath, file]));
  const files = [];
  let changed = !previousFileInfos;
  const walk = (absDir, zipBase) => {
    for (const entry of sortedDirEntries(absDir)) {
      if (SKIP_NAMES.has(entry.name)) continue;
      if (SKIP_PATTERNS.some((pattern) => pattern.test(entry.name))) continue;
      const abs = join(absDir, entry.name);
      const zipPath = `${zipBase}/${entry.name}`;
      if (entry.isDirectory()) walk(abs, zipPath);
      else if (entry.isFile()) {
        const content = readFileSync(abs);
        const versionRef = createHash('sha1').update(content).digest('hex');
        const previous = previousByPath.get(zipPath);
        const isSameFile = previous?.versionRef === versionRef && previous?.Length === content.length;
        if (!isSameFile) changed = true;
        files.push({
          shortPath: zipPath,
          versionRef,
          Length: content.length,
          update_at: isSameFile && previous?.update_at ? previous.update_at : statSync(abs).mtime.toISOString(),
        });
      }
    }
  };
  for (const folder of SOURCE_FOLDERS) {
    const abs = join(clientRoot, folder);
    if (existsSync(abs)) walk(abs, folder);
  }
  if (previousFileInfos?.files?.length !== files.length) changed = true;
  return {
    lastModified: changed ? new Date().toISOString() : previousFileInfos.lastModified,
    files,
  };
}

// The local build emits the compiled+enhanced JS under one of two layouts depending on the command:
//   dist/local/_<id>_   (scripts/build.mjs / "pnpm compile" — the _<id>_ layout, like the CI checkout)
//   dist/mls-<id>       (tsc / "pnpm compile:local" — mirrors the mls-<id> source folder name)
// The GitHub Action always sees the project as _<id>_; locally the source dir is mls-<id>, so either
// can occur. Pick whichever has an l2 output.
function findCompiledRoot(clientId) {
  const candidates = [
    resolve(ROOT, 'dist', 'local', `_${clientId}_`),
    resolve(ROOT, 'dist', `mls-${clientId}`),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'l2'))) ?? null;
}

function buildCompiledZip(clientId, clientRoot, objDir) {
  const compiledRoot = findCompiledRoot(clientId);
  if (!compiledRoot) {
    const existing = join(objDir, 'compiled.zip');
    log(`compiled.zip SKIPPED: no local build found (looked for dist/local/_${clientId}_/l2 and dist/mls-${clientId}/l2). Run "pnpm compile" (or "pnpm compile:local") on a machine with a working esbuild first, then re-run this.`);
    if (existsSync(existing)) log(`compiled.zip: keeping the existing ${relative(ROOT, existing)} (${statSync(existing).size} bytes) untouched.`);
    return false;
  }
  const zip = new AdmZip();
  // Enhanced compiled l2 JS (mls-ci drops l1 from compiled.zip — the runtime loads l1 differently).
  // Skip sourcemaps and *.spec.js so the archive matches the CI output (tsconfig_p: sourceMap:false,
  // excludes **/*.spec.ts).
  let jsFiles = 0;
  const addTree = (absDir, zipBase) => {
    for (const entry of sortedDirEntries(absDir)) {
      if (SKIP_NAMES.has(entry.name) || entry.name.endsWith('.js.map') || entry.name.endsWith('.spec.js')) continue;
      const abs = join(absDir, entry.name);
      const zipPath = `${zipBase}/${entry.name}`;
      if (entry.isDirectory()) addTree(abs, zipPath);
      else if (entry.isFile()) { addStableFile(zip, zipPath, readFileSync(abs)); jsFiles += 1; }
    }
  };
  addTree(join(compiledRoot, 'l2'), `_${clientId}_/l2`);
  if (jsFiles === 0) {
    throw new Error(`compiled.zip would be empty: ${relative(ROOT, compiledRoot)}/l2 has no js output. The local build is incomplete — run "pnpm compile" (or "pnpm compile:local") and check its errors.`);
  }
  // fileinfos.json — REQUIRED by the login filesInfo (cbe central and runtime cbe module).
  const fileInfos = buildFileInfos(clientRoot, readPreviousFileInfos(objDir));
  if (fileInfos.files.length === 0) {
    throw new Error(`fileinfos.json would be empty: no source files found under ${relative(ROOT, clientRoot)}/l1..l7.`);
  }
  addStableFile(zip, 'fileinfos.json', Buffer.from(`${JSON.stringify(fileInfos, null, 2)}\n`, 'utf8'));
  // types/importsMap.json (reproduced) + types/index.d.ts (only if the build emitted one).
  addStableFile(zip, 'types/importsMap.json', Buffer.from(`${JSON.stringify(buildImportsMap(clientRoot), null, 2)}\n`, 'utf8'));
  const dts = join(compiledRoot, 'types', 'index.d.ts');
  if (existsSync(dts)) addStableFile(zip, 'types/index.d.ts', readFileSync(dts));
  else log('compiled.zip: types/index.d.ts not present locally (it comes from the CI declaration compile) — omitted; validate against a CI-built project.');
  const out = join(objDir, 'compiled.zip');
  return writeZipIfChanged(
    zip,
    out,
    `compiled.zip written (${jsFiles} l2 js file(s) from ${relative(ROOT, compiledRoot)}, fileinfos: ${fileInfos.files.length} source file(s)) -> ${relative(ROOT, out)}`,
    `compiled.zip unchanged (${jsFiles} l2 js file(s) from ${relative(ROOT, compiledRoot)}, fileinfos: ${fileInfos.files.length} source file(s)) -> ${relative(ROOT, out)}`,
  );
}

function buildProjectObj(projectId, sourceOnly) {
  const projectRoot = resolve(ROOT, `mls-${projectId}`);
  if (!existsSync(projectRoot)) throw new Error(`project not found: ${projectRoot}`);
  const objDir = join(projectRoot, 'obj');
  mkdirSync(objDir, { recursive: true });
  log(`project=${projectId} root=${relative(ROOT, projectRoot)}`);

  buildSourceZip(projectRoot, objDir);
  if (!sourceOnly) buildCompiledZip(projectId, projectRoot, objDir);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // --projects id1,id2,...: regenerate the obj of every project shipped to the
  // runtime VM (masters/libs included) from the LOCAL build, so a local edit
  // reaches the VM without waiting for the project's CI. Without --projects the
  // original single-client behavior is kept.
  const ids = args.projects.length > 0 ? args.projects : [detectClientId(args.client)];
  for (const id of ids) buildProjectObj(id, args.sourceOnly);
  log(`done (${ids.length} project(s))`);
}

try {
  main();
} catch (error) {
  console.error(`[buildClientObj] aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
