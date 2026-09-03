#!/usr/bin/env node
// scripts/runtime/gitReposSetup.mjs
// Turn every mls-<id> folder at the mls-base root into a normal (non-bare) git
// repo, on the VM. Idempotent: a re-run completes missing config and reports
// status; it does not recreate vm-baseline or add commits when already set up.
//
// receive.denyCurrentBranch=updateInstead so a push against a dirty worktree
// (Studio/DriverVm save) is refused instead of silently overwriting.
// vm-baseline is an immutable snapshot of the bootstrap commit.
// post-receive (gitPostReceive.sh) compiles on push to main and cuts a release.
//
// Usage (on the VM):
//   node scripts/runtime/gitReposSetup.mjs
//   node scripts/runtime/gitReposSetup.mjs --root /data/mls-base

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');
const VM_ROOT = '/data/mls-base';
const GIT_USER_NAME = 'collab-vm';
const GIT_USER_EMAIL = 'vm@collab.codes';
const INITIAL_COMMIT_MSG = 'vm-baseline: initial snapshot';
const COMPLETION_COMMIT_MSG = 'gitReposSetup: complete ignore list';
const SOURCE_INCLUDE_COMMIT_MSG =
  'gitReposSetup: include source .mjs/.js excluded by inherited ignore';

const IGNORE_BLOCK_HEADER = '# --- collab-vm (gitReposSetup) ---';
const REQUIRED_IGNORES = [
  '/obj/',
  '/node_modules/',
  '/dist/',
  '/.env',
  '.collab-fs.json',
  '.collab-fs-trash/',
  '.DS_Store',
];
// Inherited Mac .gitignore often has `*.js` / `*.mjs`, which swallows source.
// Negate them after that block; build output stays ignored by directory.
const SOURCE_UNIGNORES = [
  '!*.js',
  '!*.mjs',
];

const UPDATE_HOOK = `#!/bin/sh
# collab-vm gitReposSetup: vm-baseline is a snapshot, never updated by push
ref="$1"
if [ "$ref" = "refs/heads/vm-baseline" ]; then
  echo "refusing update to vm-baseline (immutable snapshot created by gitReposSetup)" >&2
  exit 1
fi
exit 0
`;

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf('--root');
const rootFromFlag = rootFlag >= 0 ? argv[rootFlag + 1] : null;
const ROOT = resolve(rootFromFlag || DEFAULT_ROOT);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function git(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: (stdout ?? '').trim(), stderr: '' };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? '').trim(),
      status: typeof error.status === 'number' ? error.status : 1,
    };
  }
}

