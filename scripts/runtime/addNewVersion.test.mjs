import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedDirtyPaths } from './gitPostReceive.mjs';
import { collectReleaseStamp, writeReleaseStamp } from './releaseStamp.mjs';
import { writeZipStamp } from './zipSourceTree.mjs';
import { APPS_DIR, PM2_CONFIG, databaseUrlTestFor, ensureProjectApp } from './vmApps.mjs';
import {
  VM_TSCONFIG,
  activateCurrent,
  compiledZipStaleReason,
  ensureFechoCompiledZips,
  assertFechoCompiledZips,
  discoverProjects,
  extrasOutsideFecho,
  fechoProjectIds,
  pm2ConfigRel,
  envForMigrate,
  parseReleaseAliases,
  releasesInUse,
  skipPm2,
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

test('writeVmTsconfig une disco + versionado e não toca o tsconfig.json', () => {
  withGitRoot((root) => {
    const before = readFileSync(join(root, 'tsconfig.json'), 'utf8');
    const ids = writeVmTsconfig(root);
    // 100554 is only in the versioned file (not on disk) and must survive.
    assert.deepEqual(ids, ['100554', '102033', '102034', '102043']);
    assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), before);
    const vm = readFileSync(join(root, VM_TSCONFIG), 'utf8');
    assert.deepEqual(pathIds(vm), ['100554', '102033', '102034', '102043']);
    assert.match(vm, /100554/);
    assert.match(vm, /\/\/ collabMasterFrontendAuraClient/);
    assert.match(vm, /\/\/ collabMasterBackendForgeClient/);
    assert.match(vm, /collab_workspace/);
  });
});

