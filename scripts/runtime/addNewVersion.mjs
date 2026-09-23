#!/usr/bin/env node
// scripts/runtime/addNewVersion.mjs
// This IS the `pnpm build` pipeline (package.json "build" points here). The publish
// only syncs sources, then runs `pnpm build` on the VM — which compiles AND deploys.
// Steps:
//   1. Write tsconfig.vm.json "paths" as the union of mls-* on disk, aliases
//      already in tsconfig.vm.json, and aliases in the versioned tsconfig base.
//      The generated file never shrinks. The versioned file is never modified (gb63).
//   2. pnpm install (deps only; the dev-only clone lives in "install:dev").
//   3. pnpm migrate for every project that declares a "migrate" script.
//   4. Compile via `node scripts/build.mjs` (-> dist/local + dist/web).
//   5. Assemble a release in releases/<yyyyMMddHHmmss> (runtime output only, no
//      sources; node_modules shared via symlink), write release.json (lib pin +
//      provenance), activate it atomically through the "current" symlink, keep
//      the 10 newest, and reload pm2 (cluster, no downtime). Rollback = repoint
//      "current" to an older release + reload.

import { execSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync,
  realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathIdsOf, versionedTsconfigPathsFile } from '../syncTsconfigPaths.mjs';
import { collectReleaseStamp, writeReleaseStamp } from './releaseStamp.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (cmd, cwd = ROOT) => {
  try {
    return execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 1;
    throw new Error(`Command failed (${status}): ${cmd}`);
  }
};

// Retries `cmd` only after a failure (never pre-emptively) — for `pm2
// startOrReload`, which self-triggered rebuilds (cbeRebuildOnSave.ts) have been
// observed to fail on the first attempt (the app reloading itself mid-command),
// while an immediate manual retry succeeds every time.
const runWithRetry = (cmd, cwd = ROOT, attempts = 3, delayMs = 3000) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return run(cmd, cwd);
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`--- retry ${attempt}/${attempts - 1} after failure: ${error.message}`);
      execSync(`sleep ${delayMs / 1000}`);
    }
  }
};

// Unversioned tsconfig the VM compile uses. It extends tsconfig.json and overrides
// paths = disk ∪ existing vm ∪ versioned, so a VM that still has one mls-*
// folder does not drop the platform aliases. Never write this back over the
// versioned tsconfig.base.json.
export const VM_TSCONFIG = 'tsconfig.vm.json';

export function vmTsconfigRel(root) {
  if (existsSync(join(root, VM_TSCONFIG))) return `./${VM_TSCONFIG}`;
  return existsSync(join(root, 'tsconfig.base.json')) ? './tsconfig.base.json' : './tsconfig.json';
}

// Directories named exactly mls-<digits> (skip "-temp" and other variants).
export function discoverProjects(root) {
  return readdirSync(root)
    .filter((name) => /^mls-\d+$/.test(name))
    .filter((name) => statSync(join(root, name)).isDirectory())
    .map((name) => name.slice('mls-'.length))
    .sort();
}

function aliasIdsFromFile(file) {
  if (!existsSync(file)) return [];
  return pathIdsOf(readFileSync(file, 'utf8'));
}

/** Union of caller ids, versioned base, and existing tsconfig.vm.json. Never shrinks. */
function unionAliasIds(root, ids) {
  const merged = new Set((ids ?? []).map(String));
  for (const id of aliasIdsFromFile(versionedTsconfigPathsFile(root))) merged.add(id);
  for (const id of aliasIdsFromFile(join(root, VM_TSCONFIG))) merged.add(id);
  return [...merged].sort();
}

// Rebuild the "paths" object as the union of `ids`, aliases already in
// tsconfig.vm.json, and aliases in the versioned base. Preserves
// "// label" comments. Writes tsconfig.vm.json; never touches the versioned file.
export function updateTsconfigPaths(root, ids) {
  const source = versionedTsconfigPathsFile(root);
  const dest = join(root, VM_TSCONFIG);
  const text = readFileSync(source, 'utf8');

  // The paths object contains only string arrays, so there is no nested "}" —
  // a simple match up to the first "}" is safe.
  if (!/"paths"\s*:\s*\{[^}]*\}/.test(text)) {
    throw new Error('Could not find a "paths" block in the versioned tsconfig');
  }

  const merged = unionAliasIds(root, ids);

  // Keep the human labels already present (e.g. "// collabCommon").
  const labels = {};
  const lineRe = /"\/_(\d+)_\/\*"\s*:\s*\[[^\]]*\]\s*,?\s*\/\/\s*(.+)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) labels[m[1]] = m[2].trim();

  const indent = ' '.repeat(12);
  const entries = merged.map((id, i) => {
    const comma = i < merged.length - 1 ? ',' : '';
    const label = labels[id] ? ` // ${labels[id]}` : '';
    return `${indent}"/_${id}_/*": ["./mls-${id}/*"]${comma}${label}`;
  });
  const block = `        "paths": {\n${entries.join('\n')}\n        }`;
  const vmText = `{\n    "extends": "./tsconfig.json",\n    "compilerOptions": {\n${block}\n    }\n}\n`;

  writeFileSync(dest, vmText);
  return merged;
}

