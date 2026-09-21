#!/usr/bin/env node
// scripts/publish/clearTree.mjs — put a project's repo ON THE VM back into a
// state that accepts the next push from this machine.
//
// The Mac is the source; the VM is a build/run target. Two different things
// stop a publish, and this script clears BOTH:
//
//   1. dirty worktree -> `! [remote rejected] main -> main (Working directory
//      has unstaged changes)`. The build rewrites l5/config.json / mlsDep.json
//      and `restoreWorktree` did not run, or the Studio edited files there.
//      Fix: `git reset -q` (unstage) + `git checkout -- .` (tracked back to HEAD).
//
//   2. the VM is ahead -> `the VM has commits you do not — pull/rebase`. The
//      Studio commits directly on the VM (author `collab studio`), so the VM
//      grows commits this machine never had. Fix: move the VM branch back to
//      the merge-base, which makes the next push a plain fast-forward.
//
// (2) discards commits, so it is never silent: the dropped commits are written
// first as a `git format-patch` series next to the diff patch, and the path is
// printed. `git am` puts them back. Use --keep-vm-commits to refuse instead of
// dropping (it reports and exits 2, for when the VM work matters).
//
// It still never force-pushes and never rewrites THIS machine's history — all
// history surgery happens on the VM's own branch, which is a materialized copy.
//
// The profile comes from publishGit (PUBLISH_LOCAL_* in mls-base/.env for
// `local`; servers/<profile>.conf or flags for `remote`). No new config
// surface. An https-only profile (--git-url, no SSH_HOST) cannot run a command
// on the VM — git-http-backend serves git, not a shell — so it fails saying so.
//
//   node scripts/publish/clearTree.mjs <projectId|mls-<id>> <local|remote>
//        [--dry-run] [--include-untracked] [--keep-vm-commits]
//        [--ssh-host=…] [--ssh-config=…] [--remote-base=…]

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { resolveProfileConf } from '../publishGit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_REMOTE_BASE = '/data/mls-base';
const PROFILES = new Set(['local', 'remote']);
const FLAG_CONF = {
  '--ssh-host': 'SSH_HOST',
  '--ssh-config': 'SSH_CONFIG',
  '--remote-base': 'REMOTE_BASE',
};

function fail(message, code = 1) {
  process.stderr.write(`[clearTree] ${message}\n`);
  process.exit(code);
}

function log(message) {
  process.stderr.write(`[clearTree] ${message}\n`);
}

function usage() {
  return [
    'usage: node scripts/publish/clearTree.mjs <projectId|mls-<id>> <local|remote>',
    '       [--dry-run] [--include-untracked] [--keep-vm-commits]',
    '  --dry-run            show what would be cleared and stop',
    '  --include-untracked  also `git clean -fd` (NOT recoverable from the patch)',
    '  --keep-vm-commits    refuse (exit 2) instead of dropping VM-only commits',
  ].join('\n');
}

export function parseArgs(argv) {
  const positional = [];
  const flagConf = {};
  let dryRun = false;
  let includeUntracked = false;
  let keepVmCommits = false;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--include-untracked') {
      includeUntracked = true;
    } else if (arg === '--keep-vm-commits') {
      keepVmCommits = true;
    } else if (arg.startsWith('--')) {
      const [name, value] = arg.split('=');
      const key = FLAG_CONF[name];
      if (!key || value === undefined) return { ok: false, usage: usage() };
      flagConf[key] = value;
    } else {
      positional.push(arg);
    }
  }
  const idMatch = /^(?:mls-)?(\d+)$/u.exec(positional[0] ?? '');
  const profile = positional[1];
  if (!idMatch || !PROFILES.has(profile)) return { ok: false, usage: usage() };
  return { ok: true, id: idMatch[1], profile, dryRun, includeUntracked, keepVmCommits, flagConf };
}

// ssh args from the same conf publishGit builds GIT_SSH_COMMAND from.
export function sshArgs(conf) {
  const args = [];
  if (conf.SSH_CONFIG) args.push('-F', conf.SSH_CONFIG);
  if (conf.CERT) args.push('-i', conf.CERT);
  return args;
}

