#!/usr/bin/env node
// Draft databases of a VM (rt185 s4). The draft of the Studio gets its own database (`draftDatabaseName`, mls-102034
// cbeDevProcess.ts): `collab_app_draft_<project>_u<12 hex>` for a person (slug `user-<16 hex>`) and
// `collab_app_draft_team_<project>` for the team (slug `team-<project>`). Every database made from template1 carries
// the TimescaleDB extension and costs one background scheduler, so a draft that was discarded must not leave its
// database behind. An ORPHAN is a draft database whose draft has no worktree folder (`drafts/<slug>/mls-<project>`)
// and no branch (`user/<16 hex>`, `team/<project>`) in any tree of this VM. Anything that does not match the two
// names is never touched.
//   node scripts/runtime/draftDatabases.mjs list  [--data /data] [--project <id>]
//   node scripts/runtime/draftDatabases.mjs prune [--data /data] [--project <id>] [--dry-run]
// The psql runner is `sudo -n -u postgres psql -Atq` (override: COLLAB_PSQL, split on spaces).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = 'collab_app_draft_';
const USER_NAME = /^collab_app_draft_(\d+)_u([a-f0-9]{12})$/u;
const TEAM_NAME = /^collab_app_draft_team_(\d+)$/u;

/** `{ kind, projectId, hex12? }` of a draft database name, or null when it is not one of the two forms. */
export function draftDatabaseOwner(name) {
  const user = USER_NAME.exec(name);
  if (user) return { kind: 'user', projectId: user[1], hex12: user[2] };
  const team = TEAM_NAME.exec(name);
  if (team) return { kind: 'team', projectId: team[1] };
  return null;
}

/** The trees of this VM: every /data/app<id>/mls-base and the old shared /data/mls-base, when they exist. */
export function treeRoots(dataRoot) {
  const roots = [];
  if (existsSync(dataRoot)) {
    for (const entry of readdirSync(dataRoot).sort()) {
      if (/^app\d+$/u.test(entry) && existsSync(join(dataRoot, entry, 'mls-base'))) roots.push(join(dataRoot, entry, 'mls-base'));
    }
  }
  if (existsSync(join(dataRoot, 'mls-base'))) roots.push(join(dataRoot, 'mls-base'));
  return roots;
}

function branchesOf(repo, git) {
  if (!existsSync(repo)) return [];
  return git(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/user', 'refs/heads/team'])
    .split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Why a draft is still alive in some tree: `folder <path>`, `branch <name>`, or '' when nothing holds it. */
export function draftHolder(owner, roots, git) {
  for (const root of roots) {
    const repo = join(root, `mls-${owner.projectId}`);
    const drafts = join(root, 'drafts');
    if (existsSync(drafts)) {
      for (const slug of readdirSync(drafts)) {
        const mine = owner.kind === 'user'
          ? (/^user-([a-f0-9]{16})$/u.exec(slug)?.[1] ?? '').startsWith(owner.hex12)
          : slug === `team-${owner.projectId}`;
        if (mine && existsSync(join(drafts, slug, `mls-${owner.projectId}`))) return `folder ${join(drafts, slug, `mls-${owner.projectId}`)}`;
      }
    }
    for (const branch of branchesOf(repo, git)) {
      const user = /^user\/([a-f0-9]{16})$/u.exec(branch);
      if (owner.kind === 'user' && user && user[1].startsWith(owner.hex12)) return `branch ${branch} in ${repo}`;
      if (owner.kind === 'team' && branch === `team/${owner.projectId}`) return `branch ${branch} in ${repo}`;
    }
  }
  return '';
}

function defaultGit(repo, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', repo, ...args], { encoding: 'utf8' });
}

function defaultPsql() {
  const parts = (process.env.COLLAB_PSQL || 'sudo -n -u postgres psql -Atq').split(/\s+/u).filter(Boolean);
  return (sql) => execFileSync(parts[0], [...parts.slice(1), '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();
}

/**
 * Every `collab_app_draft_*` database with its size, its client connections (the TimescaleDB schedulers are not
 * clients) and whether it is an orphan. `projectId` limits the answer to that project.
 */
export function listDraftDatabases({ dataRoot = '/data', projectId = '', psql = defaultPsql(), git = defaultGit } = {}) {
  const rows = psql(`select d.datname, pg_database_size(d.datname), (select count(*) from pg_stat_activity a where a.datname = d.datname and a.backend_type = 'client backend') from pg_database d where d.datname like '${PREFIX}%' order by d.datname`)
    .split('\n').filter(Boolean).map((line) => line.split('|'));
  const roots = treeRoots(dataRoot);
  return rows.map(([name, bytes, clients]) => {
    const owner = draftDatabaseOwner(name);
    const base = { name, bytes: Number(bytes), clients: Number(clients) };
    if (!owner) return { ...base, status: 'unknown', reason: 'name is not a draft database form' };
    if (projectId && owner.projectId !== String(projectId)) return null;
    const holder = draftHolder(owner, roots, git);
    if (holder) return { ...base, projectId: owner.projectId, status: 'active', reason: holder };
    if (base.clients > 0) return { ...base, projectId: owner.projectId, status: 'busy', reason: `${base.clients} client connection(s)` };
    return { ...base, projectId: owner.projectId, status: 'orphan', reason: 'no folder and no branch' };
  }).filter(Boolean);
}

function megabytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Drops the orphans (only them). `dryRun` says what it would drop. Returns one line per database. */
export function pruneDraftDatabases({ dryRun = false, ...options } = {}) {
  const psql = options.psql ?? defaultPsql();
  const lines = [];
  for (const row of listDraftDatabases({ ...options, psql })) {
    if (row.status !== 'orphan') {
      lines.push(`keep ${row.name} (${row.status}: ${row.reason})`);
      continue;
    }
    if (dryRun) {
      lines.push(`would drop ${row.name} (${megabytes(row.bytes)})`);
      continue;
    }
    psql(`drop database "${row.name}"`);
    lines.push(`dropped ${row.name} (${megabytes(row.bytes)})`);
  }
  return lines;
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

function cli(argv) {
  const dataRoot = flag(argv, '--data') ?? '/data';
  const projectId = flag(argv, '--project') ?? '';
  if (argv[0] === 'list') {
    for (const row of listDraftDatabases({ dataRoot, projectId })) {
      process.stdout.write(`${row.status.padEnd(7)} ${row.name} ${megabytes(row.bytes)}${row.reason ? ` (${row.reason})` : ''}\n`);
    }
    return 0;
  }
  if (argv[0] === 'prune') {
    for (const line of pruneDraftDatabases({ dataRoot, projectId, dryRun: argv.includes('--dry-run') })) process.stdout.write(`${line}\n`);
    return 0;
  }
  process.stderr.write('usage: draftDatabases.mjs list|prune [--data /data] [--project <id>] [--dry-run]\n');
  return 2;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(cli(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
