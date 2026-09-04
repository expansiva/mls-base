import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedDirtyPaths } from './gitPostReceive.mjs';
import { collectReleaseStamp, writeReleaseStamp } from './releaseStamp.mjs';
import { APPS_DIR, PM2_CONFIG, ensureProjectApp } from './vmApps.mjs';
import {
  VM_TSCONFIG,
  discoverProjects,
  updateTsconfigPaths,
  vmTsconfigRel,
  writeVmTsconfig,
} from './addNewVersion.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MLS_BASE = resolve(HERE, '..', '..');

const SAMPLE_TSCONFIG = `{
    "compilerOptions": {
        "strict": true,
        "paths": {
            "/_100554_/*": ["./mls-100554/*"], // collab_workspace
            "/_102033_/*": ["./mls-102033/*"], // collabMasterFrontendAuraClient
            "/_102034_/*": ["./mls-102034/*"], // collabMasterBackendForgeClient
            "/_102043_/*": ["./mls-102043/*"]
        }
    },
    "include": ["**/l1/**/*", "**/l2/**/*"]
}
`;

function pathIds(text) {
  return [...String(text).matchAll(/"\/_(\d+)_\/\*"/g)].map((m) => m[1]);
}

function git(dir, args, extra = {}) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', ...extra });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function withGitRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'gb63-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), SAMPLE_TSCONFIG);
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'mls-base-fixture' }, null, 2)}\n`);
    writeFileSync(join(root, '.gitignore'), `${VM_TSCONFIG}\n`);
    mkdirSync(join(root, 'mls-102033'));
    mkdirSync(join(root, 'mls-102034'));
    mkdirSync(join(root, 'mls-102043'));
    git(root, ['init', '-q']);
    git(root, ['add', 'tsconfig.json', 'package.json', '.gitignore']);
    const committed = spawnSync(
      'git',
      ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('writeVmTsconfig poda paths para os mls-* do disco e não toca o tsconfig.json versionado', () => {
  withGitRoot((root) => {
    const before = readFileSync(join(root, 'tsconfig.json'), 'utf8');
    const ids = writeVmTsconfig(root);
    assert.deepEqual(ids, ['102033', '102034', '102043']);
    assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), before);
    const vm = readFileSync(join(root, VM_TSCONFIG), 'utf8');
    assert.deepEqual(pathIds(vm), ['102033', '102034', '102043']);
    assert.doesNotMatch(vm, /100554/);
    assert.match(vm, /\/\/ collabMasterFrontendAuraClient/);
    assert.match(vm, /\/\/ collabMasterBackendForgeClient/);
    assert.doesNotMatch(vm, /collab_workspace/);
  });
});

test('release worktree: nenhum arquivo rastreado do mls-base fica sujo (gb73 E2)', () => {
  withGitRoot((root) => {
    writeFileSync(join(root, '.gitignore'), readFileSync(join(MLS_BASE, '.gitignore'), 'utf8'));
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'mls-base-fixture', collabLibs: { libs: '20260904142119', monaco: '20240313204233' } }, null, 2)}\n`,
    );
    git(root, ['add', '.gitignore', 'package.json']);
    const committed = spawnSync(
      'git',
      ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'ignore'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
    const packageBefore = readFileSync(join(root, 'package.json'), 'utf8');
    const tsconfigBefore = readFileSync(join(root, 'tsconfig.json'), 'utf8');

    writeVmTsconfig(root);
    writeFileSync(join(root, 'config.json'), '{ "defaultProjectId": "102043" }\n');
    mkdirSync(join(root, 'dist', 'local'), { recursive: true });
    writeFileSync(join(root, 'dist', 'local', 'keep.txt'), 'compiled\n');
    const stamp = collectReleaseStamp({ root, releaseId: '20260904153000', clientId: '102043' });
    const releaseDir = join(root, 'releases', stamp.id);
    mkdirSync(releaseDir, { recursive: true });
    writeReleaseStamp(releaseDir, stamp);
    symlinkSync(releaseDir, join(root, 'current'));
    symlinkSync(releaseDir, join(root, 'current-102043'));
    mkdirSync(join(root, 'logs'), { recursive: true });
    writeFileSync(join(root, 'logs', 'git-push.jsonl'), '{}\n');
    mkdirSync(join(root, 'mls-102043', 'obj'), { recursive: true });
    writeFileSync(join(root, 'mls-102043', 'obj', 'compiled.zip'), 'zip');
    ensureProjectApp({ root, projectId: '102043' });

    const porcelain = git(root, ['status', '--porcelain']).out;
    assert.deepEqual(trackedDirtyPaths(porcelain), [], `tracked dirty: ${porcelain}`);
    assert.equal(git(root, ['diff', '--name-only']).out, '');
    assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), packageBefore);
    assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), tsconfigBefore);
    assert.equal(existsSync(join(root, VM_TSCONFIG)), true);
    assert.equal(existsSync(join(root, 'releases', stamp.id, 'release.json')), true);
    assert.equal(existsSync(join(root, 'current')), true);
    assert.equal(existsSync(join(root, 'current-102043')), true);
    assert.equal(existsSync(join(root, APPS_DIR, 'app2043.config.js')), true);
    assert.equal(existsSync(join(root, PM2_CONFIG)), true);
    assert.equal(vmTsconfigRel(root), `./${VM_TSCONFIG}`);

    const addSrc = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
    assert.match(addSrc, /join\(ROOT, 'releases'\)/);
    assert.match(addSrc, /join\(ROOT, 'current'\)/);
    assert.match(addSrc, /join\(ROOT, releaseAlias\)/);
    assert.match(addSrc, /join\(ROOT, 'logs'\)/);
    assert.match(addSrc, /join\(ROOT, 'config\.json'\)/);
    const objSrc = readFileSync(join(HERE, 'buildProjectsObj.mjs'), 'utf8');
    assert.match(objSrc, /join\(ROOT, `mls-\$\{id\}`, 'obj'\)/);
    const hookSrc = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
    assert.match(hookSrc, /join\(root, 'logs'\)/);
  });
});

