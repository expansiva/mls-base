#!/usr/bin/env node
// addNewVersion.mjs
// This IS the `pnpm build` pipeline (package.json "build" points here). The publish
// only syncs sources, then runs `pnpm build` on the VM — which compiles AND deploys.
// Steps:
//   1. Update tsconfig.json "paths" from the mls-<id> projects present on disk.
//   2. pnpm install (deps only; the dev-only clone lives in "install:dev").
//   3. pnpm migrate for every project that declares a "migrate" script.
//   4. Compile via `node scripts/build.mjs` (-> dist/local + dist/web).
//   5. Assemble a release in releases/<yyyyMMddHHmmss> (runtime output only, no
//      sources; node_modules shared via symlink), activate it atomically through
//      the "current" symlink, keep the 10 newest, and reload pm2 (cluster, no
//      downtime). Rollback = repoint "current" to an older release + reload.

import { execSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' });

// Directories named exactly mls-<digits> (skip "-temp" and other variants).
function discoverProjects() {
  return readdirSync(ROOT)
    .filter((name) => /^mls-\d+$/.test(name))
    .filter((name) => statSync(join(ROOT, name)).isDirectory())
    .map((name) => name.slice('mls-'.length))
    .sort();
}

// Rebuild the "paths" object from the projects on disk, preserving the rest of
// tsconfig.json and the existing "// label" comments.
function updateTsconfigPaths(ids) {
  const file = join(ROOT, 'tsconfig.json');
  const text = readFileSync(file, 'utf8');

  // Keep the human labels already present (e.g. "// collabCommon").
  const labels = {};
  const lineRe = /"\/_(\d+)_\/\*"\s*:\s*\[[^\]]*\]\s*,?\s*\/\/\s*(.+)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) labels[m[1]] = m[2].trim();

  const indent = ' '.repeat(12);
  const entries = ids.map((id, i) => {
    const comma = i < ids.length - 1 ? ',' : '';
    const label = labels[id] ? ` // ${labels[id]}` : '';
    return `${indent}"/_${id}_/*": ["./mls-${id}/*"]${comma}${label}`;
  });
  const block = `"paths": {\n${entries.join('\n')}\n        }`;

  // The paths object contains only string arrays, so there is no nested "}" —
  // a simple match up to the first "}" is safe.
  if (!/"paths"\s*:\s*\{[^}]*\}/.test(text)) {
    throw new Error('Could not find a "paths" block in tsconfig.json');
  }
  writeFileSync(file, text.replace(/"paths"\s*:\s*\{[^}]*\}/, () => block));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Release id: yyyyMMddHHmmss (sorts chronologically).
function makeReleaseId() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ── main ───────────────────────────────────────────────────────────────────
const ids = discoverProjects();
console.log(`--- projects on disk: ${ids.map((i) => 'mls-' + i).join(' ') || '(none)'}`);

console.log('--- updating tsconfig.json paths');
updateTsconfigPaths(ids);

console.log('--- pnpm install');
// Dependency build scripts are gated by pnpm. The allowed ones are declared in
// package.json "pnpm.onlyBuiltDependencies", so install runs non-interactively
// without `pnpm approve-builds`. (@tailwindcss/oxide ships prebuilt binaries.)
run('pnpm install');

console.log('--- per-project migrate (where a "migrate" script exists)');
for (const id of ids) {
  const dir = join(ROOT, `mls-${id}`);
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { continue; }
  if (pkg.scripts && pkg.scripts.migrate) {
    console.log(`    migrate: mls-${id}`);
    run('pnpm migrate', dir);
  }
}

// Client id (passed as `--client <id>` by the publish, or positionally). Forwarded
// to the compiler so it picks the right client config when several exist on disk.
const argv = process.argv.slice(2);
const clientFlag = argv.indexOf('--client');
const clientId = clientFlag >= 0 ? argv[clientFlag + 1] : argv.find((a) => !a.startsWith('--'));
const clientArg = clientId ? ` --client ${clientId}` : '';
console.log(`--- compile${clientId ? ` (client ${clientId})` : ''}`);
// Call the compiler directly (NOT `pnpm build`, which now points to this file) to
// avoid infinite recursion.
run(`node scripts/build.mjs${clientArg}`);

// ── assemble release and activate it via the "current" symlink ──────────────
// A release holds only the runtime output (frontend + backend), no sources.
// node_modules is shared across releases via a symlink (pnpm store-backed).
const releaseId = makeReleaseId();
const releasesDir = join(ROOT, 'releases');
const releaseDir = join(releasesDir, releaseId);
mkdirSync(releaseDir, { recursive: true });

console.log(`--- assembling release ${releaseId}`);
renameSync(join(ROOT, 'dist'), join(releaseDir, 'dist')); // dist/local + dist/web
cpSync(join(ROOT, 'config.json'), join(releaseDir, 'config.json')); // server reads it from cwd
// Carry the VM-level .env (kept stable at the mls-base root) into the release: the server
// and migrate resolve .env from their cwd, and releases are recreated on every publish.
if (existsSync(join(ROOT, '.env'))) cpSync(join(ROOT, '.env'), join(releaseDir, '.env'));
symlinkSync(join(ROOT, 'node_modules'), join(releaseDir, 'node_modules'), 'dir');

// DB migrations BEFORE activation: the client's TableDefinitions (persistenceModules ->
// tableDefsDir) only become Postgres tables when the master backend's migrate runs
// (bootstrapSchema; the server does NOT create schema at startup). Run it from the
// release dir so config.json/.env resolve exactly as the server will see them.
// If it fails, we abort before switching "current" — the previous release keeps running.
const releaseConfig = JSON.parse(readFileSync(join(releaseDir, 'config.json'), 'utf8'));
const masterBackendId = Object.entries(releaseConfig.projects ?? {})
  .find(([, p]) => p?.type === 'master backend')?.[0];
const migrateJs = masterBackendId
  ? join(releaseDir, 'dist', 'local', `_${masterBackendId}_`, 'l1', 'scripts', 'migrate.js')
  : '';
if (migrateJs && existsSync(migrateJs)) {
  console.log(`--- db migrate (master backend ${masterBackendId})`);
  run(`node '${migrateJs}'`, releaseDir);
} else {
  console.log(`--- db migrate skipped (${migrateJs || 'no master backend in config.json'} not found)`);
}

// Atomic activation: point current -> releases/<id> (ln -sfn replaces in place).
run(`ln -sfn '${releaseDir}' '${join(ROOT, 'current')}'`);
console.log(`--- current -> releases/${releaseId}`);

// Keep the 10 most recent releases; remove older ones.
const releases = readdirSync(releasesDir).filter((n) => /^\d{14}$/.test(n)).sort().reverse();
for (const old of releases.slice(10)) {
  rmSync(join(releasesDir, old), { recursive: true, force: true });
  console.log(`    pruned old release ${old}`);
}

// Reload pm2 (cluster -> graceful, no downtime; starts on first run).
mkdirSync(join(ROOT, 'logs'), { recursive: true });
console.log('--- pm2 reload (pm2.config.js)');
run('pm2 startOrReload pm2.config.js --update-env');
try { run('pm2 save'); } catch { /* non-fatal */ }

console.log(`addNewVersion done (release ${releaseId}).`);
