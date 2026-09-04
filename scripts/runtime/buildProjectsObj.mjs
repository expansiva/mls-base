#!/usr/bin/env node
// scripts/runtime/buildProjectsObj.mjs — build obj/{compiled.zip,source.zip}
// for every mls-* project present at the mls-base root, ON THIS MACHINE.
//
// This replaces the per-repo GitHub Actions (mls-ci) builds for the runtime
// VM: the publish syncs the project SOURCES, and the VM compiles its own obj
// via the local buildCI pipeline (scripts/buildCI). The cbe login then serves
// the zips to the browser (mls-102034 l1/server/layer_1_external/cbe).
//
// Incremental: a project is rebuilt only when a source file under l1..l7 (or
// l5/config.json) is newer than its obj/compiled.zip. Failures are isolated —
// a project that does not compile keeps its previous obj and the loop goes on.
//
// Intended for the VM (addNewVersion runs it after pm2 reload). On a dev
// machine prefer scripts/buildClientObj.mjs, which stages the zips OUTSIDE the
// git-tracked project trees; this script writes mls-<id>/obj/ in place.
//
// Usage:
//   node scripts/runtime/buildProjectsObj.mjs [--force] [--only 100554,102025]

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typeCheckProject } from '../typeCheckRun.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'obj', 'dist']);

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const onlyFlag = argv.indexOf('--only');
const only = onlyFlag >= 0
  ? new Set(String(argv[onlyFlag + 1] ?? '').split(',').map((s) => s.replace(/^mls-/u, '').trim()).filter(Boolean))
  : null;

function discoverProjects() {
  return readdirSync(ROOT)
    .filter((name) => /^mls-\d+$/u.test(name))
    .filter((name) => statSync(join(ROOT, name)).isDirectory())
    .map((name) => name.slice('mls-'.length))
    .sort();
}

// Newest mtime under the project's source levels (bounded scan, skips heavy dirs).
function newestSourceMtime(projectDir) {
  let newest = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          const mtime = statSync(full).mtimeMs;
          if (mtime > newest) newest = mtime;
        } catch { /* ignore */ }
      }
    }
  };
  for (const level of SOURCE_LEVELS) {
    const levelDir = join(projectDir, level);
    if (existsSync(levelDir)) walk(levelDir);
  }
  return newest;
}

function isStale(id) {
  const projectDir = join(ROOT, `mls-${id}`);
  const zipPath = join(projectDir, 'obj', 'compiled.zip');
  if (!existsSync(zipPath)) return true;
  return newestSourceMtime(projectDir) > statSync(zipPath).mtimeMs;
}

const ids = discoverProjects().filter((id) => !only || only.has(id));
console.log(`[buildProjectsObj] projects on disk: ${ids.map((i) => 'mls-' + i).join(' ') || '(none)'}`);

const results = { built: [], skipped: [], failed: [] };
for (const id of ids) {
  if (!force && !isStale(id)) {
    results.skipped.push(id);
  } else {
    const startedAt = Date.now();
    console.log(`[buildProjectsObj] building mls-${id} ...`);
    try {
      execSync(`node scripts/buildCI/buildCI.mjs ${id}`, {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, BUILDCI_OFFLINE: '1' },
      });
      // buildCI never writes into mls-<id>/ (its decision #14) — on the CI that
      // copy is the GitHub Action's job, here it is ours: publish the zips to
      // the location the cbe login serves from.
      const objDir = join(ROOT, `mls-${id}`, 'obj');
      mkdirSync(objDir, { recursive: true });
      for (const zipName of ['compiled.zip', 'source.zip']) {
        const staged = join(ROOT, '.generated', id, 'obj', zipName);
        if (existsSync(staged)) copyFileSync(staged, join(objDir, zipName));
      }
      results.built.push(id);
      console.log(`[buildProjectsObj] mls-${id} done in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    } catch (error) {
      results.failed.push(id);
      console.error(`[buildProjectsObj] mls-${id} FAILED (previous obj stays): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Gate path (`--only`, gitPostReceive): always type-check, including a
  // cache-hot skip — that skip is what made lima and AWS disagree (gb74).
  // A full-disk obj rebuild (no --only) is the cbe zip pass; build.mjs
  // already type-checked the release set.
  if (only) {
    const report = typeCheckProject({ root: ROOT, projectId: id });
    if (report.overrideLog) console.log(`[buildProjectsObj] ${report.overrideLog}`);
    console.log(`[buildProjectsObj] typeCheck ${report.reportLine}`);
    for (const line of report.excerpt) console.log(`[buildProjectsObj] typeCheck ${line}`);
    console.log(report.marker);
  }
}

console.log(`[buildProjectsObj] summary: built [${results.built.join(', ') || '-'}] | up-to-date [${results.skipped.join(', ') || '-'}] | failed [${results.failed.join(', ') || '-'}]`);
// Failures are non-fatal by design (the release must not be blocked); a fully
// failed run still exits 1 so an operator notices.
process.exit(results.failed.length > 0 && results.built.length === 0 && results.skipped.length === 0 ? 1 : 0);
