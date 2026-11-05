#!/usr/bin/env node
// Move one project from the shared tree (/data/mls-base, current-<id>) into
// /data/app<id>/mls-base. The old tree is left in place. A second run does not
// clone or copy again. --dry-run only prints the plan.
// --revert points app<port> back at the old tree and leaves /data/app<id> in place.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appNameOf, projectIdToPort } from './projectPorts.mjs';
import { ensureProjectApp } from './vmApps.mjs';

const MLS_DIR = /^mls-\d+$/u;

export function parseArgs(argv) {
  const args = { dryRun: false, revert: false, discardDrafts: false, projectId: '', sourceRoot: '/data/mls-base', destRoot: '', storeDir: '/data/.pnpm-store' };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--revert') args.revert = true;
    else if (token === '--discard-drafts') args.discardDrafts = true;
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

function isLinkedWorktree(dir) {
  try {
    return lstatSync(join(dir, '.git')).isFile();
  } catch {
    return false;
  }
}

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${repo}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout || '';
}

function defaultStopDrafts(commands) {
  return commands.stopDrafts || ((source, id) => {
    const stopped = [];
    for (const child of oldDraftChildren(source, id)) {
      try {
        process.kill(child.pid, 'SIGTERM');
        rmSync(child.file, { force: true });
        stopped.push(`${child.slug}:${child.port ?? '?'}`);
      } catch { /* already gone */ }
    }
    return stopped;
  });
}

/**
 * --discard-drafts: remove the drafts of this project before the migration. Draft children stop first (they hold
 * the worktree as cwd), then the worktree folders and the local branches team/* and user/* go. Databases stay.
 * Returns one line per thing removed.
 */