test('release worktree: nenhum arquivo rastreado do mls-base fica sujo (gb73 E2)', () => {
  withGitRoot((root) => {
    writeFileSync(join(root, '.gitignore'), readFileSync(join(MLS_BASE, '.gitignore'), 'utf8'));
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'mls-base-fixture' }, null, 2)}\n`,
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
    assert.match(addSrc, /join\((?:ROOT|root), 'current'\)/);
    assert.match(addSrc, /join\(ROOT, releaseAlias\)/);
    assert.match(addSrc, /join\(ROOT, 'logs'\)/);
    assert.match(addSrc, /join\(ROOT, 'config\.json'\)/);
    const objSrc = readFileSync(join(HERE, 'buildProjectsObj.mjs'), 'utf8');
    assert.match(objSrc, /join\(ROOT, `mls-\$\{id\}`, 'obj'\)/);
    const hookSrc = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
    assert.match(hookSrc, /join\(root, 'logs'\)/);
  });
});

test('árvore por projeto não cria current-<id> (COLLAB_RELEASE_ALIAS só na antiga)', () => {
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  assert.match(src, /isProjectTree\(ROOT\) \? \[\] : parseReleaseAliases/);
});

test('T3: COLLAB_RELEASE_ALIAS inválido continua recusado; vários current-<id> passam', () => {
  assert.throws(() => parseReleaseAliases('current'), /Invalid COLLAB_RELEASE_ALIAS: current/);
  assert.throws(() => parseReleaseAliases('foo'), /Invalid COLLAB_RELEASE_ALIAS: foo/);
  assert.throws(() => parseReleaseAliases('current-abc'), /Invalid COLLAB_RELEASE_ALIAS: current-abc/);
  assert.throws(
    () => parseReleaseAliases('current-102056,nope'),
    /Invalid COLLAB_RELEASE_ALIAS: nope/,
  );
  assert.deepEqual(parseReleaseAliases(''), []);
  assert.deepEqual(parseReleaseAliases('current-102056'), ['current-102056']);
  assert.deepEqual(
    parseReleaseAliases('current-102043, current-102056'),
    ['current-102043', 'current-102056'],
  );
});

test('--skip-pm2 é o que o hook passa para não se matar no reload (gb85)', () => {
  assert.equal(skipPm2(['--client', '102052', '--skip-pm2']), true);
  assert.equal(skipPm2(['--client', '102052']), false);
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  assert.match(src, /skipPm2\(argv\)/);
  assert.match(src, /pm2 reload skipped/);
});

test('pm2ConfigRel prefere o agregador na raiz', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb85-pm2-'));
  try {
    assert.equal(pm2ConfigRel(root), 'servers/pm2.config.js');
    writeFileSync(join(root, 'pm2.config.js'), 'module.exports = [];\n');
    assert.equal(pm2ConfigRel(root), 'pm2.config.js');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('.gitignore da raiz ignora current-* e pm2.apps.d (gb73 E5)', () => {
  const ignore = readFileSync(join(MLS_BASE, '.gitignore'), 'utf8');
  assert.match(ignore, /^current-\*$/m);
  assert.match(ignore, /^pm2\.apps\.d$/m);
});

test('sem compiled.zip de um projeto do fecho, current não muda e a mensagem lista o projeto', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb92-zip-'));
  try {
    const oldRel = join(root, 'releases', '20260101000000');
    const newRel = join(root, 'releases', '20260102000000');
    mkdirSync(oldRel, { recursive: true });
    mkdirSync(newRel, { recursive: true });
    symlinkSync(oldRel, join(root, 'current'));
    mkdirSync(join(root, 'mls-900001', 'obj'), { recursive: true });
    writeFileSync(join(root, 'mls-900001', 'obj', 'compiled.zip'), 'zip');
    mkdirSync(join(root, 'mls-900002'), { recursive: true });
    const before = readlinkSync(join(root, 'current'));
    assert.throws(
      () => activateCurrent(root, newRel, ['900001', '900002'], { build: () => {}, log: () => {} }),
      /release aborted: obj\/compiled\.zip missing for mls-900002/,
    );
    assert.equal(readlinkSync(join(root, 'current')), before);
    assert.equal(resolve(readlinkSync(join(root, 'current'))), resolve(oldRel));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('com zip de todo o fecho, activateCurrent troca o current', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb92-zip-ok-'));
  try {
    const oldRel = join(root, 'releases', '20260101000000');
    const newRel = join(root, 'releases', '20260102000000');
    mkdirSync(oldRel, { recursive: true });
    mkdirSync(newRel, { recursive: true });
    symlinkSync(oldRel, join(root, 'current'));
    for (const id of ['900001', '900002']) {
      mkdirSync(join(root, `mls-${id}`, 'obj'), { recursive: true });
      writeFileSync(join(root, `mls-${id}`, 'obj', 'compiled.zip'), 'zip');
    }
    activateCurrent(root, newRel, ['900001', '900002']);
    assert.equal(resolve(readlinkSync(join(root, 'current'))), resolve(newRel));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertFechoCompiledZips lista todos os zips ausentes', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb92-zip-list-'));
  try {
    mkdirSync(join(root, 'mls-900001'), { recursive: true });
    mkdirSync(join(root, 'mls-900002'), { recursive: true });
    assert.throws(
      () => assertFechoCompiledZips(root, ['900001', '900002']),
      /release aborted: obj\/compiled\.zip missing for mls-900001, mls-900002/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('activateCurrent corre antes do ln do alias (current não muda se o zip falta)', () => {
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  const guard = src.indexOf('activateCurrent(ROOT, releaseDir, fechoProjectIds(releaseConfig))');
  const currentLog = src.indexOf("console.log(`--- current -> releases/${releaseId}`)");
  const alias = src.indexOf("run(`ln -sfn '${releaseDir}' '${join(ROOT, releaseAlias)}'`)");
  assert.ok(guard > 0 && currentLog > guard && alias > currentLog);
});

test('CBE_BUILD_OBJS=false pula só quem está fora do fecho', () => {
  assert.deepEqual(
    extrasOutsideFecho(['900001', '900002', '100554', '100555'], ['900001', '900002']),
    ['100554', '100555'],
  );
  assert.deepEqual(fechoProjectIds({ projects: { 900001: { type: 'client' }, 900002: { type: 'lib' } } }), ['900001', '900002']);
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  assert.match(src, /extrasOutsideFecho\(ids, fechoProjectIds\(releaseConfig\)\)/);
  assert.match(src, /CBE_BUILD_OBJS !== 'false' && extras\.length > 0/);
  assert.doesNotMatch(src, /run\('node scripts\/runtime\/buildProjectsObj\.mjs'\)/);
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
      /Could not find a "paths" block in the versioned tsconfig/,
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

test('T4: releasesInUse protege os releases apontados por current e current-<id>', () => {
  const root = mkdtempSync(join(tmpdir(), 'addversion-inuse-'));
  try {
    const releases = join(root, 'releases');
    for (const name of ['20260101000000', '20260202000000', '20260303000000']) {
      mkdirSync(join(releases, name), { recursive: true });
    }
    symlinkSync(join(releases, '20260303000000'), join(root, 'current'));
    symlinkSync(join(releases, '20260101000000'), join(root, 'current-102046'));

    const inUse = releasesInUse(root);
    assert.deepEqual([...inUse].sort(), ['20260101000000', '20260303000000']);
    // O release que ninguém referencia continua livre para o prune.
    assert.equal(inUse.has('20260202000000'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('T5: releasesInUse ignora um current* que não é symlink (e não quebra)', () => {
  const root = mkdtempSync(join(tmpdir(), 'addversion-inuse-'));
  try {
    mkdirSync(join(root, 'releases'), { recursive: true });
    writeFileSync(join(root, 'current-notes.txt'), 'nao sou symlink');
    assert.deepEqual([...releasesInUse(root)], []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrate leva COLLAB_PROJECT_ID do --client e não leva sem --client', () => {
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  assert.match(src, /COLLAB_PROJECT_ID=\$\{clientId\} node '\$\{migrateJs\}'/);
  assert.match(src, /clientId && \/\^\\d\+\$\/\.test\(clientId\)/);
  assert.match(src, /--- migrate sem client: usa o modo da raiz da release/);
  const withClient = src.includes("run(`COLLAB_PROJECT_ID=${clientId} node '${migrateJs}'`, releaseDir, migrateEnv)");
  const withoutClient = src.includes("run(`node '${migrateJs}'`, releaseDir)");
  assert.equal(withClient, true);
  assert.equal(withoutClient, true);
  const cmdWith = `COLLAB_PROJECT_ID=102047 node '/tmp/migrate.js'`;
  const cmdWithout = `node '/tmp/migrate.js'`;
  assert.match(cmdWith, /COLLAB_PROJECT_ID=102047 /);
  assert.doesNotMatch(cmdWithout, /COLLAB_PROJECT_ID=/);
});

test('migrate recebe DATABASE_URL_TEST só no modo de teste', () => {
  const root = mkdtempSync(join(tmpdir(), 'addversion-dburl-'));
  try {
    writeFileSync(join(root, '.env'), 'PGUSER=migrate_user\nPGPASSWORD=migrate_secret\n');
    const projectDir = join(root, 'mls-102047', 'l5');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'project.json'), `${JSON.stringify({ appEnv: 'presentation' })}\n`);
    const url = databaseUrlTestFor(root);
    assert.match(url, /\/collab_app_test$/);
    assert.equal(envForMigrate(root, '102047')?.DATABASE_URL_TEST, url);

    writeFileSync(join(projectDir, 'project.json'), `${JSON.stringify({ appEnv: 'production' })}\n`);
    assert.equal(envForMigrate(root, '102047'), undefined);

    rmSync(join(projectDir, 'project.json'));
    assert.equal(envForMigrate(root, '102047'), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('T6: uma falha no pm2 só é lançada DEPOIS do refresh dos objs', () => {
  // O bug real (VM, app2046 órfão): o reload falhava, addNewVersion abortava e
  // o buildProjectsObj dos extras nunca rodava — nenhum versionRef se movia.
  const src = readFileSync(join(HERE, 'addNewVersion.mjs'), 'utf8');
  const pm2Catch = src.indexOf('pm2Error = error;');
  const objBuild = src.indexOf('buildProjectsObj.mjs --only');
  const rethrow = src.indexOf('if (pm2Error) throw pm2Error;');
  assert.ok(pm2Catch > 0 && objBuild > 0 && rethrow > 0);
  assert.ok(pm2Catch < objBuild, 'o erro do pm2 precisa ser capturado antes do obj build');
  assert.ok(objBuild < rethrow, 'o rethrow precisa vir depois do obj build');
});

function gitRepo(dir, commands) {
  mkdirSync(dir, { recursive: true });
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  for (const run of commands) run(git, dir);
  return git;
}

const commitAll = (message) => (git) => { git('add', '-A'); git('commit', '-q', '-m', message); };
const writeIn = (rel, text) => (_git, dir) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
};

test('compiledZipStaleReason: zip ausente, do commit certo, de outro commit e VM-gerado', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt172-s5-'));
  try {
    const repo = join(root, 'mls-900001');
    assert.equal(compiledZipStaleReason(root, '900001'), 'missing');
    const git = gitRepo(repo, [writeIn('l2/a.ts', 'a1'), writeIn('obj/compiled.zip', 'z1'), commitAll('source + zip')]);
    assert.equal(compiledZipStaleReason(root, '900001'), null, 'zip do commit em dia');
    // a commit that only touches obj/ keeps it current
    writeIn('obj/compiled.zip', 'z2')(git, repo);
    commitAll('Compile TypeScript files')(git);
    assert.equal(compiledZipStaleReason(root, '900001'), null);
    // a source commit after the zip commit: stale (this is the Action that did not run)
    writeIn('l2/a.ts', 'a2')(git, repo);
    commitAll('source only')(git);
    assert.match(compiledZipStaleReason(root, '900001'), /^sources changed since the zip commit [0-9a-f]{7}$/);
    // touching mtimes (what a git pull does) must not hide it
    const future = new Date(Date.now() + 60_000);
    utimesSync(join(repo, 'obj', 'compiled.zip'), future, future);
    assert.match(compiledZipStaleReason(root, '900001'), /^sources changed/);
    // a revert to the same tree is current again
    writeIn('l2/a.ts', 'a1')(git, repo);
    commitAll('revert')(git);
    assert.equal(compiledZipStaleReason(root, '900001'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compiledZipStaleReason: zip não rastreado ou regerado na VM compara com o commit do HEAD', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt172-s5b-'));
  try {
    const repo = join(root, 'mls-900002');
    const git = gitRepo(repo, [writeIn('l2/a.ts', 'a1'), commitAll('source')]);
    writeIn('obj/compiled.zip', 'z')(git, repo);
    const past = new Date(Date.now() - 3_600_000);
    utimesSync(join(repo, 'obj', 'compiled.zip'), past, past);
    assert.equal(compiledZipStaleReason(root, '900002'), 'zip is older than the HEAD commit');
    const now = new Date(Date.now() + 5_000);
    utimesSync(join(repo, 'obj', 'compiled.zip'), now, now);
    assert.equal(compiledZipStaleReason(root, '900002'), null);
    writeIn('l2/a.ts', 'dirty')(git, repo);
    assert.equal(compiledZipStaleReason(root, '900002'), 'sources have uncommitted changes');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureFechoCompiledZips gera só o que falta ou não corresponde, uma linha de log por projeto', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt172-s5c-'));
  try {
    gitRepo(join(root, 'mls-900001'), [writeIn('l2/a.ts', 'a'), writeIn('obj/compiled.zip', 'z'), commitAll('ok')]);
    mkdirSync(join(root, 'mls-900002', 'l2'), { recursive: true });
    const stale = gitRepo(join(root, 'mls-900003'), [writeIn('l2/a.ts', 'a'), writeIn('obj/compiled.zip', 'z'), commitAll('ok')]);
    writeIn('l2/a.ts', 'b')(stale, join(root, 'mls-900003'));
    commitAll('source only')(stale);
    const built = [];
    const logs = [];
    const result = ensureFechoCompiledZips(root, ['900001', '900002', '900003'], { build: (_root, ids) => built.push(ids), log: (line) => logs.push(line) });
    assert.deepEqual(built, [['900002', '900003']]);
    assert.deepEqual(result.map((entry) => entry.id), ['900002', '900003']);
    assert.equal(logs[0], 'generated obj mls-900002: missing');
    assert.match(logs[1], /^generated obj mls-900003: sources changed since the zip commit/);
    const none = ensureFechoCompiledZips(root, ['900001'], { build: () => assert.fail('não devia gerar'), log: () => {} });
    assert.deepEqual(none, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compiledZipStaleReason: zip que já foi rastreado, saiu da árvore do HEAD e foi regerado (ignorado) segue a regra do mtime', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt172-s5d-'));
  try {
    const repo = join(root, 'mls-900004');
    const git = gitRepo(repo, [writeIn('l2/a.ts', 'a1'), writeIn('obj/compiled.zip', 'z1'), commitAll('source + zip')]);
    // a snapshot commit of the lima: new sources, no obj/ in the tree
    writeIn('l2/a.ts', 'a2')(git, repo);
    writeIn('.gitignore', 'obj/\n')(git, repo);
    git('rm', '-q', '--cached', '-r', 'obj');
    commitAll('snapshot without obj')(git);
    const fresh = new Date(Date.now() + 5_000);
    utimesSync(join(repo, 'obj', 'compiled.zip'), fresh, fresh);
    assert.equal(compiledZipStaleReason(root, '900004'), null, 'zip regerado depois do commit está em dia');
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(join(repo, 'obj', 'compiled.zip'), old, old);
    assert.equal(compiledZipStaleReason(root, '900004'), 'zip is older than the HEAD commit');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// rt194: o zip regerado na VM compara a árvore das camadas, não a hora do commit.
function zipRepo(id) {
  const root = mkdtempSync(join(tmpdir(), 'rt194-'));
  const repo = join(root, `mls-${id}`);
  const git = gitRepo(repo, [writeIn('l2/a.ts', 'a1'), writeIn('README.md', 'r1'), commitAll('source')]);
  writeIn('obj/compiled.zip', 'zip-v1')(git, repo);
  // obj/ fica fora do git na VM (regerado localmente)
  writeIn('.git/info/exclude', 'obj/\n')(git, repo);
  return { root, repo, git, zip: join(repo, 'obj', 'compiled.zip') };
}

test('rt194: commit de snapshot sem mudar l1..l7 não deixa o zip velho; mudança em l2 deixa', () => {
  const { root, repo, git, zip } = zipRepo('900011');
  try {
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(zip, old, old);
    assert.equal(writeZipStamp(repo, zip), true);
    // snapshot local: commit novo (mais recente que o zip), mesmas camadas
    writeIn('README.md', 'r2')(git, repo);
    commitAll('snapshot')(git);
    assert.equal(compiledZipStaleReason(root, '900011'), null);
    // commit vazio também
    git('commit', '-q', '--allow-empty', '-m', 'empty');
    assert.equal(compiledZipStaleReason(root, '900011'), null);
    // mudança real numa camada
    writeIn('l2/a.ts', 'a2')(git, repo);
    commitAll('real change')(git);
    assert.equal(compiledZipStaleReason(root, '900011'), 'sources changed since the zip was built');
    // voltar à mesma árvore: em dia de novo
    writeIn('l2/a.ts', 'a1')(git, repo);
    commitAll('revert')(git);
    assert.equal(compiledZipStaleReason(root, '900011'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt194: zip sem carimbo usa a hora uma vez; depois de carimbado vale a árvore', () => {
  const { root, repo, git, zip } = zipRepo('900012');
  try {
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(zip, old, old);
    assert.equal(compiledZipStaleReason(root, '900012'), 'zip is older than the HEAD commit');
    // a reconstrução grava o carimbo (buildProjectsObj)
    assert.equal(writeZipStamp(repo, zip), true);
    assert.equal(compiledZipStaleReason(root, '900012'), null);
    // o carimbo é deste zip: outro zip no lugar (tamanho diferente) não herda o carimbo
    writeIn('obj/compiled.zip', 'another zip, other bytes')(git, repo);
    utimesSync(zip, old, old);
    assert.equal(compiledZipStaleReason(root, '900012'), 'zip is older than the HEAD commit');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt194: com mudança não commitada nas camadas o carimbo não é gravado', () => {
  const { root, repo, git, zip } = zipRepo('900013');
  try {
    writeIn('l2/a.ts', 'dirty')(git, repo);
    assert.equal(writeZipStamp(repo, zip), false);
    assert.equal(compiledZipStaleReason(root, '900013'), 'sources have uncommitted changes');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt194: o buildProjectsObj carimba o zip depois de copiá-lo para obj/', () => {
  const src = readFileSync(join(HERE, 'buildProjectsObj.mjs'), 'utf8');
  assert.match(src, /writeZipStamp\(join\(ROOT, `mls-\$\{id\}`\), join\(objDir, 'compiled\.zip'\)\);/u);
  assert.ok(src.indexOf('copyFileSync(staged') < src.indexOf('writeZipStamp('));
});

test('rt194: o zip em dia pela hora, sem carimbo, ganha o carimbo no ativar; um snapshot depois não o deixa velho', () => {
  const { root, repo, git, zip } = zipRepo('900014');
  try {
    const later = new Date(Date.now() + 5_000);
    utimesSync(zip, later, later);
    assert.equal(compiledZipStaleReason(root, '900014'), null);
    assert.deepEqual(ensureFechoCompiledZips(root, ['900014'], { build: () => assert.fail('não devia gerar'), log: () => {} }), []);
    // snapshot local: commit novo, mesmas camadas, zip agora "mais velho" que o HEAD
    writeIn('README.md', 'r2')(git, repo);
    commitAll('snapshot')(git);
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(zip, old, old);
    assert.equal(compiledZipStaleReason(root, '900014'), 'zip is older than the HEAD commit', 'o mtime mudou: o carimbo não vale mais');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt194: carimbado no ativar, o snapshot sem mudança de camadas não refaz', () => {
  const { root, repo, git, zip } = zipRepo('900015');
  try {
    const later = new Date(Date.now() + 5_000);
    utimesSync(zip, later, later);
    ensureFechoCompiledZips(root, ['900015'], { build: () => assert.fail('não devia gerar'), log: () => {} });
    writeIn('README.md', 'r2')(git, repo);
    commitAll('snapshot')(git);
    assert.deepEqual(ensureFechoCompiledZips(root, ['900015'], { build: () => assert.fail('refez a lib por um snapshot'), log: () => {} }), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