test('.gitignore da raiz ignora current-* e pm2.apps.d (gb73 E5)', () => {
  const ignore = readFileSync(join(MLS_BASE, '.gitignore'), 'utf8');
  assert.match(ignore, /^current-\*$/m);
  assert.match(ignore, /^pm2\.apps\.d$/m);
});

test('discoverProjects ignora mls-*-temp e arquivos', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb63-disc-'));
  try {
    mkdirSync(join(root, 'mls-102033'));
    mkdirSync(join(root, 'mls-102043-temp'));
    writeFileSync(join(root, 'mls-102099'), 'not a dir');
    assert.deepEqual(discoverProjects(root), ['102033']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('updateTsconfigPaths recusa tsconfig sem bloco paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb63-nopath-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');
    assert.throws(
      () => updateTsconfigPaths(root, ['102043']),
      /Could not find a "paths" block in tsconfig\.json/,
    );
    assert.equal(existsSync(join(root, VM_TSCONFIG)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('tsconfig.vm.json está no .gitignore e o compile da VM aponta para ele', () => {
  const ignore = readFileSync(join(MLS_BASE, '.gitignore'), 'utf8');
  assert.match(ignore, /^tsconfig\.vm\.json$/m);
  const addSrc = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  assert.match(addSrc, /VM_TSCONFIG = 'tsconfig\.vm\.json'/);
  assert.match(addSrc, /writeFileSync\(dest,/);
  const buildSrc = readFileSync(join(HERE, '..', 'build.mjs'), 'utf8');
  assert.match(buildSrc, /function baseTsconfigRel/);
  assert.match(buildSrc, /tsconfig\.vm\.json/);
  const createSrc = readFileSync(join(HERE, '..', 'buildCI', 'createTsconfig.mjs'), 'utf8');
  assert.match(createSrc, /tsconfig\.json raiz do mls-base nunca é tocado/);
});
