import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseCli } from './lima.mjs';
import { vmBenchScript } from './prepareBench.mjs';
import { planLocalSources, prepareSources, publishCommand } from './prepareSources.mjs';
import { assertProjectId, isProjectApp, projectMlsBase, projectRuntimeRoot, projectTreeMode } from './session.mjs';

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'bench',
  GIT_AUTHOR_EMAIL: 'bench@collab.local',
  GIT_COMMITTER_NAME: 'bench',
  GIT_COMMITTER_EMAIL: 'bench@collab.local',
  LIMA_PROJECT_TREE: '',
};

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { env: gitEnv, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

test('project tree paths stay on /data/mls-base unless the mode is set', () => {
  const oldEnv = { LIMA_PROJECT_TREE: '' };
  const newEnv = { LIMA_PROJECT_TREE: '1' };
  assert.equal(projectTreeMode(oldEnv), false);
  assert.equal(projectTreeMode({ LIMA_PROJECT_TREE: 'project' }), true);
  for (const id of ['102047', '102056']) {
    assert.equal(projectMlsBase(id, oldEnv), '/data/mls-base');
    assert.equal(projectRuntimeRoot(id, oldEnv), `/data/mls-base/current-${id}`);
    assert.equal(vmBenchScript(id, oldEnv), '/data/mls-base/tools/lima/prepareBench.mjs');
    assert.equal(projectMlsBase(id, newEnv), `/data/app${id}/mls-base`);
    assert.equal(projectRuntimeRoot(id, newEnv), `/data/app${id}/mls-base/current`);
    assert.equal(vmBenchScript(id, newEnv), `/data/app${id}/mls-base/tools/lima/prepareBench.mjs`);
  }
  assert.equal(parseCli(['prepare', '102056', '--session', 'a', '--tree', 'project']).tree, 'project');
  assert.equal(parseCli(['prepare', '102047', '--session', 'a']).tree, '');
});

/** A source repo `mls-<id>` in the mls-base root; `appConfig` is its l5/config.json (an app has projects[<id>]). */
function sourceRepo(root, id, appConfig) {
  const dir = join(root, `mls-${id}`);
  mkdirSync(join(dir, 'l5'), { recursive: true });
  git(dir, ['init', '-b', 'main']);
  writeFileSync(join(dir, 'l5', 'config.json'), `${JSON.stringify(appConfig)}\n`);
  git(dir, ['add', 'l5/config.json']);
  git(dir, ['commit', '-m', 'seed']);
  return dir;
}

function sharedRoot() {
  const root = mkdtempSync(join(tmpdir(), 'lima-tree-'));
  git(root, ['init', '-b', 'main']);
  writeFileSync(join(root, '.gitignore'), 'mls-*\n');
  writeFileSync(join(root, 'package.json'), '{"name":"mls-base"}\n');
  git(root, ['add', '.gitignore', 'package.json']);
  git(root, ['commit', '-m', 'platform']);
  return root;
}

const pin = { libs: '20261030005710', monaco: '20240313204233', source: 'given' };

test('a dependency that is itself a project app is refused on the shared tree and accepted on the project tree', async () => {
  const root = sharedRoot();
  try {
    sourceRepo(root, '102047', { projects: { 102047: {} }, workspaceDependencies: ['102056'] });
    sourceRepo(root, '102056', { projects: { 102056: {} } });
    await assert.rejects(
      () => planLocalSources(root, '102047', gitEnv, { pin }),
      (error) => error.message === 'refusing project 102056: it is an app, not a dependency' && error.code === 'project',
    );
    const planned = await planLocalSources(root, '102047', { ...gitEnv, LIMA_PROJECT_TREE: '1' }, { pin });
    assert.equal(planned.projectId, '102047');
    const second = await planLocalSources(root, '102056', { ...gitEnv, LIMA_PROJECT_TREE: '1' }, { pin });
    assert.equal(second.projectId, '102056');
    assert.equal(second.blocked.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('any app is a project, whichever its id; a library is a dependency and is never refused', async () => {
  const root = sharedRoot();
  try {
    sourceRepo(root, '102043', { projects: { 102043: {} }, workspaceDependencies: ['102034', '102099'] });
    sourceRepo(root, '102034', { note: 'a library: no projects[<id>]' });
    const planned = await planLocalSources(root, '102043', gitEnv, { pin });
    assert.equal(planned.projectId, '102043');
    assert.deepEqual(planned.deps.map((dep) => dep.id), ['102034']);
    sourceRepo(root, '102099', { projects: { 102099: {} } });
    await assert.rejects(
      () => planLocalSources(root, '102043', gitEnv, { pin }),
      (error) => error.message === 'refusing project 102099: it is an app, not a dependency',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the project is required: a missing id, a library and an id with no repo are refused by the plan and the prepare', async () => {
  const root = sharedRoot();
  try {
    sourceRepo(root, '102034', { note: 'a library' });
    for (const id of [undefined, '', '102034', '109999', 102034]) {
      await assert.rejects(
        () => planLocalSources(root, id, gitEnv, { pin }),
        (error) => error.code === 'project' && error.sent === false && /is not a project app/.test(error.message),
      );
    }
    assert.throws(() => publishCommand(root, undefined), (error) => error.code === 'project');
    const refused = await prepareSources({ root, projectId: undefined, profile: {}, session: 's', env: gitEnv });
    assert.deepEqual(refused, { ok: false, ready: false, phase: 'preparing', code: 'project', sent: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isProjectApp reads projects[<id>] of the repo l5/config.json and nothing else', () => {
  const root = sharedRoot();
  try {
    sourceRepo(root, '102047', { projects: { 102047: {} } });
    sourceRepo(root, '102034', { projects: { 100000: {} } });
    mkdirSync(join(root, 'mls-102050', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102050', 'l5', 'config.json'), '{ not json');
    assert.equal(isProjectApp(root, '102047'), true);
    assert.equal(isProjectApp(root, '102034'), false);
    assert.equal(isProjectApp(root, '102050'), false);
    assert.equal(isProjectApp(root, '12345'), false);
    assert.equal(isProjectApp(root, ''), false);
    assert.throws(() => assertProjectId('102034', root), /102034 is not a project app/);
    assert.equal(assertProjectId('102047', root), '102047');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--no-alpha belongs to prepare, is in the usage and is off by default', async () => {
  const { usage } = await import('./lima.mjs');
  assert.equal(parseCli(['prepare', '102047', '--session', 'a', '--no-alpha']).noAlpha, true);
  assert.equal(parseCli(['prepare', '102047', '--session', 'a']).noAlpha, false);
  assert.match(usage(), /\[--no-alpha\]/);
  for (const argv of [['begin', '102047', '--session', 'a', '--no-alpha'], ['status', '--no-alpha'], ['end', '--session', 'a', '--no-alpha']]) {
    assert.throws(() => parseCli(argv), (error) => error.code === 'usage' && error.exitCode === 2 && /--no-alpha belongs to prepare/.test(error.message));
  }
});
