import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { findSourceTree, parseArgs, projectTreeInit } from './projectTreeInit.mjs';

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@x' };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: ENV }).trim();

/** /data with the source tree of 102047 (a git repo with a projectInit stub and a database .env). */
function vm({ sourceEnv = true, packageJson = true } = {}) {
  const data = mkdtempSync(join(tmpdir(), 'rt187-'));
  const source = join(data, 'app102047', 'mls-base');
  mkdirSync(join(source, 'scripts', 'runtime'), { recursive: true });
  // the stub stands for projectInit.mjs: it only makes mls-<id>, as the real one does after the model clone
  writeFileSync(join(source, 'scripts', 'runtime', 'projectInit.mjs'), "import { mkdirSync } from 'node:fs'; import { join } from 'node:path';\nconst id = process.argv[2]; const root = process.argv[process.argv.indexOf('--root') + 1];\nmkdirSync(join(root, `mls-${id}`), { recursive: true });\n");
  if (packageJson) writeFileSync(join(source, 'package.json'), '{}\n');
  execFileSync('git', ['init', '-q', '-b', 'main', source]);
  git(source, 'add', '-A');
  git(source, 'commit', '-q', '-m', 'platform');
  if (sourceEnv) writeFileSync(join(source, '.env'), 'APP_ENV=production\nRUNTIME_MODE=postgres\nPGHOST=127.0.0.1\nPGPORT=5432\nPGDATABASE=mdm\nPGUSER=collab\nPGPASSWORD=s3cret\nWRITE_BEHIND_ENABLED=false\nOTHER=not-copied\n');
  return { data, source, head: git(source, 'rev-parse', 'HEAD') };
}

/** Real git and the real projectInit stub; pnpm and pm2 are recorded, not run. */
function deps(calls) {
  return {
    run(cmd, args, options) {
      if (cmd === 'pnpm' || cmd === 'pm2') { calls.push([cmd, ...args]); return { status: 0, stdout: '', stderr: '' }; }
      const result = spawnSync(cmd, args, { encoding: 'utf8', env: ENV, ...options });
      return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
    },
  };
}
const opts = (data, extra = {}) => ({ ...parseArgs(['102056', '--data', data]), ...extra });

test('parseArgs: id, port, proxy target, data; a bad id or an unknown flag is an error', () => {
  const parsed = parseArgs(['102056', '--port', '2056', '--msg-proxy-target', 'http://x', '--data', '/tmp/d']);
  assert.equal(parsed.projectId, '102056');
  assert.equal(parsed.port, '2056');
  assert.equal(parsed.msgProxyTarget, 'http://x');
  assert.equal(parsed.store, '/tmp/d/.pnpm-store');
  assert.throws(() => parseArgs(['abc']), /digits/u);
  assert.throws(() => parseArgs(['102056', '--nope']), /unknown argument/u);
});

test('findSourceTree: the cm main project first, else any other tree, never the project itself', () => {
  const { data } = vm();
  const second = join(data, 'app102099', 'mls-base');
  mkdirSync(second, { recursive: true });
  execFileSync('git', ['init', '-q', second]);
  assert.equal(findSourceTree({ data, projectId: '102056' }), join(data, 'app102047', 'mls-base'), 'sorted scan: the first tree');
  mkdirSync(join(data, 'etc'), { recursive: true });
  writeFileSync(join(data, 'etc', 'shared.json'), '{"cm":{"projetoPrincipal":102099}}\n');
  assert.equal(findSourceTree({ data, projectId: '102056' }), second, 'the main project of the cm wins');
  assert.equal(findSourceTree({ data, projectId: '102099' }), join(data, 'app102047', 'mls-base'), 'never the project itself');
});

test('a new project: tree cloned at the source commit, .env copied (database keys only) plus CBE_ keys, project, app config; pm2 waits for a release', () => {
  const { data, source, head } = vm();
  const calls = [];
  const result = projectTreeInit(opts(data), deps(calls));
  const root = join(data, 'app102056', 'mls-base');
  assert.deepEqual(result.created, { tree: true, env: true, project: true, app: true });
  assert.equal(result.ok, true);
  assert.equal(result.port, 2056);
  assert.equal(result.appName, 'app2056');
  assert.equal(result.root, root);
  assert.equal(result.commit, head);
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(source, 'rev-parse', 'HEAD'));
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD', 'detached at the source commit');
  const env = readFileSync(join(root, '.env'), 'utf8');
  assert.match(env, /^PGPASSWORD=s3cret$/mu);
  assert.match(env, /^PGDATABASE=mdm$/mu);
  assert.equal(env.includes('OTHER='), false, 'only the database and mode keys are copied');
  assert.match(env, new RegExp(`^CBE_PROJECTS_DIR=${root}$`, 'mu'));
  assert.match(env, new RegExp(`^CBE_STATIC_DIR=${root}/static$`, 'mu'));
  assert.equal(existsSync(join(root, 'mls-102056')), true);
  assert.equal(existsSync(join(root, 'pm2.apps.d', 'app2056.config.js')), true);
  assert.equal(existsSync(join(root, 'pm2.config.js')), true);
  assert.deepEqual(calls.filter((call) => call[0] === 'pnpm').map((call) => call.slice(0, 3)), [['pnpm', 'install', '--store-dir']]);
  assert.equal(result.started, false);
  assert.equal(calls.some((call) => call[0] === 'pm2'), false, 'no release yet: pm2 is not started');
});

