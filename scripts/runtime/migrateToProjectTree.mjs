#!/usr/bin/env node
// Move one project from the shared tree (/data/mls-base, current-<id>) into
// /data/app<id>/mls-base. The old tree is left in place. A second run does not
// clone or copy again. --dry-run only prints the plan.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appNameOf, projectIdToPort } from './projectPorts.mjs';
import { ensureProjectApp } from './vmApps.mjs';

const MLS_DIR = /^mls-\d+$/u;

export function parseArgs(argv) {
  const args = { dryRun: false, projectId: '', sourceRoot: '/data/mls-base', destRoot: '', storeDir: '/data/.pnpm-store' };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--root') args.sourceRoot = argv[++i] || '';
    else if (token === '--dest') args.destRoot = argv[++i] || '';
    else if (token === '--store') args.storeDir = argv[++i] || '';
    else if (token.startsWith('--')) throw new Error(`unknown argument: ${token}`);
    else rest.push(token);
  }
  args.projectId = rest[0] || '';
  if (!/^\d+$/u.test(args.projectId)) throw new Error('project id must be digits');
  if (!args.sourceRoot) throw new Error('--root is empty');
  args.sourceRoot = resolve(args.sourceRoot);
  args.destRoot = args.destRoot
    ? resolve(args.destRoot)
    : join(dirname(args.sourceRoot), `app${args.projectId}`, 'mls-base');
  return args;
}

function hostedIds(sourceRoot) {
  const dir = join(sourceRoot, 'pm2.apps.d');
  if (!existsSync(dir)) return [];
  const ids = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.config.js')) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    const match = text.match(/COLLAB_PROJECT_ID:\s*"(\d+)"/u);
    if (match) ids.push(match[1]);
  }
  return ids;
}

function hasGit(dir) {
  return existsSync(join(dir, '.git'));
}

/** Drafts of this project: drafts/<slug>/mls-<id>. The worktree itself is not copied. */
export function draftWorktrees(sourceRoot, projectId) {
  const root = join(sourceRoot, 'drafts');
  if (!existsSync(root)) return [];
  const appDir = `mls-${projectId}`;
  const rows = [];
  for (const slug of readdirSync(root).sort()) {
    const work = join(root, slug, appDir);
    if (!existsSync(work)) continue;
    rows.push({ slug, work, owner: join(root, slug, 'owner.json') });
  }
  return rows;
}

function porcelainFiles(stdout) {
  return stdout.split('\n').filter((line) => line.trim() !== '').length;
}

