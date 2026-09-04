import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSnapshot, sendSnapshot } from '../publishGitDeps.mjs';
import { armClonedDep, resetArmedDepsFromOrigin, resetFromOrigin, setupRepo } from './gitReposSetup.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV }).trim();
}

function makeCloneWithOrigin(root) {
  const upstream = join(root, 'upstream');
  mkdirSync(upstream, { recursive: true });
  git(upstream, 'init', '-q', '-b', 'main');
  writeFileSync(join(upstream, 'readme.md'), 'dep\n');
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-q', '-m', 'init');
  const dest = join(root, 'mls-100555');
  git(root, 'clone', '-q', '--depth', '1', upstream, dest);
  return dest;
}

function localConfig(dir, key) {
  try {
    return git(dir, 'config', '--local', '--get', key);
  } catch {
    return '';
  }
}

test('setupRepo recusa clone com remote e sem vm-baseline (skipped-external-remote)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-skip-'));
  try {
    const dest = makeCloneWithOrigin(root);
    assert.ok(git(dest, 'remote').split('\n').includes('origin'));
    let hasBaseline = true;
    try {
      git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
    } catch {
      hasBaseline = false;
    }
    assert.equal(hasBaseline, false);

    const result = setupRepo(dest);
    assert.equal(result.status, 'skipped-external-remote');
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), '');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'guard não mexe no remote');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('armClonedDep mantém origin e liga as chaves de receive do retrato', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-arm-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const result = armClonedDep(dest);
    assert.notEqual(result.status, 'skipped-external-remote', result.status);
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'origin fica — a VM puxa do GitHub');
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), 'true');
    assert.equal(localConfig(dest, 'receive.denyCurrentBranch'), 'updateInstead');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/main');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resetFromOrigin recusa checkout de desenvolvedor (origin sem vm-baseline)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-skip-reset-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'skipped-no-vm-baseline');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'dep\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fetch+reset traz o GitHub por cima de um retrato local, sem merge', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-reset-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const upstream = join(root, 'upstream');
    armClonedDep(dest);

    writeFileSync(join(dest, 'readme.md'), 'retrato local\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'retrato');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'retrato local\n');

    writeFileSync(join(upstream, 'readme.md'), 'github v2\n');
    git(upstream, 'add', '-A');
    git(upstream, 'commit', '-q', '-m', 'v2');

    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'reset', result.status);
    assert.equal(result.branch, 'main');
    assert.equal(result.head, result.originHead);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'github v2\n');
    const merges = git(dest, 'log', '--merges', '--oneline');
    assert.equal(merges, '', 'substitui, não mescla');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('depois do fetch+reset o retrato continua sobrescrevendo (updateInstead)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-snap-after-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const upstream = join(root, 'upstream');
    armClonedDep(dest);
    rmSync(join(dest, '.git', 'hooks', 'post-receive'), { force: true });

    writeFileSync(join(upstream, 'readme.md'), 'github v2\n');
    git(upstream, 'add', '-A');
    git(upstream, 'commit', '-q', '-m', 'v2');
    assert.equal(resetFromOrigin(dest).status, 'reset');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'github v2\n');

    const mac = join(root, 'mac');
    git(root, 'clone', '-q', dest, mac);
    writeFileSync(join(mac, 'readme.md'), 'retrato do mac\n');
    git(mac, 'remote', 'add', 'vm', dest);

    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, stdout: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }), out: '' };
      } catch (error) {
        return { code: error.status ?? 1, stdout: '', out: String(error.stderr ?? error.message) };
      }
    };
    const plan = planSnapshot({
      repo: mac, remote: 'vm', url: dest, env: GIT_ENV, gitSync, ensureRemote: () => {},
    });
    assert.equal(plan.status, 'changed', plan.reason);
    const sent = sendSnapshot({ plan, remote: 'vm', env: GIT_ENV, gitSync });
    assert.equal(sent.status, 'pushed', sent.reason);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'retrato do mac\n');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'origin sobrevive ao retrato');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resetArmedDepsFromOrigin só mexe em quem tem origin e vm-baseline', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-walk-'));
  try {
    const armed = makeCloneWithOrigin(root);
    armClonedDep(armed);
    const developer = join(root, 'mls-100554');
    git(root, 'clone', '-q', '--depth', '1', join(root, 'upstream'), developer);
    const noOrigin = join(root, 'mls-102033');
    mkdirSync(noOrigin, { recursive: true });
    git(noOrigin, 'init', '-q', '-b', 'main');
    writeFileSync(join(noOrigin, 'readme.md'), 'local\n');
    git(noOrigin, 'add', '-A');
    git(noOrigin, 'commit', '-q', '-m', 'init');

    const rows = resetArmedDepsFromOrigin(root);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.status]));
    assert.equal(byName['mls-100555'], 'reset');
    assert.equal(byName['mls-100554'], 'skipped-no-vm-baseline');
    assert.equal(byName['mls-102033'], 'skipped-no-origin');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