test('a second run changes nothing; an existing .env is left as it is (only the CBE_ keys are completed)', () => {
  const { data } = vm();
  const calls = [];
  projectTreeInit(opts(data), deps(calls));
  const root = join(data, 'app102056', 'mls-base');
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  writeFileSync(join(root, '.env'), `${readFileSync(join(root, '.env'), 'utf8')}CUSTOM=kept\n`);
  const before = readFileSync(join(root, '.env'), 'utf8');
  const again = projectTreeInit(opts(data), deps(calls));
  assert.deepEqual(again.created, { tree: false, env: false, project: false, app: false });
  assert.equal(readFileSync(join(root, '.env'), 'utf8'), before);
  assert.equal(calls.filter((call) => call[0] === 'pnpm').length, 1, 'no second pnpm install (the tree has node_modules)');
});

test('step 12 shape: the tree already cloned from the repo with the installer .env: no clone, no source needed, only what is missing', () => {
  const data = mkdtempSync(join(tmpdir(), 'rt187-'));
  const root = join(data, 'app102056', 'mls-base');
  mkdirSync(join(root, 'scripts', 'runtime'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'runtime', 'projectInit.mjs'), "import { mkdirSync } from 'node:fs'; import { join } from 'node:path';\nmkdirSync(join(process.argv[process.argv.indexOf('--root') + 1], `mls-${process.argv[2]}`), { recursive: true });\n");
  execFileSync('git', ['init', '-q', '-b', 'main', root]);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'platform');
  writeFileSync(join(root, '.env'), 'APP_ENV=production\nPGPASSWORD=installer\n');
  const result = projectTreeInit(opts(data), deps([]));
  assert.deepEqual(result.created, { tree: false, env: false, project: true, app: true });
  assert.match(readFileSync(join(root, '.env'), 'utf8'), /^PGPASSWORD=installer$/mu);
});

test('pm2 starts the app only when the tree already has a release (current)', () => {
  const { data } = vm();
  const calls = [];
  projectTreeInit(opts(data), deps(calls));
  const root = join(data, 'app102056', 'mls-base');
  mkdirSync(join(root, 'current'), { recursive: true });
  const result = projectTreeInit(opts(data), deps(calls));
  assert.equal(result.started, true);
  assert.deepEqual(calls.find((call) => call[0] === 'pm2'), ['pm2', 'startOrReload', join(root, 'pm2.apps.d', 'app2056.config.js'), '--update-env']);
});

test('errors are plain and non-silent: no source tree, a source without .env, a wrong --port, a failing projectInit', () => {
  const empty = mkdtempSync(join(tmpdir(), 'rt187-'));
  assert.throws(() => projectTreeInit(opts(empty), deps([])), /no source tree to clone/u);
  const noEnv = vm({ sourceEnv: false });
  assert.throws(() => projectTreeInit(opts(noEnv.data), deps([])), /no source \.env to copy the database keys from/u);
  const ok = vm();
  assert.throws(() => projectTreeInit(opts(ok.data, { port: '2999' }), deps([])), /is not the port of project 102056 \(2056\)/u);
  const failing = vm();
  const calls = [];
  const run = (cmd, args, options) => (args[0] && String(args[0]).endsWith('projectInit.mjs') ? { status: 1, stdout: '', stderr: 'no network to GitHub' } : deps(calls).run(cmd, args, options));
  assert.throws(() => projectTreeInit(opts(failing.data), { run }), /projectInit failed: no network to GitHub/u);
});

test('the CLI prints one JSON line last and exits 1 with a message on error', () => {
  const { data } = vm({ packageJson: false });
  const out = spawnCli(['102056', '--data', data, '--source', join(data, 'app102047', 'mls-base')]);
  assert.equal(out.status, 0, out.stderr);
  const last = JSON.parse(out.stdout.trim().split('\n').pop());
  assert.equal(last.ok, true);
  assert.equal(last.projectId, '102056');
  assert.deepEqual(last.created, { tree: true, env: true, project: true, app: true });
  const bad = spawnCli(['abc']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /digits/u);
  const none = spawnCli(['102056', '--data', mkdtempSync(join(tmpdir(), 'rt187-'))]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /no source tree to clone/u);
});

function spawnCli(args) {
  return spawnSync(process.execPath, [new URL('./projectTreeInit.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', env: { ...ENV, PATH: process.env.PATH } });
}
