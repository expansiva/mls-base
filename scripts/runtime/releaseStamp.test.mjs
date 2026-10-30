import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectReleaseStamp,
  gitHead,
  readDepTrees,
  readModelCommit,
  writeReleaseStamp,
} from './releaseStamp.mjs';

const PIN = { libs: '20261030005710', monaco: '20240313204233' };

function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'relstamp-'));
  try {
    // The release records the INSTALLED version (the stamp the install writes, ignored by git), never a repo file.
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'x' }, null, 2)}\n`);
    mkdirSync(join(root, 'types'), { recursive: true });
    writeFileSync(join(root, 'types', '.libs-pin'), `${PIN.libs}:${PIN.monaco}\n`);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

test('collectReleaseStamp grava libs do pin, versionRef do cliente e o commit do modelo', () => {
  withRoot((root) => {
    const client = join(root, 'mls-102043');
    mkdirSync(join(client, 'l5'), { recursive: true });
    writeFileSync(join(client, 'l5', 'config.json'), '{}\n');
    git(client, ['init', '-q']);
    git(client, ['add', '-A']);
    const committed = spawnSync(
      'git',
      ['-C', client, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
    const head = git(client, ['rev-parse', 'HEAD']).out;
    writeFileSync(
      join(client, '.collab-git'),
      `git-managed project (mls-102043)\nmodel-commit: abcdef1234567890\n`,
    );

    const stamp = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '102043' });
    assert.equal(stamp.id, '20260904153000');
    assert.equal(stamp.libs, PIN.libs);
    assert.equal(stamp.monaco, PIN.monaco);
    assert.equal(stamp.client, '102043');
    assert.equal(stamp.versionRef, head);
    assert.equal(stamp.modelCommit, 'abcdef1234567890');
    assert.equal(stamp.platformCommit, 'unknown');

    const releaseDir = join(root, 'releases', stamp.id);
    mkdirSync(releaseDir, { recursive: true });
    writeReleaseStamp(releaseDir, stamp);
    const sealed = JSON.parse(readFileSync(join(releaseDir, 'release.json'), 'utf8'));
    assert.equal(sealed.libs, PIN.libs);
    assert.equal(sealed.versionRef, head);
    assert.equal(sealed.modelCommit, 'abcdef1234567890');
    assert.equal(sealed.platformCommit, 'unknown');
  });
});

test('readModelCommit e gitHead são vazios quando não há repo nem marcador', () => {
  withRoot((root) => {
    assert.equal(gitHead(join(root, 'missing')), '');
    assert.equal(readModelCommit(join(root, 'missing')), '');
    const stamp = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '' });
    assert.equal(stamp.client, null);
    assert.equal(stamp.versionRef, null);
    assert.equal(stamp.modelCommit, null);
    assert.equal(stamp.platformCommit, 'unknown');
    assert.equal(stamp.libs, PIN.libs);
    assert.equal(existsSync(join(root, 'release.json')), false);
  });
});

test('collectReleaseStamp grava o HEAD do mls-base em platformCommit', () => {
  withRoot((root) => {
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['add', 'package.json']);
    const committed = spawnSync(
      'git',
      ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
    const head = git(root, ['rev-parse', 'HEAD']).out;
    const stamp = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '' });
    assert.equal(stamp.platformCommit, head);
  });
});

test('collectReleaseStamp grava a árvore de cada dependência declarada', () => {
  withRoot((root) => {
    const client = join(root, 'mls-102043');
    mkdirSync(join(client, 'l5'), { recursive: true });
    writeFileSync(join(client, 'l5', 'config.json'), `${JSON.stringify({ workspaceDependencies: ['102034', '102033', '102099'] })}\n`);
    const trees = {};
    for (const id of ['102034', '102033']) {
      const dep = join(root, `mls-${id}`);
      mkdirSync(dep, { recursive: true });
      writeFileSync(join(dep, 'README'), `${id}\n`);
      git(dep, ['init', '-q']);
      git(dep, ['add', '-A']);
      const committed = spawnSync(
        'git',
        ['-C', dep, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'],
        { encoding: 'utf8' },
      );
      assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
      trees[id] = git(dep, ['rev-parse', 'HEAD^{tree}']).out;
    }
    assert.deepEqual(readDepTrees(root, '102043'), trees);
    const stamp = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '102043' });
    assert.deepEqual(stamp.deps, trees);
    const early = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '102043', deps: { 102034: 'before' } });
    assert.deepEqual(early.deps, { 102034: 'before' });
    assert.deepEqual(collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '' }).deps, {});
  });
});

test('sem o carimbo da instalação a release grava libs=unknown e avisa; a source entra quando vem', () => {
  withRoot((root) => {
    rmSync(join(root, 'types', '.libs-pin'));
    const written = [];
    const original = process.stderr.write;
    process.stderr.write = (text) => { written.push(String(text)); return true; };
    let stamp;
    try {
      stamp = collectReleaseStamp({ root, releaseId: '20261030010000', clientId: '', source: 'latest' });
    } finally {
      process.stderr.write = original;
    }
    assert.equal(stamp.libs, 'unknown');
    assert.equal(stamp.monaco, 'unknown');
    assert.equal(stamp.source, 'latest');
    assert.match(written.join(''), /installed libs stamp is missing/);
  });
});
