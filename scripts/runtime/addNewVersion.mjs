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
//      sources; node_modules a hard-link snapshot), write release.json (lib pin +
//      provenance), activate it atomically through the "current" symlink, keep
//      the 10 newest, and reload pm2 (cluster, no downtime). Rollback = repoint
//      "current" to an older release + reload.

import { execFileSync, execSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, cpSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync,
  realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathIdsOf, versionedTsconfigPathsFile } from '../syncTsconfigPaths.mjs';
import { collectReleaseStamp, readDepTrees, writeReleaseStamp } from './releaseStamp.mjs';
import {
  activeReleaseId, buildPieces, decideQueues, openRelease, readStamp, readVmId, recordsDir, requestedByFor,
} from './releaseRecord.mjs';
import { envForMigrate } from './migrateEnv.mjs';
import { isProjectTree } from './projectPorts.mjs';
import { readZipStamp, sourceTreeHash, writeZipStamp, ZIP_SOURCE_LEVELS } from './zipSourceTree.mjs';
import { checkGeneratedL1 } from '../checkGeneratedL1.mjs';

export { envForMigrate };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (cmd, cwd = ROOT, env) => {
  try {
    const options = { cwd, stdio: 'inherit' };
    if (env) options.env = { ...process.env, ...env };
    return execSync(cmd, options);
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


function gitText(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/**
 * Does `mls-<id>/obj/compiled.zip` belong to the project's current commit?
 * Returns `null` when it does (or when nothing can be judged: not a git repo), else the reason.
 * - missing zip: reason `missing`.
 * - zip tracked at HEAD (the GitHub Action's commit): it is current when the source levels l1..l7 are the same
 *   tree at HEAD as at the last commit that touched the zip. A tree comparison, not mtimes: a `git pull` rewrites
 *   every file mtime, which is how a stale zip looked fresh (mls-102035, 04/11).
 * - zip not tracked, or already regenerated here (modified in the worktree): it is current when the source levels
 *   have no uncommitted change and their git tree is the one recorded when this zip was built (zipSourceTree.mjs,
 *   rt194); a local snapshot commit does not change that tree. A zip with no stamp (built before rt194) falls back
 *   to "newer than HEAD's commit time", once: the rebuild writes the stamp.
 */
export function compiledZipStaleReason(root, id) {
  const repo = join(root, `mls-${id}`);
  const zip = join(repo, 'obj', 'compiled.zip');
  if (!existsSync(zip)) return 'missing';
  try {
    gitText(repo, ['rev-parse', '--git-dir']);
  } catch {
    return null;
  }
  // Tracked at HEAD: `git log -- <path>` alone also answers for a path that was later dropped from the tree
  // (the lima's snapshot commits carry no obj/) and is now an ignored file regenerated here.
  const tracked = gitText(repo, ['ls-tree', 'HEAD', '--', 'obj/compiled.zip']) !== '';
  const zipCommit = tracked ? gitText(repo, ['log', '-1', '--format=%H', '--', 'obj/compiled.zip']) : '';
  const zipModified = gitText(repo, ['status', '--porcelain', '--', 'obj/compiled.zip']) !== '';
  if (zipCommit && !zipModified) {
    try {
      execFileSync('git', ['-C', repo, 'diff', '--quiet', zipCommit, 'HEAD', '--', ...ZIP_SOURCE_LEVELS], { stdio: 'ignore' });
      return null;
    } catch {
      return `sources changed since the zip commit ${zipCommit.slice(0, 7)}`;
    }
  }
  if (gitText(repo, ['status', '--porcelain', '--', ...ZIP_SOURCE_LEVELS]) !== '') return 'sources have uncommitted changes';
  const stamped = readZipStamp(repo, zip);
  if (stamped !== null) {
    const tree = sourceTreeHash(repo);
    return tree === null || tree === stamped ? null : 'sources changed since the zip was built';
  }
  const headTime = Number(gitText(repo, ['log', '-1', '--format=%ct'])) * 1000;
  return statSync(zip).mtimeMs >= headTime ? null : 'zip is older than the HEAD commit';
}

/** Build, on this machine, the obj zips the release needs and the repo does not have (or has for another commit). */
export function ensureFechoCompiledZips(root, ids, { build = defaultBuildObjs, log = console.log } = {}) {
  const stale = [];
  for (const id of ids) {
    const reason = compiledZipStaleReason(root, id);
    if (reason) {
      stale.push({ id, reason });
    } else {
      // rt194: a zip judged current gets its source-tree stamp too, so the next local snapshot commit
      // (same sources, newer commit time) does not look like a stale zip. No-op when it already has one.
      const repo = join(root, `mls-${id}`);
      const zip = join(repo, 'obj', 'compiled.zip');
      if (existsSync(zip) && readZipStamp(repo, zip) === null) writeZipStamp(repo, zip);
    }
  }
  if (stale.length === 0) return [];
  for (const { id, reason } of stale) log(`generated obj mls-${id}: ${reason}`);
  build(root, stale.map((entry) => entry.id));
  return stale;
}

function defaultBuildObjs(root, ids) {
  execFileSync(process.execPath, [join(root, 'scripts', 'runtime', 'buildProjectsObj.mjs'), '--force', '--only', ids.join(',')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, BUILDCI_OFFLINE: '1' },
  });
}

/** Hard-link copy of a tree: directories are made, symbolic links are copied as links (the pnpm ones are relative), files are hard-linked. */
function linkTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else if (entry.isDirectory()) linkTree(from, to);
    else linkSync(from, to);
  }
}