export function remoteDir(conf, id) {
  const base = (conf.REMOTE_BASE || DEFAULT_REMOTE_BASE).replace(/\/+$/u, '');
  return `${base}/mls-${id}`;
}

export function sshUrl(conf, id) {
  const base = (conf.REMOTE_BASE || DEFAULT_REMOTE_BASE).replace(/\/+$/u, '');
  return `ssh://${conf.SSH_HOST}${base}/mls-${id}`;
}

function ssh(conf, command) {
  const result = spawnSync('ssh', [...sshArgs(conf), conf.SSH_HOST, command], {
    encoding: 'utf8',
  });
  if (result.error) fail(`ssh failed: ${result.error.message}`);
  return { code: result.status ?? 1, out: result.stdout ?? '', err: result.stderr ?? '' };
}

function git(dir, args, conf) {
  const env = { ...process.env };
  const parts = ['ssh', ...sshArgs(conf)];
  if (parts.length > 1) env.GIT_SSH_COMMAND = parts.join(' ');
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env });
  if (result.error) fail(`git failed: ${result.error.message}`);
  return { code: result.status ?? 1, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// porcelain -> {tracked, untracked}. Column 2 === '?' marks untracked; anything
// else (including a staged change in column 1) is tracked and goes back to HEAD.
export function splitStatus(porcelain) {
  const tracked = [];
  const untracked = [];
  for (const line of porcelain.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const path = line.slice(3);
    if (line.startsWith('??')) untracked.push(path);
    else tracked.push(`${line.slice(0, 2).trim()} ${path}`);
  }
  return { tracked, untracked };
}

function patchPath(id, suffix) {
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  return join(tmpdir(), `clearTree-mls-${id}-${stamp}.${suffix}`);
}

// ── 1. dirty worktree ──────────────────────────────────────────────────────
function clearWorktree({ conf, id, dir, dryRun, includeUntracked }) {
  const status = ssh(conf, `git -C '${dir}' status --porcelain`);
  if (status.code !== 0) fail(`git status failed on the VM:\n${status.err.trim()}`);

  const { tracked, untracked } = splitStatus(status.out);
  if (tracked.length === 0 && untracked.length === 0) {
    log('worktree: already clean.');
    return;
  }

  if (tracked.length > 0) {
    log(`worktree: ${tracked.length} tracked change(s) to discard:`);
    for (const entry of tracked) process.stderr.write(`    ${entry}\n`);
  }
  if (untracked.length > 0) {
    log(
      `worktree: ${untracked.length} untracked file(s) — ` +
        (includeUntracked ? 'WILL be deleted, not in the patch:' : 'left alone:'),
    );
    for (const entry of untracked) process.stderr.write(`    ${entry}\n`);
  }

  // The safety net: a Studio edit may live only here. Save it before touching it.
  if (tracked.length > 0) {
    const diff = ssh(conf, `git -C '${dir}' diff HEAD`);
    if (diff.code !== 0) fail(`git diff failed on the VM:\n${diff.err.trim()}`);
    const file = patchPath(id, 'worktree.patch');
    writeFileSync(file, diff.out);
    log(`  saved: ${file}`);
    log(`  restore with: git -C <repo> apply '${file}'`);
  }

  if (dryRun) return;

  // reset -q unstages without touching files; checkout -- . then puts every
  // tracked file back to HEAD. Together they clean the worktree without
  // `reset --hard` and without removing untracked files.
  const clean = ssh(conf, `git -C '${dir}' reset -q && git -C '${dir}' checkout -- .`);
  if (clean.code !== 0) fail(`failed to clean the worktree:\n${clean.err.trim()}`);
  if (includeUntracked && untracked.length > 0) {
    const cleaned = ssh(conf, `git -C '${dir}' clean -fd`);
    if (cleaned.code !== 0) fail(`git clean failed:\n${cleaned.err.trim()}`);
    if (cleaned.out.trim()) process.stderr.write(`${cleaned.out.trimEnd()}\n`);
  }
  log('worktree: clean.');
}

// ── 2. the VM is ahead ─────────────────────────────────────────────────────
// Compared against THIS machine's HEAD, because that is what the publish will
// push. Anything the VM has and this machine does not is what blocks it.
function clearAhead({ conf, id, dir, dryRun, keepVmCommits }) {
  const local = resolve(ROOT, `mls-${id}`);
  const fetched = git(local, ['fetch', '-q', sshUrl(conf, id), 'main'], conf);
  if (fetched.code !== 0) fail(`could not fetch from the VM:\n${fetched.err.trim()}`);

  const ahead = git(local, ['log', '--oneline', 'FETCH_HEAD', '--not', 'HEAD'], conf);
  const commits = ahead.out.split(/\r?\n/u).filter((line) => line.trim());
  if (commits.length === 0) {
    log('history: the VM has nothing this machine lacks — the push is a fast-forward.');
    return;
  }

  log(`history: the VM is ahead by ${commits.length} commit(s):`);
  for (const entry of commits) process.stderr.write(`    ${entry}\n`);

  if (keepVmCommits) {
    fail(
      '--keep-vm-commits: refusing to drop them. Bring them here first:\n' +
        `    git -C mls-${id} fetch vm && git -C mls-${id} merge vm/main`,
      2,
    );
  }

  // format-patch keeps message and authorship, so `git am` is a real restore —
  // not just the text of the change.
  const series = git(local, ['format-patch', '--stdout', 'HEAD..FETCH_HEAD'], conf);
  if (series.code !== 0) fail(`could not save the VM commits:\n${series.err.trim()}`);
  const file = patchPath(id, 'vm-commits.patch');
  writeFileSync(file, series.out);
  log(`  saved: ${file}`);
  log(`  restore with: git -C <repo> am '${file}'`);

  const base = git(local, ['merge-base', 'HEAD', 'FETCH_HEAD'], conf);
  if (base.code !== 0 || !base.out.trim()) fail('could not compute the merge-base with the VM.');
  const mergeBase = base.out.trim();

  if (dryRun) {
    log(`--dry-run: would move the VM branch back to ${mergeBase.slice(0, 7)}.`);
    return;
  }

  // The VM branch is a materialized copy, not a history to preserve — moving it
  // to the merge-base is what makes this machine's push a fast-forward again.
  const reset = ssh(conf, `git -C '${dir}' reset --hard ${mergeBase}`);
  if (reset.code !== 0) fail(`could not move the VM branch:\n${reset.err.trim()}`);
  log(`history: VM branch moved back to ${mergeBase.slice(0, 7)}.`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) fail(parsed.usage);
  const { id, profile, dryRun, includeUntracked, keepVmCommits, flagConf } = parsed;

  const conf = resolveProfileConf(profile, undefined, flagConf);
  if (!conf.SSH_HOST) {
    fail(
      'this profile has no SSH_HOST. Clearing the VM needs a command on it, ' +
        'and the https door (/git/) only serves git. Use --ssh-host=… or an ssh profile.',
    );
  }

  const dir = remoteDir(conf, id);
  const probe = ssh(conf, `test -d '${dir}/.git' && echo ok || echo missing`);
  if (probe.out.trim() !== 'ok') {
    fail(`mls-${id} is not a git repo at ${dir} on ${conf.SSH_HOST}.`);
  }
  log(`mls-${id} on ${conf.SSH_HOST} (${dir})`);

  // Order matters: the worktree must be clean before the branch can move.
  clearWorktree({ conf, id, dir, dryRun, includeUntracked });
  clearAhead({ conf, id, dir, dryRun, keepVmCommits });

  if (dryRun) {
    log('--dry-run: nothing changed on the VM.');
    return;
  }
  log('the VM will accept the next push — run the publish yourself.');
}

function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.endsWith('clearTree.mjs');
}

if (invokedAsMain()) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack || error.message : String(error));
  });
}