export function writeVmTsconfig(root) {
  return updateTsconfigPaths(root, discoverProjects(root));
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
// --skip-install / --skip-migrate: for the auto-rebuild-on-save trigger
// (cbeRebuildOnSave.ts), which only needs to recompile+redeploy a pure source
// edit — no new dependency, no schema change. Both are strictly opt-in; a
// plain `pnpm build --client <id>` behaves exactly as before.
export function skipPm2(argv) {
  return argv.includes('--skip-pm2');
}

/** Ids in `config.projects` — the release fecho served from obj/compiled.zip. */
export function fechoProjectIds(config) {
  return Object.keys(config?.projects ?? {}).filter((id) => /^\d+$/u.test(String(id)));
}

export function missingCompiledZips(root, ids) {
  return ids.filter((id) => !existsSync(join(root, `mls-${id}`, 'obj', 'compiled.zip')));
}

/**
 * Same condition `hasCompiledZip` uses to decide 404: no zip, no module.
 * Throw before `ln -sfn current` so the previous release stays live.
 */
export function assertFechoCompiledZips(root, ids) {
  const missing = missingCompiledZips(root, ids);
  if (missing.length === 0) return;
  const list = missing.map((id) => `mls-${id}`).join(', ');
  throw new Error(`release aborted: obj/compiled.zip missing for ${list}`);
}

export function activateCurrent(root, releaseDir, fechoIds) {
  assertFechoCompiledZips(root, fechoIds);
  execSync(`ln -sfn '${releaseDir}' '${join(root, 'current')}'`);
}

/** Studio / extra mls-* on disk that are not in this release's config.projects. */
export function extrasOutsideFecho(diskIds, fechoIds) {
  const fecho = new Set(fechoIds);
  return diskIds.filter((id) => !fecho.has(id));
}

export function pm2ConfigRel(root) {
  return existsSync(join(root, 'pm2.config.js')) ? 'pm2.config.js' : 'servers/pm2.config.js';
}

/**
 * Release names still pointed at by a `current*` symlink at the root — the
 * global `current` and every `current-<id>` alias a hosted app runs from.
 *
 * The prune below must never delete these: an alias whose target is gone leaves
 * that app with a script that does not exist, and `pm2 startOrReload` then fails
 * for the WHOLE config file — taking down the release step of every later build
 * (observed on the VM: app2046 pointed at a pruned release and every
 * rebuild-on-save aborted before it could refresh any obj).
 */
export function releasesInUse(root) {
  const inUse = new Set();
  for (const name of readdirSync(root)) {
    if (!name.startsWith('current')) continue;
    const link = join(root, name);
    try {
      if (!lstatSync(link).isSymbolicLink()) continue;
      inUse.add(basename(readlinkSync(link)));
    } catch { /* unreadable link: nothing to protect */ }
  }
  return inUse;
}

/**
 * Aliases `current-<id>` that this release should flip. Empty string → none
 * (the global `current` still flips in activateCurrent). Comma-separated so
 * a library push can move every hosted app in one env. collab-sites still
 * passes a single `current-<id>`; that remains valid.
 */
export function parseReleaseAliases(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const aliases = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const alias of aliases) {
    if (!/^current-\d+$/.test(alias)) {
      throw new Error(`Invalid COLLAB_RELEASE_ALIAS: ${alias}`);
    }
  }
  return aliases;
}

