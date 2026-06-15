#!/usr/bin/env node
// addNewVersion.mjs
// Runs ON the VM after publishMlsBase.sh has copied the sources here.
// Steps:
//   1. Update tsconfig.json "paths" from the mls-<id> projects present on disk
//      (single source of truth — no hard-coded project list).
//   2. pnpm install (deps only; the dev-only clone lives in "install:dev").
//   3. pnpm migrate for every project that declares a "migrate" script.
//   4. pnpm build.
//   5. pm2 startOrReload every project that declares a "pm2" field (cluster +
//      reload = no downtime). Projects without a "pm2" field are left untouched.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// Collect pm2 apps declared by mls-base itself or any mls-<id> project.
function discoverPm2Apps() {
  const pkgs = [join(ROOT, 'package.json')].concat(
    readdirSync(ROOT)
      .filter((d) => d.startsWith('mls-'))
      .map((d) => join(ROOT, d, 'package.json')),
  );
  const apps = [];
  for (const p of pkgs) {
    if (!existsSync(p)) continue;
    let json;
    try { json = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (json.pm2 && Array.isArray(json.pm2.apps)) {
      for (const a of json.pm2.apps) {
        a.cwd = dirname(p);
        apps.push(a);
      }
    }
  }
  return apps;
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

console.log('--- pnpm build');
run('pnpm build');

console.log('--- pm2 startOrReload');
const apps = discoverPm2Apps();
if (apps.length) {
  const eco = join(ROOT, '.pm2.generated.cjs');
  writeFileSync(eco, `module.exports = ${JSON.stringify({ apps }, null, 2)};\n`);
  console.log(`    pm2 apps: ${apps.map((a) => a.name).join(', ')}`);
  run(`pm2 startOrReload ${eco} --update-env`);
  try { run('pm2 save'); } catch { /* non-fatal */ }
} else {
  console.log('    no pm2-managed projects found — skipping');
}

console.log('addNewVersion done.');