function gitOrThrow(cwd, args) {
  const result = git(cwd, args);
  if (!result.ok) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${detail}`);
  }
  return result.stdout;
}

function isMlsDir(name, parent) {
  if (!/^mls-\d+$/u.test(name)) return false;
  try {
    return statSync(join(parent, name)).isDirectory();
  } catch {
    return false;
  }
}

function discoverProjects(root) {
  return readdirSync(root)
    .filter((name) => isMlsDir(name, root))
    .sort();
}

/**
 * A PASTA é um repo — não "está dentro de um repo".
 *
 * `git rev-parse --git-dir` sobe a árvore: dentro de um checkout do mls-base ele responde OK para
 * qualquer subpasta, devolvendo o .git do PAI. Com isso todo projeto era classificado como repo
 * alheio (`skipped-external-remote`, porque os remotes lidos eram os do mls-base) e nunca ganhava
 * repositório próprio. Medido em 03/09: na VM o `/data/mls-base` é um clone do GitHub, então
 * NENHUM projeto criado lá tinha `.git` — sem main, sem vm-baseline, e sem para onde empurrar.
 * Na lima passava despercebido porque lá o mls-base chegou por cópia, não por clone.
 */
function isRepo(dir) {
  return existsSync(join(dir, '.git'));
}

function hasHead(dir) {
  return git(dir, ['rev-parse', '--verify', 'HEAD']).ok;
}

function localConfig(dir, key) {
  const result = git(dir, ['config', '--local', '--get', key]);
  return result.ok ? result.stdout : '';
}

function ensureLocalConfig(dir, key, value) {
  if (localConfig(dir, key) === value) return false;
  gitOrThrow(dir, ['config', '--local', key, value]);
  return true;
}

function currentBranch(dir) {
  const result = git(dir, ['symbolic-ref', '--short', 'HEAD']);
  return result.ok ? result.stdout : '';
}

function branchExists(dir, name) {
  return git(dir, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]).ok;
}

function remotes(dir) {
  const result = git(dir, ['remote']);
  if (!result.ok || !result.stdout) return [];
  return result.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

function ignoreLineCovers(line, required) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  if (trimmed === required) return true;
  const bare = required.replace(/^\/+/u, '').replace(/\/+$/u, '');
  const candidates = new Set([
    required,
    bare,
    `/${bare}`,
    `/${bare}/`,
    `${bare}/`,
    `**/${bare}`,
    `**/${bare}/`,
  ]);
  return candidates.has(trimmed);
}

function missingPatterns(text, patterns) {
  const lines = text.split(/\r?\n/u);
  return patterns.filter((pattern) => !lines.some((line) => ignoreLineCovers(line, pattern)));
}

function ensureGitignore(dir) {
  const file = join(dir, '.gitignore');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const missingIgnores = missingPatterns(existing, REQUIRED_IGNORES);
  const missingUnignores = missingPatterns(existing, SOURCE_UNIGNORES);
  if (missingIgnores.length === 0 && missingUnignores.length === 0) {
    return { changed: false, addedUnignores: false };
  }
  const parts = [];
  if (existing && !existing.endsWith('\n')) parts.push('\n');
  if (!existing.includes(IGNORE_BLOCK_HEADER)) {
    if (existing) parts.push('\n');
    parts.push(`${IGNORE_BLOCK_HEADER}\n`);
  } else if (existing) {
    parts.push('\n');
  }
  const missing = [...missingIgnores, ...missingUnignores];
  parts.push(missing.join('\n'), '\n');
  writeFileSync(file, existing + parts.join(''));
  return { changed: true, addedUnignores: missingUnignores.length > 0 };
}

function ensureUpdateHook(dir) {
  const hookPath = join(dir, '.git', 'hooks', 'update');
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current === UPDATE_HOOK) return false;
    if (!current.includes('collab-vm gitReposSetup')) {
      return 'foreign';
    }
  }
  writeFileSync(hookPath, UPDATE_HOOK);
  chmodSync(hookPath, 0o755);
  return true;
}

function postReceiveHookBody() {
  const script = join(SCRIPT_DIR, 'gitPostReceive.sh');
  return `#!/bin/sh
# collab-vm gitReposSetup: post-receive -> build + release
export COLLAB_MLS_BASE="${ROOT}"
exec "${script}"
`;
}

function ensurePostReceiveHook(dir) {
  const scriptPath = join(SCRIPT_DIR, 'gitPostReceive.sh');
  if (existsSync(scriptPath)) chmodSync(scriptPath, 0o755);
  const hookPath = join(dir, '.git', 'hooks', 'post-receive');
  const body = postReceiveHookBody();
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current === body) return false;
    if (!current.includes('collab-vm gitReposSetup')) {
      return 'foreign';
    }
  }
  writeFileSync(hookPath, body);
  chmodSync(hookPath, 0o755);
  return true;
}

function untrackIgnored(dir) {
  const tracked = gitOrThrow(dir, ['ls-files', '-z', '--', 'obj', 'node_modules', 'dist', '.collab-fs.json']);
  if (!tracked) return false;
  gitOrThrow(dir, ['rm', '-r', '--cached', '--ignore-unmatch', '--', 'obj', 'node_modules', 'dist', '.collab-fs.json']);
  return true;
}

function hasStaged(dir) {
  // exit 0 = no diff, 1 = diff
  const result = git(dir, ['diff', '--cached', '--quiet']);
  return !result.ok;
}

function worktreeDirty(dir) {
  const porcelain = gitOrThrow(dir, ['status', '--porcelain']);
  return porcelain.length > 0;
}

function ensureMainBranch(dir) {
  if (branchExists(dir, 'main')) {
    const cur = currentBranch(dir);
    if (cur && cur !== 'main') {
      gitOrThrow(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    }
    return;
  }
  const cur = currentBranch(dir);
  if (cur && cur !== 'main' && hasHead(dir)) {
    gitOrThrow(dir, ['branch', '-m', cur, 'main']);
    return;
  }
  gitOrThrow(dir, ['checkout', '-B', 'main']);
}

function initialCommit(dir) {
  ensureMainBranch(dir);
  gitOrThrow(dir, ['add', '-A']);
  if (!hasStaged(dir)) {
    gitOrThrow(dir, ['commit', '--allow-empty', '-m', INITIAL_COMMIT_MSG]);
  } else {
    gitOrThrow(dir, ['commit', '-m', INITIAL_COMMIT_MSG]);
  }
}

function completionCommit(dir, message) {
  gitOrThrow(dir, ['add', '-A']);
  if (!hasStaged(dir)) return false;
  gitOrThrow(dir, ['commit', '-m', message]);
  return true;
}

function setupRepo(dir) {
  const actions = [];

  if (!isRepo(dir)) {
    gitOrThrow(dir, ['init', '-b', 'main']);
    actions.push('init');
  } else if (remotes(dir).length > 0 && !branchExists(dir, 'vm-baseline')) {
    return { status: 'skipped-external-remote', actions };
  }

  if (ensureLocalConfig(dir, 'user.name', GIT_USER_NAME)) actions.push('user.name');
  if (ensureLocalConfig(dir, 'user.email', GIT_USER_EMAIL)) actions.push('user.email');
  if (ensureLocalConfig(dir, 'receive.denyCurrentBranch', 'updateInstead')) actions.push('updateInstead');
  if (ensureLocalConfig(dir, 'receive.denyDeletes', 'true')) actions.push('denyDeletes');
  // gb13: sem isto o git NEGOCIA sem opções de push e o `-o skip-build` /
  // `-o deps=…` some em silêncio — o hook compilaria tudo, ou nada, sem avisar.
  if (ensureLocalConfig(dir, 'receive.advertisePushOptions', 'true')) actions.push('advertisePushOptions');

  const hook = ensureUpdateHook(dir);
  if (hook === 'foreign') {
    actions.push('hook-foreign-left-untouched');
  } else if (hook === true) {
    actions.push('update-hook');
  }

  const postReceive = ensurePostReceiveHook(dir);
  if (postReceive === 'foreign') {
    actions.push('post-receive-foreign-left-untouched');
  } else if (postReceive === true) {
    actions.push('post-receive-hook');
  }

  const gitignore = ensureGitignore(dir);
  if (gitignore.changed) actions.push('gitignore');

  const existedHead = hasHead(dir);
  if (!existedHead) {
    initialCommit(dir);
    actions.push('initial-commit');
  } else {
    untrackIgnored(dir);
    const commitMsg = gitignore.addedUnignores
      ? SOURCE_INCLUDE_COMMIT_MSG
      : COMPLETION_COMMIT_MSG;
    if (completionCommit(dir, commitMsg)) actions.push('completion-commit');
  }

  if (!branchExists(dir, 'main')) {
    ensureMainBranch(dir);
    actions.push('main');
  }
  if (!branchExists(dir, 'vm-baseline')) {
    const tip = gitOrThrow(dir, ['rev-parse', 'HEAD']);
    gitOrThrow(dir, ['branch', 'vm-baseline', tip]);
    actions.push('vm-baseline');
  }

  const dirty = worktreeDirty(dir);
  const branches = gitOrThrow(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
  const log = gitOrThrow(dir, ['log', '-1', '--oneline']);
  const status = actions.length === 0 ? 'já configurado' : (actions.includes('init') ? 'initialized' : 'completed');
  return {
    status,
    actions,
    dirty,
    branches: branches.split('\n').filter(Boolean),
    head: log,
  };
}

function main() {
  if (!gitAvailable()) {
    fail(
      'git is not installed on this machine.\n'
      + 'Install it (Ubuntu: sudo apt-get install -y git) and re-run this script.\n'
      + 'Installing git is a manual operator action; this script will not do it.',
    );
  }

  if (!rootFromFlag && ROOT !== VM_ROOT) {
    fail(
      `Refusing to run at ${ROOT}.\n`
      + `This script initializes git inside every mls-* folder and is meant for the VM (${VM_ROOT}).\n`
      + 'On the VM: node scripts/runtime/gitReposSetup.mjs\n'
      + 'To override: node scripts/runtime/gitReposSetup.mjs --root <path>',
    );
  }

  if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) {
    fail(`root does not exist or is not a directory: ${ROOT}`);
  }

  const projects = discoverProjects(ROOT);
  if (projects.length === 0) {
    fail(`no mls-<id> folders found under ${ROOT}`);
  }

  console.log(`gitReposSetup root=${ROOT} projects=${projects.length}`);
  const rows = [];
  let failed = 0;
  for (const name of projects) {
    const dir = join(ROOT, name);
    try {
      const result = setupRepo(dir);
      const extra = result.actions.length ? ` [${result.actions.join(', ')}]` : '';
      const dirty = result.dirty ? ' dirty' : '';
      console.log(`${name} | ${result.status}${extra}${dirty} | ${dir}`);
      if (result.head) console.log(`  HEAD ${result.head}  branches: ${result.branches.join(', ')}`);
      rows.push({ name, ...result });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${name} | error | ${dir}`);
      console.error(`  ${message}`);
      rows.push({ name, status: 'error', actions: [message] });
    }
  }

  const counts = new Map();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) || 0) + 1);
  console.log('---');
  for (const [status, n] of [...counts.entries()].sort()) {
    console.log(`${n} ${status}`);
  }
  if (failed) process.exit(1);
}

main();