function main() {
  const argv = process.argv.slice(2);
  const skipInstall = argv.includes('--skip-install');
  const skipMigrate = argv.includes('--skip-migrate');
  const deferPm2 = skipPm2(argv);

  const ids = writeVmTsconfig(ROOT);
  console.log(`--- projects on disk: ${ids.map((i) => 'mls-' + i).join(' ') || '(none)'}`);

  console.log(`--- writing ${VM_TSCONFIG} paths (tsconfig.json untouched)`);

  if (skipInstall) {
    console.log('--- pnpm install skipped (--skip-install)');
  } else {
    console.log('--- pnpm install');
    // Dependency build scripts are gated by pnpm. The allowed ones are declared in
    // package.json "pnpm.onlyBuiltDependencies", so install runs non-interactively
    // without `pnpm approve-builds`. (@tailwindcss/oxide ships prebuilt binaries.)
    run('pnpm install');
  }

  // Client id (passed as `--client <id>` by the publish, or positionally). Forwarded
  // to the compiler so it picks the right client config when several exist on disk.
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
  const stamp = collectReleaseStamp({ root: ROOT, releaseId, clientId: clientId || '' });
  writeReleaseStamp(releaseDir, stamp);
  console.log(`--- release stamp libs=${stamp.libs} monaco=${stamp.monaco} platform=${stamp.platformCommit}`);

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
  if (skipMigrate) {
    console.log('--- migrate skipped (--skip-migrate)');
  } else if (migrateJs && existsSync(migrateJs)) {
    // Same script `pnpm migrate` / scripts/runMigrate.mjs would run after `current` switches;
    // running it from the new release first keeps a failed migrate from activating.
    console.log(`--- migrate (mls-base master backend ${masterBackendId})`);
    run(`node '${migrateJs}'`, releaseDir);
  } else {
    console.log(`--- migrate skipped (${migrateJs || 'no master backend in config.json'} not found)`);
  }

  // Atomic activation: point current -> releases/<id> (ln -sfn replaces in place).
  // Guard = detector: every fecho project must have obj/compiled.zip (same
  // existsSync hasCompiledZip uses) or the previous release stays live.
  activateCurrent(ROOT, releaseDir, fechoProjectIds(releaseConfig));
  console.log(`--- current -> releases/${releaseId}`);

  const aliases = parseReleaseAliases(process.env.COLLAB_RELEASE_ALIAS || '');
  for (const releaseAlias of aliases) {
    run(`ln -sfn '${releaseDir}' '${join(ROOT, releaseAlias)}'`);
    console.log(`--- ${releaseAlias} -> releases/${releaseId}`);
  }

  // Keep the 10 most recent releases; remove older ones — except any still
  // pointed at by a `current*` symlink (see releasesInUse).
  const releases = readdirSync(releasesDir).filter((n) => /^\d{14}$/.test(n)).sort().reverse();
  const stillInUse = releasesInUse(ROOT);
  for (const old of releases.slice(10)) {
    if (stillInUse.has(old)) {
      console.log(`    kept old release ${old} (still referenced by a current* symlink)`);
      continue;
    }
    rmSync(join(releasesDir, old), { recursive: true, force: true });
    console.log(`    pruned old release ${old}`);
  }

  // Reload pm2 (cluster -> graceful, no downtime; starts on first run). Sites
  // publishes create a root pm2.config.js that lists one app per hosted project.
  // `--skip-pm2`: the git hook restores the worktree and prints the ok marker
  // first; on https that reload would kill git-http-backend (and this process)
  // before those steps run.
  const pm2Config = pm2ConfigRel(ROOT);
  mkdirSync(join(ROOT, 'logs'), { recursive: true });
  // A pm2 failure is still fatal for the build, but it is rethrown only AFTER
  // the obj refresh below: the objs are what the cbe login serves, and skipping
  // them leaves every browser on a stale versionRef — a much wider outage than
  // the reload itself. Deferred instead of reordered so the reload keeps
  // happening as early as it does today.
  let pm2Error = null;
  if (deferPm2) {
    console.log(`--- pm2 reload skipped (--skip-pm2; caller reloads after the hook finishes)`);
  } else {
    console.log(`--- pm2 reload (${pm2Config})`);
    try {
      runWithRetry(`pm2 startOrReload ${pm2Config} --update-env`);
      try { run('pm2 save'); } catch { /* non-fatal */ }
    } catch (error) {
      pm2Error = error;
      console.error(`[addNewVersion] pm2 reload failed — refreshing objs first, then failing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Refresh objs of projects OUTSIDE the release fecho (Studio: 100554, …).
  // Incremental + best-effort, AFTER activation. The fecho was compiled before
  // current switched (git hook) and is required by assertFechoCompiledZips —
  // CBE_BUILD_OBJS=false skips only these extras, never the fecho.
  const extras = extrasOutsideFecho(ids, fechoProjectIds(releaseConfig));
  if (process.env.CBE_BUILD_OBJS !== 'false' && extras.length > 0) {
    console.log(`--- building objs outside the fecho (${extras.map((id) => `mls-${id}`).join(', ')}; CBE_BUILD_OBJS=false to skip)`);
    try {
      run(`node scripts/runtime/buildProjectsObj.mjs --only ${extras.join(',')}`);
    } catch (error) {
      console.error(`[addNewVersion] obj build failed (release stays active): ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (process.env.CBE_BUILD_OBJS === 'false') {
    console.log('--- obj build skipped for projects outside the fecho (CBE_BUILD_OBJS=false)');
  }

  if (pm2Error) throw pm2Error;
  console.log(`addNewVersion done (release ${releaseId}).`);
}

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
  process.on('uncaughtException', (error) => {
    console.error(`[addNewVersion] aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
  try {
    main();
  } catch (error) {
    console.error(`[addNewVersion] aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
