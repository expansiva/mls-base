import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MLS_BASE_REPO,
  ensureMlsBaseCheckout,
  inspectCheckout,
  normalizeRepoUrl,
  parseArgs,
} from './ensureMlsBaseCheckout.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STEP10 = resolve(HERE, '..', '..', '..', 'collab-runtime', 'scripts', '10-mls-runtime.sh');

function git(dir, args, extra = {}) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', ...extra });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function gitCommit(dir, message) {
  const committed = spawnSync(
    'git',
    ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message],
    { encoding: 'utf8' },
  );
  assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
}

function makeOrigin() {
  const origin = mkdtempSync(join(tmpdir(), 'gb73-origin-'));
  writeFileSync(join(origin, 'package.json'), `${JSON.stringify({ name: 'mls-base-origin' }, null, 2)}\n`);
  writeFileSync(join(origin, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');
  writeFileSync(
    join(origin, '.gitignore'),
    ['releases', 'current', 'current-*', 'pm2.apps.d', 'node_modules', '.env', '/config.json', 'mls-*', 'logs'].join('\n') + '\n',
  );
  writeFileSync(join(origin, 'index.md'), '# origin\n');
  git(origin, ['init', '-q', '-b', 'main']);
  git(origin, ['add', 'package.json', 'tsconfig.json', '.gitignore', 'index.md']);
  gitCommit(origin, 'origin main');
  return origin;
}

function makeCopy() {
  const copy = mkdtempSync(join(tmpdir(), 'gb73-copy-'));
  writeFileSync(join(copy, 'package.json'), `${JSON.stringify({ name: 'mls-base-tarball' }, null, 2)}\n`);
  writeFileSync(join(copy, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');
  mkdirSync(join(copy, 'releases', '20260904100000'), { recursive: true });
  writeFileSync(join(copy, 'releases', '20260904100000', 'keep.txt'), 'release-state\n');
  writeFileSync(join(copy, '.env'), 'APP_ENV=production\n');
  writeFileSync(join(copy, 'config.json'), '{ "defaultProjectId": "102043" }\n');
  mkdirSync(join(copy, 'mls-102043'), { recursive: true });
  writeFileSync(join(copy, 'mls-102043', 'keep.txt'), 'project-state\n');
  mkdirSync(join(copy, 'pm2.apps.d'), { recursive: true });
  writeFileSync(join(copy, 'pm2.apps.d', 'app2043.config.js'), 'module.exports = [];\n');
  writeFileSync(join(copy, 'current-102043'), 'alias-placeholder\n');
  // Nested project repo: conversion of the parent must not touch it.
  git(join(copy, 'mls-102043'), ['init', '-q', '-b', 'main']);
  git(join(copy, 'mls-102043'), ['add', 'keep.txt']);
  gitCommit(join(copy, 'mls-102043'), 'project');
  return copy;
}

function withPair(fn) {
  const origin = makeOrigin();
  const copy = makeCopy();
  try {
    return fn({ origin, copy, originHead: git(origin, ['rev-parse', 'HEAD']).out });
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(copy, { recursive: true, force: true });
  }
}

test('normalizeRepoUrl trata .git e barra final como o mesmo origin', () => {
  assert.equal(
    normalizeRepoUrl('https://github.com/expansiva/mls-base.git/'),
    'https://github.com/expansiva/mls-base',
  );
  assert.equal(normalizeRepoUrl(DEFAULT_MLS_BASE_REPO), 'https://github.com/expansiva/mls-base');
});

test('parseArgs lê --root/--repo e as variáveis do passo 10', () => {
  const fromFlags = parseArgs(['--root', '/tmp/a', '--repo', 'https://example/repo.git'], { root: 'x', repo: 'y' });
  assert.equal(fromFlags.ok, true);
  assert.equal(fromFlags.root, '/tmp/a');
  assert.equal(fromFlags.repo, 'https://example/repo.git');
  const fromDefaults = parseArgs([], { root: '/tmp/b', repo: 'https://example/b' });
  assert.equal(fromDefaults.root, '/tmp/b');
});

test('passo 10 e este script usam o mesmo default de MLS_BASE_REPO', () => {
  const step10 = readFileSync(STEP10, 'utf8');
  assert.match(step10, /MLS_BASE_REPO="\$\{MLS_BASE_REPO:-https:\/\/github\.com\/expansiva\/mls-base\}"/);
  assert.match(step10, /MLS_BASE_DIR="\$\{MLS_BASE_DIR:-\/data\/mls-base\}"/);
  const src = readFileSync(join(HERE, 'ensureMlsBaseCheckout.mjs'), 'utf8');
  assert.match(src, /DEFAULT_MLS_BASE_REPO = 'https:\/\/github\.com\/expansiva\/mls-base'/);
  assert.match(src, /DEFAULT_MLS_BASE_DIR = '\/data\/mls-base'/);
});

test('converte uma cópia em checkout, preserva estado ignorado e é idempotente', () => {
  withPair(({ origin, copy, originHead }) => {
    assert.equal(inspectCheckout(copy).kind, 'copy');

    const first = ensureMlsBaseCheckout({ root: copy, repo: origin });
    assert.equal(first.status, 'converted');
    assert.equal(first.head, originHead);
    assert.equal(git(copy, ['rev-parse', '--abbrev-ref', 'HEAD']).out, 'main');
    assert.equal(git(copy, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).out, 'origin/main');
    assert.equal(readFileSync(join(copy, 'package.json'), 'utf8').includes('mls-base-origin'), true);
    assert.equal(existsSync(join(copy, 'index.md')), true);
    assert.equal(readFileSync(join(copy, 'releases', '20260904100000', 'keep.txt'), 'utf8'), 'release-state\n');
    assert.equal(readFileSync(join(copy, '.env'), 'utf8'), 'APP_ENV=production\n');
    assert.equal(readFileSync(join(copy, 'config.json'), 'utf8'), '{ "defaultProjectId": "102043" }\n');
    assert.equal(readFileSync(join(copy, 'mls-102043', 'keep.txt'), 'utf8'), 'project-state\n');
    assert.equal(existsSync(join(copy, 'mls-102043', '.git')), true);
    assert.equal(existsSync(join(copy, 'pm2.apps.d', 'app2043.config.js')), true);
    assert.equal(readFileSync(join(copy, 'current-102043'), 'utf8'), 'alias-placeholder\n');

    const second = ensureMlsBaseCheckout({ root: copy, repo: origin });
    assert.equal(second.status, 'already');
    assert.equal(second.head, originHead);
    assert.equal(readFileSync(join(copy, 'releases', '20260904100000', 'keep.txt'), 'utf8'), 'release-state\n');
    assert.equal(git(copy, ['rev-parse', 'HEAD']).out, originHead);
  });
});

test('um init a meio caminho completa no segundo run e não apaga ignorados', () => {
  withPair(({ origin, copy, originHead }) => {
    git(copy, ['init', '-q', '-b', 'main']);
    assert.equal(inspectCheckout(copy).kind, 'incomplete');
    const result = ensureMlsBaseCheckout({ root: copy, repo: origin });
    assert.equal(result.status, 'converted');
    assert.equal(result.head, originHead);
    assert.equal(readFileSync(join(copy, '.env'), 'utf8'), 'APP_ENV=production\n');
  });
});