/**
 * The release keeps the node_modules it was compiled and migrated with: a hard-link snapshot of `source` in `target`
 * (`cp -al` where the system has it, the same walk in Node otherwise). A later `pnpm install` at the root replaces files
 * without touching the ones the release holds, so going back to this release brings its own dependencies. A failure
 * leaves no half copy and throws: the release stops before `current` changes.
 */
export function snapshotNodeModules(source, target, { copy = null } = {}) {
  if (!existsSync(source)) throw new Error(`node_modules snapshot: ${source} does not exist`);
  rmSync(target, { recursive: true, force: true });
  try {
    if (copy) {
      copy(source, target);
    } else {
      const done = spawnSync('cp', ['-al', source, target], { stdio: 'ignore' });
      if (done.status !== 0) {
        rmSync(target, { recursive: true, force: true });
        linkTree(source, target);
      }
    }
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw new Error(`node_modules snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const FECHO_ZIP_NAMES = ['compiled.zip', 'source.zip'];

/**
 * Copy each fecho zip into `<release>/obj/<id>/`. Not a hard link: the zip writers
 * (`writeZipIfChanged`, `AdmZip.writeZip`) truncate and rewrite the same inode, so a
 * link would follow the next root build. Failure removes the partial portrait and
 * throws before `current` moves.
 */
export function snapshotFechoZips(root, releaseDir, ids) {
  const portrait = join(releaseDir, 'obj');
  try {
    for (const id of ids) {
      const destDir = join(portrait, String(id));
      mkdirSync(destDir, { recursive: true });
      for (const name of FECHO_ZIP_NAMES) {
        const from = join(root, `mls-${id}`, 'obj', name);
        if (!existsSync(from)) throw new Error(`release aborted: obj/${name} missing for mls-${id}`);
        copyFileSync(from, join(destDir, name));
      }
    }
  } catch (error) {
    rmSync(portrait, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith('release aborted:')) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fecho zip snapshot failed: ${message}`);
  }
}

