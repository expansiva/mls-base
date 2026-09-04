#!/usr/bin/env node
// ensureMlsBaseCheckout.mjs — convert /data/mls-base from a tarball copy into a
// git checkout of MLS_BASE_REPO (the same URL collab-runtime step 10 uses).
//
// Lima used to receive the platform as a copy (publishMlsBase.py tarball). The
// remote VM is already a checkout of https://github.com/expansiva/mls-base, so
// "update platform" is `git pull --ff-only`. This script makes lima take that
// same path without wiping VM state: ignored files (releases, current, .env,
// config.json, node_modules, mls-*) stay; tracked files become origin/main.
//
// Idempotent: a folder that is already a checkout (has .git, origin, HEAD) is
// left alone. Running twice does not pull and does not rewrite.
//
// Usage (on the VM):
//   node scripts/runtime/ensureMlsBaseCheckout.mjs
//   node scripts/runtime/ensureMlsBaseCheckout.mjs --root /data/mls-base
//   MLS_BASE_DIR=… MLS_BASE_REPO=… node scripts/runtime/ensureMlsBaseCheckout.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_MLS_BASE = resolve(SCRIPT_DIR, '..', '..');
export const DEFAULT_MLS_BASE_DIR = '/data/mls-base';
export const DEFAULT_MLS_BASE_REPO = 'https://github.com/expansiva/mls-base';

export function usage() {
  return [
    'Convert /data/mls-base from a copy into a git checkout of MLS_BASE_REPO.',
    'Same variables as collab-runtime step 10 (MLS_BASE_DIR, MLS_BASE_REPO).',
    '',
    '  node scripts/runtime/ensureMlsBaseCheckout.mjs [--root DIR] [--repo URL]',
    '',
    `  --root  default MLS_BASE_DIR or the mls-base that contains this script`,
    `  --repo  default MLS_BASE_REPO or ${DEFAULT_MLS_BASE_REPO}`,
  ].join('\n');
}

export function parseArgs(argv, defaults = {}) {
  let root = defaults.root ?? '';
  let repo = defaults.repo ?? '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ok: true, help: true, root: '', repo: '' };
    if (arg === '--root' && argv[i + 1]) { root = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--repo' && argv[i + 1]) { repo = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--repo=')) repo = arg.slice('--repo='.length);
    else return { ok: false, usage: usage() };
  }
  return {
    ok: true,
    help: false,
    root: String(root || process.env.MLS_BASE_DIR || SCRIPT_MLS_BASE).trim(),
    repo: String(repo || process.env.MLS_BASE_REPO || DEFAULT_MLS_BASE_REPO).trim(),
  };
}

export function normalizeRepoUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/u, '')
    .replace(/\.git$/iu, '');
}

function gitEnv() {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0' };
}

function git(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: gitEnv() });
  return {
    code: result.status ?? 1,
    out: `${result.stdout ?? ''}`.trim(),
    err: `${result.stderr ?? ''}`.trim(),
  };
}

function gitOrThrow(cwd, args) {
  const result = git(cwd, args);
  if (result.code !== 0) {
    const detail = result.err || result.out || `exit ${result.code}`;
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${detail}`);
  }
  return result.out;
}

export function inspectCheckout(root) {
  if (!existsSync(joinGit(root))) {
    return { kind: 'copy', head: '', origin: '' };
  }
  const head = git(root, ['rev-parse', 'HEAD']);
  const origin = git(root, ['remote', 'get-url', 'origin']);
  if (head.code === 0 && origin.code === 0) {
    return { kind: 'checkout', head: head.out, origin: origin.out };
  }
  return {
    kind: 'incomplete',
    head: head.code === 0 ? head.out : '',
    origin: origin.code === 0 ? origin.out : '',
  };
}

function joinGit(root) {
  return join(root, '.git');
}

function ensureOrigin(root, repo, state) {
  if (!state.origin) {
    gitOrThrow(root, ['remote', 'add', 'origin', repo]);
    return;
  }
  if (normalizeRepoUrl(state.origin) === normalizeRepoUrl(repo)) return;
  if (state.kind === 'checkout') return;
  gitOrThrow(root, ['remote', 'set-url', 'origin', repo]);
}

function ensureMainTracksOrigin(root) {
  const upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.code === 0 && upstream.out === 'origin/main') return;
  gitOrThrow(root, ['branch', '--set-upstream-to=origin/main', 'main']);
}

/**
 * Convert `root` into a checkout of `repo`. Ignored / untracked files stay.
 * Tracked files become origin/main (`checkout -f`). Already a checkout → no-op.
 */
export function ensureMlsBaseCheckout({ root, repo }) {
  const dest = resolve(root);
  const originUrl = String(repo || '').trim();
  if (!originUrl) throw new Error('MLS_BASE_REPO is empty');

  mkdirSync(dest, { recursive: true });
  if (!statSync(dest).isDirectory()) {
    throw new Error(`root is not a directory: ${dest}`);
  }

  const before = inspectCheckout(dest);
  if (before.kind === 'checkout') {
    return {
      status: 'already',
      root: dest,
      head: before.head,
      origin: before.origin,
    };
  }

  if (before.kind === 'copy') {
    const init = git(dest, ['init', '-b', 'main']);
    if (init.code !== 0) gitOrThrow(dest, ['init']);
  }

  const mid = inspectCheckout(dest);
  ensureOrigin(dest, originUrl, mid);
  gitOrThrow(dest, ['fetch', 'origin']);

  const originMain = git(dest, ['rev-parse', '--verify', 'origin/main']);
  if (originMain.code !== 0) {
    throw new Error(`origin/main missing after fetch from ${originUrl}`);
  }
  gitOrThrow(dest, ['checkout', '-f', '-B', 'main', 'origin/main']);
  ensureMainTracksOrigin(dest);

  const after = inspectCheckout(dest);
  if (after.kind !== 'checkout') {
    throw new Error(`conversion did not produce a checkout at ${dest}`);
  }
  return {
    status: 'converted',
    root: dest,
    head: after.head,
    origin: after.origin,
  };
}

function report(result) {
  const short = result.head ? result.head.slice(0, 7) : 'unknown';
  if (result.status === 'already') {
    console.log(`mls-base already a checkout at ${result.root} (HEAD ${short})`);
    return;
  }
  console.log(`mls-base converted to checkout at ${result.root} (HEAD ${short})`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.ok) fail(args.usage);
  if (args.help) {
    console.log(usage());
    return;
  }
  report(ensureMlsBaseCheckout({ root: args.root, repo: args.repo }));
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
  try {
    main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
