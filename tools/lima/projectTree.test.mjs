import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseCli } from './lima.mjs';
import { vmBenchScript } from './prepareBench.mjs';
import { planLocalSources } from './prepareSources.mjs';
import { projectMlsBase, projectRuntimeRoot, projectTreeMode } from './session.mjs';

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

test('prepare of 102056 is refused on the old tree and accepted on the project tree', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lima-tree-'));
  try {
    git(root, ['init', '-b', 'main']);
    writeFileSync(join(root, '.gitignore'), 'mls-*\n');
    writeFileSync(join(root, 'package.json'), '{"name":"mls-base"}\n');
    git(root, ['add', '.gitignore', 'package.json']);
    git(root, ['commit', '-m', 'platform']);
    const app = join(root, 'mls-102047');
    mkdirSync(join(app, 'l5'), { recursive: true });
    git(app, ['init', '-b', 'main']);
    writeFileSync(join(app, 'l5', 'config.json'), `${JSON.stringify({ workspaceDependencies: ['102056'] })}\n`);
    git(app, ['add', 'l5/config.json']);
    git(app, ['commit', '-m', 'app']);
    const pin = { libs: '20261030005710', monaco: '20240313204233', source: 'given' };
    await assert.rejects(
      () => planLocalSources(root, '102047', gitEnv, { pin }),
      (error) => error.message === 'refusing project 102056',
    );
    const planned = await planLocalSources(root, '102047', { ...gitEnv, LIMA_PROJECT_TREE: '1' }, { pin });
    assert.equal(planned.projectId, '102047');
    const own = join(root, 'mls-102056');
    mkdirSync(own, { recursive: true });
    git(own, ['init', '-b', 'main']);
    writeFileSync(join(own, 'README'), 'app\n');
    git(own, ['add', 'README']);
    git(own, ['commit', '-m', 'app']);
    const second = await planLocalSources(root, '102056', { ...gitEnv, LIMA_PROJECT_TREE: '1' }, { pin });
    assert.equal(second.projectId, '102056');
    assert.equal(second.blocked.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