export function activateCurrent(root, releaseDir, fechoIds, options = {}) {
  ensureFechoCompiledZips(root, fechoIds, options);
  assertFechoCompiledZips(root, fechoIds);
  snapshotFechoZips(root, releaseDir, fechoIds);
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

function walkTypeScript(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walkTypeScript(abs, out);
    } else if (entry.isFile() && /\.tsx?$/u.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Client app L1, before compile and before `current` moves.
 * No client id: nothing to gate (a library folder is not the app).
 * Findings stop the release; the message is `file:line rule` per finding.
 */
export function assertReleaseL1(root, clientId) {
  const id = String(clientId ?? '').trim();
  if (!/^\d+$/u.test(id)) return;
  const l1 = join(root, `mls-${id}`, 'l1');
  if (!existsSync(l1)) return;
  const findings = checkGeneratedL1({ files: walkTypeScript(l1, []) });
  if (!findings.length) return;
  throw new Error(findings.map((item) => `${item.file}:${item.line} ${item.rule}`).join('\n'));
}

/** Open the release record before anything runs; close it (also on failure) in `finishRecord`. */
function beginRecord(argv) {
  const clientFlag = argv.indexOf('--client');
  const clientId = clientFlag >= 0 ? argv[clientFlag + 1] : argv.find((a) => !a.startsWith('--'));
  const projectTree = isProjectTree(ROOT);
  const previous = readStamp(ROOT, activeReleaseId(ROOT, clientId || '', { projectTree }));
  const requestId = String(process.env.COLLAB_RELEASE_REQUEST_ID ?? '').trim();
  const handle = openRelease({
    root: ROOT,
    dir: recordsDir(ROOT, 'app'),
    releaseId: makeReleaseId(),
    queue: 'app',
    projectId: clientId && /^\d+$/u.test(clientId) ? clientId : null,
    vmId: readVmId(),
    requestId: requestId || null,
    requestedBy: requestedByFor({ appDir: clientId ? join(ROOT, `mls-${clientId}`) : '' }),
    anterior: previous?.id ?? null,
  });
  return { handle, clientId: clientId || '', previous, hasRequest: Boolean(requestId) };
}

function finishRecord(ctx, error, depTrees) {
  try {
    const stamp = collectReleaseStamp({ root: ROOT, releaseId: ctx.handle.releaseId, clientId: ctx.clientId, deps: depTrees });
    const pieces = buildPieces({ root: ROOT, clientId: ctx.clientId, stamp, previous: ctx.previous });
    const queues = decideQueues({ requested: process.env.COLLAB_RELEASE_QUEUE, hasRequest: ctx.hasRequest, pieces });
    ctx.handle.close({ error, pieces, queue: queues[0], queues });
  } catch (recordError) {
    process.stderr.write(`releaseRecord: pieces not recorded: ${recordError instanceof Error ? recordError.message : String(recordError)}\n`);
    ctx.handle.close({ error });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const ctx = beginRecord(argv);
  const state = { depTrees: undefined };
  let failure = null;
  try {
    runRelease(argv, ctx.handle, state);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    finishRecord(ctx, failure, state.depTrees);
  }
}

function runRelease(argv, rec, state) {
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
    rec.step('install', () => run('pnpm install'));
  }

  // Client id (passed as `--client <id>` by the publish, or positionally). Forwarded
  // to the compiler so it picks the right client config when several exist on disk.
  const clientFlag = argv.indexOf('--client');
  const clientId = clientFlag >= 0 ? argv[clientFlag + 1] : argv.find((a) => !a.startsWith('--'));
  const clientArg = clientId ? ` --client ${clientId}` : '';
  // Dependency trees are read before the compile: they are what this release is built from.
  const depTrees = readDepTrees(ROOT, clientId || '');
  state.depTrees = depTrees;
  // Before compile and before activateCurrent. A finding throws; the record
  // closes falhou at checkL1 and `current` stays on the previous release.
  rec.step('checkL1', () => assertReleaseL1(ROOT, clientId || ''));

  console.log(`--- compile${clientId ? ` (client ${clientId})` : ''}`);
  // Call the compiler directly (NOT `pnpm build`, which now points to this file) to
  // avoid infinite recursion.
  rec.step('compile', () => run(`node scripts/build.mjs --release${clientArg}`));

  // ── assemble release and activate it via the "current" symlink ──────────────
  // A release holds only the runtime output (frontend + backend), no sources.
  // node_modules: a hard-link snapshot of the root one (see snapshotNodeModules), so a release keeps its own dependencies.
  const releaseId = rec.releaseId;
  const releasesDir = join(ROOT, 'releases');
  const releaseDir = join(releasesDir, releaseId);
  mkdirSync(releaseDir, { recursive: true });

  console.log(`--- assembling release ${releaseId}`);
  renameSync(join(ROOT, 'dist'), join(releaseDir, 'dist')); // dist/local + dist/web
  cpSync(join(ROOT, 'config.json'), join(releaseDir, 'config.json')); // server reads it from cwd
  // Carry the VM-level .env (kept stable at the mls-base root) into the release: the server
  // and migrate resolve .env from their cwd, and releases are recreated on every publish.
  if (existsSync(join(ROOT, '.env'))) cpSync(join(ROOT, '.env'), join(releaseDir, '.env'));
  snapshotNodeModules(join(ROOT, 'node_modules'), join(releaseDir, 'node_modules'));
  const stamp = collectReleaseStamp({ root: ROOT, releaseId, clientId: clientId || '', deps: depTrees });
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
  rec.step('migrate', () => {
    if (skipMigrate) {
      console.log('--- migrate skipped (--skip-migrate)');
    } else if (migrateJs && existsSync(migrateJs)) {
      // Same script `pnpm migrate` / scripts/runMigrate.mjs would run after `current` switches;
      // running it from the new release first keeps a failed migrate from activating.
      // COLLAB_PROJECT_ID matches vmApps.mjs so the migrate hits the same database the app uses.
      console.log(`--- migrate (mls-base master backend ${masterBackendId})`);
      if (clientId && /^\d+$/.test(clientId)) {
        const migrateEnv = envForMigrate(ROOT, clientId);
        run(`COLLAB_PROJECT_ID=${clientId} node '${migrateJs}'`, releaseDir, migrateEnv);
      } else {
        console.log('--- migrate sem client: usa o modo da raiz da release');
        run(`node '${migrateJs}'`, releaseDir);
      }
    } else {
      console.log(`--- migrate skipped (${migrateJs || 'no master backend in config.json'} not found)`);
    }
  });

  // Atomic activation: point current -> releases/<id> (ln -sfn replaces in place).
  // Guard = detector: every fecho project must have obj/compiled.zip (same
  // existsSync hasCompiledZip uses) or the previous release stays live.
  rec.step('ativar', () => activateCurrent(ROOT, releaseDir, fechoProjectIds(releaseConfig)));
  console.log(`--- current -> releases/${releaseId}`);

  const aliases = isProjectTree(ROOT) ? [] : parseReleaseAliases(process.env.COLLAB_RELEASE_ALIAS || '');
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
      rec.markFailed('pm2', error);
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