export function discardDrafts(sourceRoot, projectId, { stopDrafts } = {}) {
  const lines = [];
  const rows = draftWorktrees(sourceRoot, projectId);
  const stopped = stopDrafts ? stopDrafts(sourceRoot, projectId) : [];
  if (stopped.length) lines.push(`stopped draft children (${stopped.join(', ')})`);
  const repo = join(sourceRoot, `mls-${projectId}`);
  for (const row of rows) {
    // A linked worktree has a .git FILE; a standalone clone (older drafts, or another project's copy) has a .git DIR.
    if (isLinkedWorktree(row.work) && hasGit(repo)) git(repo, ['worktree', 'remove', '--force', row.work]);
    else rmSync(row.work, { recursive: true, force: true });
    const slugDir = dirname(row.work);
    const others = readdirSync(slugDir).filter((name) => MLS_DIR.test(name));
    if (others.length === 0) rmSync(slugDir, { recursive: true, force: true });
    lines.push(`discarded draft ${row.slug}`);
  }
  if (hasGit(repo)) {
    git(repo, ['worktree', 'prune']);
    const refs = git(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/team', 'refs/heads/user'])
      .split('\n').map((line) => line.trim()).filter(Boolean);
    for (const branch of refs) {
      git(repo, ['branch', '-D', branch]);
      lines.push(`deleted branch ${branch}`);
    }
  }
  return lines;
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

function configProjectIds(sourceRoot) {
  const file = join(sourceRoot, 'config.json');
  if (!existsSync(file)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  const projects = parsed && parsed.projects;
  if (!projects || typeof projects !== 'object') return [];
  return Object.keys(projects)
    .map((key) => key.replace(/^mls-/u, ''))
    .filter((id) => /^\d+$/u.test(id));
}

function gitHead(repo) {
  const result = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) return '';
  return (result.stdout || '').trim();
}

/** Tracked changes only. An untracked obj/ does not count. */
function trackedClean(repo) {
  if (!hasGit(repo)) return false;
  const result = spawnSync('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
  return (result.status ?? 1) === 0 && (result.stdout || '').trim() === '';
}

/** Copy obj when the old repo has compiled.zip at the same commit and is clean. */
export function objMode(sourceRoot, destRoot, id) {
  const src = join(sourceRoot, `mls-${id}`);
  if (!existsSync(join(src, 'obj', 'compiled.zip'))) return 'build';
  if (!trackedClean(src)) return 'build';
  const srcHead = gitHead(src);
  if (!srcHead) return 'build';
  const dest = join(destRoot, `mls-${id}`);
  if (hasGit(dest)) {
    if (gitHead(dest) !== srcHead) return 'build';
    if (!trackedClean(dest)) return 'build';
  }
  return 'copy';
}

export function closureIds(sourceRoot, projectId) {
  const ids = new Set(reposToCopy(sourceRoot, projectId).keep.map((name) => name.slice(4)));
  for (const id of configProjectIds(sourceRoot)) ids.add(id);
  return [...ids].sort();
}

function copyObj(sourceRoot, destRoot, id) {
  const src = join(sourceRoot, `mls-${id}`, 'obj');
  const dest = join(destRoot, `mls-${id}`, 'obj');
  mkdirSync(dest, { recursive: true });
  for (const name of ['compiled.zip', 'source.zip']) {
    if (existsSync(join(src, name))) cpSync(join(src, name), join(dest, name));
  }
}

export function partialDestination(destRoot) {
  if (!existsSync(destRoot)) return '';
  if (existsSync(join(destRoot, '.migrando')) || !currentInside(destRoot)) {
    return `destination exists but is not a finished migration: ${destRoot} (remove it first)`;
  }
  return '';
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
  steps.push({
    id: 'arm',
    skip: existsSync(join(destRoot, `mls-${projectId}`, '.git', 'hooks', 'post-receive')),
    text: `arm the git repos in ${destRoot} (gitReposSetup: hooks, baseline, ignore list)`,
  });
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
  for (const id of closureIds(sourceRoot, projectId)) {
    const mode = objMode(sourceRoot, destRoot, id);
    steps.push({
      id: 'obj',
      projectId: id,
      mode,
      skip: existsSync(join(destRoot, `mls-${id}`, 'obj', 'compiled.zip')),
      text: `${mode} obj mls-${id}`,
    });
  }
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
    id: 'stop-drafts',
    skip: oldDraftChildren(sourceRoot, projectId).length === 0,
    text: `stop the draft children of the old tree (they keep the ports 41xx)`,
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

function gitRead(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return (result.status ?? 1) === 0 ? String(result.stdout || '').trim() : '';
}

const PUSH_CONFIG_KEYS = ['receive.denyCurrentBranch', 'receive.denyDeletes', 'receive.advertisePushOptions'];

/**
 * A fresh `git clone` of the old tree is not a copy of what the VM had set up: its `origin` is the old folder
 * and the push settings are gone. Carry both over from the source repo: the same origin (or none) and the
 * `receive.*` keys, so a push into this tree behaves as it did in the old one.
 */
function carryRepoSetup(src, dest, git) {
  const origin = gitRead(src, ['remote', 'get-url', 'origin']);
  if (origin) git(['-C', dest, 'remote', 'set-url', 'origin', origin]);
  else if (gitRead(dest, ['remote', 'get-url', 'origin'])) git(['-C', dest, 'remote', 'remove', 'origin']);
  for (const key of PUSH_CONFIG_KEYS) {
    const value = gitRead(src, ['config', '--local', '--get', key]);
    if (value) git(['-C', dest, 'config', '--local', key, value]);
  }
}

/**
 * Draft child processes of the old tree for this project. They outlive the old principal (pm2 does not own them)
 * and keep holding their ports (4100…), so the new principal cannot start its own children there. Returns what it
 * would stop: `{ slug, pid, port }` of every `drafts/<slug>/dev.json` whose database is of this project and whose
 * pid is a live `deno` process.
 */
export function oldDraftChildren(sourceRoot, projectId, { readCommand = defaultReadCommand } = {}) {
  const found = [];
  const drafts = join(sourceRoot, 'drafts');
  if (!existsSync(drafts)) return found;
  for (const slug of readdirSync(drafts)) {
    const file = join(drafts, slug, 'dev.json');
    if (!existsSync(file)) continue;
    let info;
    try {
      info = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Number.isInteger(info?.pid) || info.pid <= 0) continue;
    if (!String(info.database ?? '').startsWith(`collab_app_draft_${projectId}_`)) continue;
    if (!/(^|[\\/\s])deno(\s|$)/u.test(readCommand(info.pid))) continue;
    found.push({ slug, pid: info.pid, port: info.port ?? null, file });
  }
  return found;
}

function defaultReadCommand(pid) {
  const result = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  return (result.status ?? 1) === 0 ? String(result.stdout || '').trim() : '';
}

function ensureEnv(destRoot, key, value) {
  const file = join(destRoot, '.env');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (text.split('\n').some((line) => line.startsWith(`${key}=`))) return;
  writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${key}=${value}\n`);
}

/** cwd quoted in pm2.apps.d/app<port>.config.js. Empty when the field is absent. */
export function configCwd(text) {
  const match = String(text).match(/cwd:\s*("(?:\\.|[^"])*")/u);
  if (!match) return '';
  try {
    const value = JSON.parse(match[1]);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function instanceCwd(row) {
  return row?.pm2_env?.pm_cwd || '';
}

function pm2Failed(args, result) {
  throw new Error(`pm2 ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
}

function pm2Spawn(args) {
  const result = spawnSync('pm2', args, { encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) pm2Failed(args, result);
}

// startOrReload of an app that already exists reloads it and leaves pm_cwd
// on the old tree. Switching the tree is delete, then start, then save.
function readAppInstances(appName, commands) {
  if (commands.pm2Instances) return commands.pm2Instances(appName);
  if (commands.pm2Cwd) {
    const cwd = commands.pm2Cwd(appName) || '';
    return [{ name: appName, pm2_env: { status: 'online', pm_cwd: cwd } }];
  }
  const listed = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  if ((listed.status ?? 1) !== 0) pm2Failed(['jlist'], listed);
  let rows = [];
  try {
    rows = JSON.parse(listed.stdout || '[]');
  } catch (error) {
    throw new Error(`pm2 jlist failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return rows.filter((item) => item && item.name === appName);
}

function pm2Actions(commands) {
  const injected = Boolean(commands.pm2 || commands.pm2Delete || commands.pm2Save || commands.pm2Instances || commands.pm2Cwd);
  return {
    deleteApp: commands.pm2Delete || (injected ? () => {} : (app) => pm2Spawn(['delete', app])),
    start: commands.pm2 || ((config) => pm2Spawn(['start', config])),
    save: commands.pm2Save || (injected ? () => {} : () => pm2Spawn(['save'])),
  };
}

const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_STEP_MS = 250;

function healthCause(error) {
  const cause = error && error.cause;
  if (cause && (cause.code || cause.message)) return cause.code || cause.message;
  if (error && error.code) return error.code;
  return error instanceof Error ? error.message : String(error);
}

/** Poll until the first HTTP 2xx, or fail with the real cause after the ceiling. */
export async function waitForHealth(url, timeoutMs = HEALTH_TIMEOUT_MS, stepMs = HEALTH_STEP_MS) {
  const started = Date.now();
  let last = 'fetch failed';
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 300) return;
      throw new Error(`health ${url} not ready after ${Date.now() - started} ms: HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('health ')) throw error;
      last = healthCause(error);
    }
    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) {
      throw new Error(`health ${url} not ready after ${elapsed} ms: ${last}`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(stepMs, timeoutMs - elapsed)));
  }
}

function assertCwd(appName, rows, wanted, online) {
  const bad = rows.find((row) => instanceCwd(row) !== wanted);
  if (rows.length === 0 || bad) {
    const got = bad ? instanceCwd(bad) : '(none)';
    throw new Error(`pm2 ${appName} cwd is still ${got}, wanted ${wanted}`);
  }
  if (!online) return;
  const down = rows.find((row) => row?.pm2_env?.status !== 'online');
  if (down) {
    throw new Error(`pm2 ${appName} status is ${down.pm2_env?.status || 'missing'}, wanted online`);
  }
}

export function executePlan(plan, {
  sourceRoot, destRoot, projectId, storeDir, markNew = false, state = {}, commands = {},
  healthTimeoutMs = HEALTH_TIMEOUT_MS, healthStepMs = HEALTH_STEP_MS,
}) {
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
  const arm = commands.arm || ((dest) => {
    const result = spawnSync(process.execPath, [
      join(dest, 'scripts/runtime/gitReposSetup.mjs'), '--root', dest,
    ], { cwd: dest, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) {
      throw new Error(`arm git repos failed: ${(result.stderr || result.stdout || '').trim()}`);
    }
  });
  const stopDrafts = defaultStopDrafts(commands);
  const health = commands.health || ((url) => waitForHealth(url, healthTimeoutMs, healthStepMs));
  const buildObj = commands.buildObj || ((dest, ids) => {
    const result = spawnSync(process.execPath, [
      join(dest, 'scripts/runtime/buildProjectsObj.mjs'), '--only', ids.join(','),
    ], { cwd: dest, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) {
      throw new Error(`build obj failed: ${(result.stderr || result.stdout || '').trim()}`);
    }
  });
  const done = [];
  let buildIds = [];
  const flushBuild = () => {
    if (buildIds.length === 0) return;
    const ids = buildIds;
    buildIds = [];
    buildObj(destRoot, ids);
    for (const id of ids) done.push(`build obj mls-${id}`);
  };
  for (const step of plan) {
    if (step.id !== 'obj') flushBuild();
    if (step.skip) {
      done.push(`skip ${step.text}`);
      continue;
    }
    if (step.id === 'obj' && step.mode === 'build') {
      buildIds.push(step.projectId);
      continue;
    }
    if (step.id === 'obj' && step.mode === 'copy') {
      copyObj(sourceRoot, destRoot, step.projectId);
      done.push(step.text);
      continue;
    }
    if (step.id === 'clone-base') {
      const head = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
      if ((head.status ?? 1) !== 0) throw new Error(`cannot read commit of ${sourceRoot}`);
      mkdirSync(dirname(destRoot), { recursive: true });
      git(['clone', sourceRoot, destRoot]);
      // On `main`, not detached: a push of refs/heads/main must move the checked-out HEAD (prepare checks it).
      git(['-C', destRoot, 'checkout', '-q', '-B', 'main', head.stdout.trim()]);
      carryRepoSetup(sourceRoot, destRoot, git);
      if (!gitRead(destRoot, ['config', '--local', '--get', 'receive.denyCurrentBranch'])) {
        git(['-C', destRoot, 'config', '--local', 'receive.denyCurrentBranch', 'updateInstead']);
      }
      if (markNew) writeFileSync(join(destRoot, '.migrando'), '');
    } else if (step.id === 'drop-other') {
      rmSync(join(destRoot, step.name), { recursive: true, force: true });
    } else if (step.id === 'copy-repo') {
      const src = join(sourceRoot, step.name);
      const dest = join(destRoot, step.name);
      if (step.mode === 'clone') {
        rmSync(dest, { recursive: true, force: true });
        git(['clone', '--local', src, dest]);
        carryRepoSetup(src, dest, git);
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
    } else if (step.id === 'arm') {
      arm(destRoot);
      done.push(step.text);
    } else if (step.id === 'env') {
      ensureEnv(destRoot, step.key, step.value);
    } else if (step.id === 'pnpm') {
      pnpm(destRoot, storeDir);
    } else if (step.id === 'release') {
      release(destRoot, projectId);
      if (!currentInside(destRoot)) throw new Error(`release did not create ${destRoot}/current`);
    } else if (step.id === 'pm2') {
      const wanted = join(destRoot, 'current');
      const before = readAppInstances(step.appName, commands);
      if (before.length > 0 && before.every((row) => instanceCwd(row) === wanted)) {
        done.push(`skip ${step.text}`);
        continue;
      }
      state.oldCwd = before[0] ? instanceCwd(before[0]) : '';
      state.switched = step.appName;
      ensureProjectApp({
        root: destRoot, projectId, remoteBase: destRoot,
        inheritFrom: join(sourceRoot, 'pm2.apps.d', `${step.appName}.config.js`),
      });
      const actions = pm2Actions(commands);
      actions.deleteApp(step.appName);
      actions.start(join(destRoot, 'pm2.apps.d', `${step.appName}.config.js`));
      actions.save();
      assertCwd(step.appName, readAppInstances(step.appName, commands), wanted, true);
    } else if (step.id === 'stop-drafts') {
      const stopped = stopDrafts(sourceRoot, projectId);
      done.push(`${step.text}${stopped.length ? ` (${stopped.join(', ')})` : ''}`);
    } else if (step.id === 'health') {
      done.push(step.text);
      return { lines: done, health };
    }
    done.push(step.text);
  }
  flushBuild();
  return { lines: done, health: null };
}

export async function migrateToProjectTree(options) {
  const discarded = [];
  if (options.discardDrafts && !options.dryRun) {
    discarded.push(...discardDrafts(options.sourceRoot, options.projectId, { stopDrafts: defaultStopDrafts(options.commands || {}) }));
  }
  const dirty = options.discardDrafts ? [] : uncommittedDrafts(options.sourceRoot, options.projectId);
  if (dirty.length > 0) {
    const line = refusalLine(options.projectId, dirty);
    if (options.dryRun) return { lines: [line] };
    throw new Error(line);
  }
  const partial = partialDestination(options.destRoot);
  if (partial) {
    if (options.dryRun) return { lines: [partial] };
    throw new Error(partial);
  }
  const plan = buildPlan(options);
  if (options.dryRun) {
    const head = options.discardDrafts
      ? draftWorktrees(options.sourceRoot, options.projectId).map((row) => `would discard draft ${row.slug}`)
      : [];
    return { lines: [...head, ...plan.map((step) => `${step.skip ? 'skip' : 'would'} ${step.text}`)] };
  }
  const existed = existsSync(options.destRoot);
  const state = {};
  try {
    const result = executePlan(plan, { ...options, markNew: !existed, state });
    if (result.health) {
      const healthStep = plan.find((step) => step.id === 'health');
      await result.health(`http://127.0.0.1:${healthStep.port}/health`);
    }
    if (!existed) rmSync(join(options.destRoot, '.migrando'), { force: true });
    return { lines: [...discarded, ...result.lines] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // The app already runs from the new tree: put it back on the old one before the folder goes away.
    let restored = '';
    if (state.switched) {
      try {
        const actions = pm2Actions(options.commands || {});
        actions.deleteApp(state.switched);
        actions.start(join(options.sourceRoot, 'pm2.apps.d', `${state.switched}.config.js`));
        actions.save();
        assertCwd(state.switched, readAppInstances(state.switched, options.commands || {}), state.oldCwd, false);
        restored = `; pm2 ${state.switched} restored to ${options.sourceRoot}`;
      } catch (restoreError) {
        const why = restoreError instanceof Error ? restoreError.message : String(restoreError);
        restored = `; pm2 ${state.switched} restore failed (${why}), kept ${options.destRoot}`;
        throw new Error(`migration failed: ${reason}${restored}`);
      }
    }
    if (!existed && existsSync(options.destRoot)) {
      rmSync(options.destRoot, { recursive: true, force: true });
      throw new Error(`migration failed: ${reason}; removed ${options.destRoot}${restored}`);
    }
    throw error;
  }
}

/** Point app<port> at the old tree's pm2 config. The new folder stays. */
export async function revertProjectTree(options) {
  const port = projectIdToPort(options.projectId);
  const appName = appNameOf(port);
  const configPath = join(options.sourceRoot, 'pm2.apps.d', `${appName}.config.js`);
  if (!existsSync(configPath)) {
    throw new Error(`refusing revert of ${options.projectId}: missing ${configPath}`);
  }
  const wanted = configCwd(readFileSync(configPath, 'utf8'));
  if (!wanted) {
    throw new Error(`refusing revert of ${options.projectId}: ${configPath} has no cwd`);
  }
  const commands = options.commands || {};
  const before = readAppInstances(appName, commands);
  const already = before.length > 0 && before.every((row) => instanceCwd(row) === wanted);
  const healthUrl = `http://127.0.0.1:${port}/health`;
  if (options.dryRun) {
    return {
      lines: already
        ? [`skip pm2 ${appName} → ${wanted}`, `skip GET ${healthUrl}`]
        : [`would pm2 delete ${appName}; start ${configPath}; save`, `would GET ${healthUrl}`],
    };
  }
  if (already) return { lines: [`skip pm2 ${appName} → ${wanted}`] };
  const actions = pm2Actions(commands);
  actions.deleteApp(appName);
  actions.start(configPath);
  actions.save();
  assertCwd(appName, readAppInstances(appName, commands), wanted, true);
  const health = commands.health || ((url) => waitForHealth(
    url,
    options.healthTimeoutMs ?? HEALTH_TIMEOUT_MS,
    options.healthStepMs ?? HEALTH_STEP_MS,
  ));
  await health(healthUrl);
  return { lines: [`pm2 ${appName} → ${wanted}`, `GET ${healthUrl}`] };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const run = args.revert ? revertProjectTree(args) : migrateToProjectTree(args);
  run.then((result) => {
    for (const line of result.lines) console.log(line);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

const entry = process.argv[1] || '';
if (entry.endsWith('migrateToProjectTree.mjs')) main();
