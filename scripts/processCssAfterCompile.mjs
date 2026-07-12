#!/usr/bin/env node
// processCssAfterCompile.mjs — post-compile LESS injection using mls-ci.
//
// Reuses the exact routine the GitHub Action runs (mls-ci/processCSS.js:
// compile the component .less with design-system tokens and inject
// `if(this.loadStyle) this.loadStyle(`<css>`)` after super() in the compiled
// per-file JS). It only works on per-file tsc output that keeps the
// `/// <mls ... />` header (dist/local, dist/mls-<id>); esbuild bundles
// (dist/web) strip that header and are NOT supported.
//
// mls-ci hardcodes its paths (cwd/preBuild/_<id>_/l2 for the JS,
// <pkg>/../../l2 for the .less). Under pnpm the package resolves into the
// .pnpm store, so both anchors are wrong for mls-base. This script bridges by
// staging the expected layout per project in .cssStage/<id>/ (real copy of
// mls-ci + l2 less + preBuild js), running runProcessCss(id) there, and
// writing the changed JS back.
//
// Usage:
//   node scripts/processCssAfterCompile.mjs                  # dist/local, all projects
//   node scripts/processCssAfterCompile.mjs --dist dist      # dist/mls-<id> layout
//   node scripts/processCssAfterCompile.mjs --dist dist/local 102025 102036

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = resolve(ROOT, '.cssStage');

function log(msg) {
  console.log(`[processCss] ${msg}`);
}

function parseArgs(argv) {
  const args = { dist: 'dist/local', ids: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dist') args.dist = argv[++i] ?? args.dist;
    else args.ids.push(argv[i]);
  }
  return args;
}

// dist dirs may use the `_<id>_` (build.mjs) or `mls-<id>` (tsc frontend) form.
function discoverDistProjects(distRoot) {
  if (!existsSync(distRoot)) return [];
  const out = [];
  for (const name of readdirSync(distRoot)) {
    const m = /^_(\d+)_$/.exec(name) ?? /^mls-(\d+)$/.exec(name);
    if (!m) continue;
    const l2 = join(distRoot, name, 'l2');
    if (existsSync(l2) && statSync(l2).isDirectory()) out.push({ id: m[1], dir: join(distRoot, name) });
  }
  return out;
}

async function walkFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return out;
}

// Copy every `ext` file under srcRoot to destRoot, keeping relative paths.
async function copyTree(srcRoot, destRoot, exts) {
  let count = 0;
  for (const file of await walkFiles(srcRoot)) {
    if (!exts.some((e) => file.endsWith(e))) continue;
    const dest = join(destRoot, relative(srcRoot, file));
    await mkdir(dirname(dest), { recursive: true });
    await cp(file, dest);
    count += 1;
  }
  return count;
}

async function processProject(mlsCiDir, id, distDir) {
  const srcL2 = join(ROOT, `mls-${id}`, 'l2');
  const stage = join(STAGE, id);

  const lessCount = existsSync(srcL2) ? await copyTree(srcL2, join(stage, 'l2'), ['.less']) : 0;
  if (lessCount === 0) {
    log(`mls-${id}: no .less, skipped`);
    return false;
  }

  // real copy of mls-ci: its __dirname-relative project root must be the stage dir
  await cp(mlsCiDir, join(stage, 'node_modules', 'mls-ci'), { recursive: true, dereference: true });
  const jsCount = await copyTree(join(distDir, 'l2'), join(stage, 'preBuild', `_${id}_`, 'l2'), ['.js']);
  log(`mls-${id}: staged ${jsCount} js / ${lessCount} less`);

  const runner = join(stage, 'node_modules', 'mls-ci', 'processCSS.js');
  // Capture mls-ci's stdout (it logs one "Processed CSS for file: …" line per file — pure noise)
  // while keeping stderr inherited so real errors still surface.
  const result = spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(runner)}).runProcessCss(${JSON.stringify(id)}).catch((e)=>{console.error(e.message);process.exit(1);})`],
    { cwd: stage, stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`mls-ci runProcessCss failed for mls-${id}`);

  // write back only the files mls-ci actually changed
  let injected = 0;
  const stagedL2 = join(stage, 'preBuild', `_${id}_`, 'l2');
  for (const file of await walkFiles(stagedL2)) {
    if (!file.endsWith('.js')) continue;
    const original = join(distDir, 'l2', relative(stagedL2, file));
    const [after, before] = await Promise.all([readFile(file, 'utf8'), readFile(original, 'utf8')]);
    if (after !== before) {
      await writeFile(original, after, 'utf8');
      injected += 1;
    }
  }
  log(`mls-${id}: injected css into ${injected} file(s)`);
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const distRoot = resolve(ROOT, args.dist);

  let projects = discoverDistProjects(distRoot);
  if (args.ids.length > 0) projects = projects.filter((p) => args.ids.includes(p.id));
  if (projects.length === 0) {
    log(`nothing to do (no _<id>_/mls-<id> dirs with l2 in ${args.dist})`);
    return;
  }

  const require = createRequire(import.meta.url);
  const mlsCiDir = dirname(require.resolve('mls-ci/package.json', { paths: [ROOT] }));

  await rm(STAGE, { recursive: true, force: true });
  let processed = 0;
  try {
    for (const { id, dir } of projects) {
      if (await processProject(mlsCiDir, id, dir)) processed += 1;
    }
  } finally {
    // cleanup must never mask a real error from the loop above
    try {
      await rm(STAGE, { recursive: true, force: true });
    } catch (error) {
      log(`warning: could not remove ${STAGE}: ${error instanceof Error ? error.message : error}`);
    }
  }
  log(`done (${processed} project(s) processed)`);
}

main().catch((error) => {
  console.error(`[processCss] aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
