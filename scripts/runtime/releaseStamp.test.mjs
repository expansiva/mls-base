import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectReleaseStamp,
  gitHead,
  readModelCommit,
  writeReleaseStamp,
} from './releaseStamp.mjs';

const PIN = { libs: '20260904142119', monaco: '20240313204233' };

function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'relstamp-'));
  try {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'x', collabLibs: PIN }, null, 2)}\n`);
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

    const releaseDir = join(root, 'releases', stamp.id);
    mkdirSync(releaseDir, { recursive: true });
    writeReleaseStamp(releaseDir, stamp);
    const sealed = JSON.parse(readFileSync(join(releaseDir, 'release.json'), 'utf8'));
    assert.equal(sealed.libs, PIN.libs);
    assert.equal(sealed.versionRef, head);
    assert.equal(sealed.modelCommit, 'abcdef1234567890');
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
    assert.equal(stamp.libs, PIN.libs);
    assert.equal(existsSync(join(root, 'release.json')), false);
  });
});
