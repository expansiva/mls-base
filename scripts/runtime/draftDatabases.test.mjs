import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { draftDatabaseOwner, listDraftDatabases, pruneDraftDatabases } from './draftDatabases.mjs';

const MB = 1024 * 1024;

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@x' } });
}

/** /data with the project tree of 102047 (a worktree folder for one person, a branch for another) and the old tree. */
function dataRoot() {
  const data = mkdtempSync(join(tmpdir(), 'rt185-drafts-'));
  const tree = join(data, 'app102047', 'mls-base');
  const repo = join(tree, 'mls-102047');
  mkdirSync(repo, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(repo, 'branch', 'user/679068f3c1ffacd0');
  mkdirSync(join(tree, 'drafts', 'user-48b2698f03c6ad8d', 'mls-102047'), { recursive: true });
  // a team folder that holds only another project's clone does not hold the team of 102047
  mkdirSync(join(tree, 'drafts', 'team-102047', 'mls-102056'), { recursive: true });
  mkdirSync(join(data, 'mls-base'), { recursive: true });
  return data;
}

const DATABASES = [
  ['collab_app_draft_102047_u48b2698f03c6', 3 * MB, 0], // folder -> active
  ['collab_app_draft_102047_u679068f3c1ff', 5 * MB, 0], // branch -> active
  ['collab_app_draft_team_102047', 14 * MB, 0], // only another project's clone in drafts/team-102047 -> orphan
  ['collab_app_draft_102047_u44dd34ecef2b', 11 * MB, 2], // no holder but clients -> busy
  ['collab_app_draft_102056_u48b2698f03c6', 12 * MB, 0], // project 102056 has no tree here -> orphan
  ['collab_app_draft_foo', 1 * MB, 0], // not a draft form -> unknown
];

function fakePsql(drops = []) {
  return (sql) => {
    if (sql.startsWith('select d.datname')) return DATABASES.map((row) => row.join('|')).join('\n');
    const drop = /^drop database "([^"]+)"$/u.exec(sql);
    if (drop) { drops.push(drop[1]); return ''; }
    throw new Error(`unexpected sql: ${sql}`);
  };
}

test('the two draft database names map to their owner; anything else maps to nothing', () => {
  assert.deepEqual(draftDatabaseOwner('collab_app_draft_102047_u48b2698f03c6'), { kind: 'user', projectId: '102047', hex12: '48b2698f03c6' });
  assert.deepEqual(draftDatabaseOwner('collab_app_draft_team_102056'), { kind: 'team', projectId: '102056' });
  assert.equal(draftDatabaseOwner('collab_app_draft_foo'), null);
  assert.equal(draftDatabaseOwner('mdm'), null);
});

test('list marks active (folder or branch), busy, orphan and unknown', () => {
  const rows = listDraftDatabases({ dataRoot: dataRoot(), psql: fakePsql() });
  const status = Object.fromEntries(rows.map((row) => [row.name, row.status]));
  assert.deepEqual(status, {
    collab_app_draft_102047_u48b2698f03c6: 'active',
    collab_app_draft_102047_u679068f3c1ff: 'active',
    collab_app_draft_team_102047: 'orphan',
    collab_app_draft_102047_u44dd34ecef2b: 'busy',
    collab_app_draft_102056_u48b2698f03c6: 'orphan',
    collab_app_draft_foo: 'unknown',
  });
  assert.match(rows[0].reason, /^folder /u);
  assert.match(rows[1].reason, /^branch user\/679068f3c1ffacd0/u);
});

test('prune --dry-run says what it would drop and drops nothing; prune drops only the orphans', () => {
  const data = dataRoot();
  const drops = [];
  const dry = pruneDraftDatabases({ dataRoot: data, psql: fakePsql(drops), dryRun: true });
  assert.deepEqual(drops, []);
  assert.deepEqual(dry.filter((line) => line.startsWith('would drop')), [
    'would drop collab_app_draft_team_102047 (14 MB)',
    'would drop collab_app_draft_102056_u48b2698f03c6 (12 MB)',
  ]);
  const real = pruneDraftDatabases({ dataRoot: data, psql: fakePsql(drops) });
  assert.deepEqual(drops, ['collab_app_draft_team_102047', 'collab_app_draft_102056_u48b2698f03c6']);
  assert.ok(real.includes('keep collab_app_draft_foo (unknown: name is not a draft database form)'));
  assert.ok(real.some((line) => line.startsWith('keep collab_app_draft_102047_u44dd34ecef2b (busy')));
});

test('--project limits the list and the prune to that project', () => {
  const drops = [];
  const lines = pruneDraftDatabases({ dataRoot: dataRoot(), psql: fakePsql(drops), projectId: '102056' });
  assert.deepEqual(drops, ['collab_app_draft_102056_u48b2698f03c6']);
  assert.equal(lines.some((line) => line.includes('102047')), false);
});