/** Uncommitted files in a draft worktree of this project. Empty when every draft is clean. */
export function uncommittedDrafts(sourceRoot, projectId) {
  const dirty = [];
  for (const row of draftWorktrees(sourceRoot, projectId)) {
    const result = spawnSync('git', ['-C', row.work, 'status', '--porcelain'], { encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) {
      throw new Error(`git status failed in draft ${row.slug}: ${(result.stderr || result.stdout || '').trim()}`);
    }
    const files = porcelainFiles(result.stdout || '');
    if (files > 0) dirty.push({ slug: row.slug, files });
  }
  return dirty;
}

export function refusalLine(projectId, dirty) {
  const list = dirty.map((row) => `${row.slug} (${row.files} files)`).join(', ');
  return `refusing project ${projectId}: uncommitted draft changes: ${list}`;
}

function headRefs(repo) {
  const result = spawnSync('git', ['-C', repo, 'for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads'], { encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`git for-each-ref failed in ${repo}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  const map = new Map();
  for (const line of (result.stdout || '').split('\n')) {
    if (!line) continue;
    const space = line.lastIndexOf(' ');
    map.set(line.slice(0, space), line.slice(space + 1));
  }
  return map;
}

function sameHeads(source, dest) {
  if (source.size !== dest.size) return false;
  for (const [name, sha] of source) {
    if (dest.get(name) !== sha) return false;
  }
  return true;
}

/** git clone --local keeps only the current branch. Recreate every refs/heads/* at the same SHA. */
function mirrorBranches(src, dest, git) {
  const origin = headRefs(src);
  const local = headRefs(dest);
  for (const [name, sha] of origin) {
    if (local.get(name) === sha) continue;
    if (local.has(name)) {
      throw new Error(`branch ${name} in ${dest} is ${local.get(name)}, source is ${sha}`);
    }
    git(['-C', dest, 'branch', name, sha]);
  }
  if (!sameHeads(origin, headRefs(dest))) {
    throw new Error(`branch list of ${dest} does not match ${src}`);
  }
}

/** Directories to bring over: this app, plus every mls-* that is not another hosted app. */
export function reposToCopy(sourceRoot, projectId) {
  const others = new Set(hostedIds(sourceRoot).filter((id) => id !== projectId));
  const names = readdirSync(sourceRoot).filter((name) => MLS_DIR.test(name)).sort();
  const keep = [];
  const skip = [];
  for (const name of names) {
    const id = name.slice(4);
    if (others.has(id)) skip.push(name);
    else keep.push(name);
  }
  return { keep, skip };
}

function currentInside(destRoot) {
  const link = join(destRoot, 'current');
  if (!existsSync(link)) return false;
  try {
    const target = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : 'current';
    return target === 'releases' || target.startsWith('releases/') || target.includes(`${destRoot}/releases`);
  } catch {
    return false;
  }
}

function envHas(file, key) {
  if (!existsSync(file)) return false;
  return readFileSync(file, 'utf8').split('\n').some((line) => line.startsWith(`${key}=`));
}

export function buildPlan({ sourceRoot, destRoot, projectId, storeDir }) {
  const appDir = `mls-${projectId}`;
  if (!existsSync(join(sourceRoot, appDir))) {
    throw new Error(`missing ${appDir} in ${sourceRoot}`);
  }
  const { keep, skip } = reposToCopy(sourceRoot, projectId);
  const port = projectIdToPort(projectId);
  const appName = appNameOf(port);
  const steps = [];
  steps.push({
    id: 'clone-base',
    skip: hasGit(destRoot),
    text: `clone ${sourceRoot} -> ${destRoot} (same commit)`,
  });
  for (const name of skip) {
    const gone = hasGit(destRoot) && !existsSync(join(destRoot, name));
    steps.push({ id: 'drop-other', name, skip: gone, text: `leave ${name} out of ${destRoot}` });
  }
  for (const name of keep) {
    const src = join(sourceRoot, name);
    const dest = join(destRoot, name);
    const mode = hasGit(src) ? 'clone' : 'copy';
    const present = mode === 'clone' ? hasGit(dest) : existsSync(dest);
    steps.push({
      id: 'copy-repo',
      name,
      mode,
      skip: present,
      text: `${mode} ${src} -> ${dest}`,
    });
  }
  for (const row of draftWorktrees(sourceRoot, projectId)) {
    if (!existsSync(row.owner)) continue;
    const destFile = join(destRoot, 'drafts', row.slug, 'owner.json');
    steps.push({
      id: 'draft-owner',
      slug: row.slug,
      skip: existsSync(destFile),
      text: `copy drafts/${row.slug}/owner.json -> ${destFile}`,
    });
  }
  for (const file of ['config.json', '.env']) {
    steps.push({
      id: 'copy-file',
      file,
      skip: !existsSync(join(sourceRoot, file)) || existsSync(join(destRoot, file)),
      text: `copy ${file} -> ${destRoot}`,
    });
  }
  const envFile = join(destRoot, '.env');
  for (const [key, value] of [
    ['CBE_PROJECTS_DIR', destRoot],
    ['CBE_STATIC_DIR', join(destRoot, 'static')],
  ]) {
    steps.push({
      id: 'env',
      key,
      value,
      skip: envHas(envFile, key),
      text: `set ${key}=${value}`,
    });
  }
  steps.push({
    id: 'pnpm',
    skip: existsSync(join(destRoot, 'node_modules')),
    text: `pnpm install --store-dir ${storeDir} in ${destRoot}`,
  });
  steps.push({
    id: 'release',
    skip: currentInside(destRoot),
    text: `release ${projectId} in ${destRoot} (current)`,
  });
  steps.push({
    id: 'pm2',
    appName,
    port,
    skip: false,
    text: `pm2 ${appName} → ${join(destRoot, 'current')}`,
  });
  steps.push({
    id: 'health',
    port,
    skip: false,
    text: `GET http://127.0.0.1:${port}/health`,
  });
  return steps;
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

function ensureEnv(destRoot, key, value) {
  const file = join(destRoot, '.env');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (text.split('\n').some((line) => line.startsWith(`${key}=`))) return;
  writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${key}=${value}\n`);
}

function pm2Cwd(appName) {
  const listed = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  if ((listed.status ?? 1) !== 0) return '';
  try {
    const rows = JSON.parse(listed.stdout || '[]');
    const row = rows.find((item) => item && item.name === appName);
    return row?.pm2_env?.pm_cwd || '';
  } catch {
    return '';
  }
}

export function executePlan(plan, { sourceRoot, destRoot, projectId, storeDir, commands = {} }) {
  const git = commands.git || runGit;
  const pnpm = commands.pnpm || ((cwd, store) => {
    const result = spawnSync('pnpm', ['install', '--store-dir', store], { cwd, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) throw new Error(`pnpm install failed: ${(result.stderr || '').trim()}`);
  });
  const release = commands.release || ((dest, id) => {
    const result = spawnSync(process.execPath, [
      join(dest, 'scripts/runtime/addNewVersion.mjs'), id, '--skip-pm2',
    ], { cwd: dest, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) {
      throw new Error(`release failed: ${(result.stderr || result.stdout || '').trim()}`);
    }
  });
  const pm2 = commands.pm2 || ((configFile) => {
    const result = spawnSync('pm2', ['startOrReload', configFile, '--update-env'], { encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) throw new Error(`pm2 startOrReload failed: ${(result.stderr || result.stdout || '').trim()}`);
  });
  const health = commands.health || (async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`health ${url} returned ${response.status}`);
  });
  const readCwd = commands.pm2Cwd || pm2Cwd;
  const done = [];
  for (const step of plan) {
    if (step.skip) {
      done.push(`skip ${step.text}`);
      continue;
    }
    if (step.id === 'clone-base') {
      const head = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
      if ((head.status ?? 1) !== 0) throw new Error(`cannot read commit of ${sourceRoot}`);
      mkdirSync(dirname(destRoot), { recursive: true });
      git(['clone', sourceRoot, destRoot]);
      git(['-C', destRoot, 'checkout', '--detach', head.stdout.trim()]);
    } else if (step.id === 'drop-other') {
      rmSync(join(destRoot, step.name), { recursive: true, force: true });
    } else if (step.id === 'copy-repo') {
      const src = join(sourceRoot, step.name);
      const dest = join(destRoot, step.name);
      if (step.mode === 'clone') {
        rmSync(dest, { recursive: true, force: true });
        git(['clone', '--local', src, dest]);
        if (step.name === `mls-${projectId}`) mirrorBranches(src, dest, git);
      } else if (!existsSync(dest)) {
        cpSync(src, dest, { recursive: true });
      }
    } else if (step.id === 'draft-owner') {
      const dest = join(destRoot, 'drafts', step.slug, 'owner.json');
      if (!existsSync(dest)) {
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(join(sourceRoot, 'drafts', step.slug, 'owner.json'), dest);
      }
    } else if (step.id === 'copy-file') {
      if (existsSync(join(sourceRoot, step.file))) cpSync(join(sourceRoot, step.file), join(destRoot, step.file));
    } else if (step.id === 'env') {
      ensureEnv(destRoot, step.key, step.value);
    } else if (step.id === 'pnpm') {
      pnpm(destRoot, storeDir);
    } else if (step.id === 'release') {
      release(destRoot, projectId);
      if (!currentInside(destRoot)) throw new Error(`release did not create ${destRoot}/current`);
    } else if (step.id === 'pm2') {
      const cwd = readCwd(step.appName);
      const wanted = join(destRoot, 'current');
      if (cwd === wanted) {
        done.push(`skip ${step.text}`);
        continue;
      }
      ensureProjectApp({ root: destRoot, projectId, remoteBase: destRoot });
      pm2(join(destRoot, 'pm2.apps.d', `${step.appName}.config.js`));
    } else if (step.id === 'health') {
      done.push(step.text);
      return { lines: done, health };
    }
    done.push(step.text);
  }
  return { lines: done, health: null };
}

export async function migrateToProjectTree(options) {
  const dirty = uncommittedDrafts(options.sourceRoot, options.projectId);
  if (dirty.length > 0) {
    const line = refusalLine(options.projectId, dirty);
    if (options.dryRun) return { lines: [line] };
    throw new Error(line);
  }
  const plan = buildPlan(options);
  if (options.dryRun) {
    return { lines: plan.map((step) => `${step.skip ? 'skip' : 'would'} ${step.text}`) };
  }
  const result = executePlan(plan, options);
  if (result.health) {
    const healthStep = plan.find((step) => step.id === 'health');
    await result.health(`http://127.0.0.1:${healthStep.port}/health`);
  }
  return { lines: result.lines };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  migrateToProjectTree(args).then((result) => {
    for (const line of result.lines) console.log(line);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

const entry = process.argv[1] || '';
if (entry.endsWith('migrateToProjectTree.mjs')) main();
