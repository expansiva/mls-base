import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { migrateToProjectTree, parseArgs } from './migrateToProjectTree.mjs';

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function fixture() {
  const box = mkdtempSync(join(tmpdir(), 'rt172-s2-'));
  const source = join(box, 'mls-base');
  mkdirSync(source);
  git(source, ['init', '-b', 'main']);
  git(source, ['config', 'user.email', 'rt172@example.com']);
  git(source, ['config', 'user.name', 'rt172']);
  mkdirSync(join(source, 'mls-102034'));
  writeFileSync(join(source, 'mls-102034', 'lib.txt'), 'lib\n');
  mkdirSync(join(source, 'mls-102047'));
  writeFileSync(join(source, 'mls-102047', 'other.txt'), 'other\n');
  writeFileSync(join(source, 'config.json'), '{}\n');
  writeFileSync(join(source, '.env'), 'PGUSER=app\n');
  mkdirSync(join(source, 'pm2.apps.d'));
  writeFileSync(join(source, 'pm2.apps.d', 'app2056.config.js'), 'COLLAB_PROJECT_ID: "102056"\n');
  writeFileSync(join(source, 'pm2.apps.d', 'app2047.config.js'), 'COLLAB_PROJECT_ID: "102047"\n');
  git(source, ['add', '.']);
  git(source, ['commit', '-m', 'base']);
  const app = join(source, 'mls-102056');
  mkdirSync(app);
  git(app, ['init', '-b', 'main']);
  git(app, ['config', 'user.email', 'rt172@example.com']);
  git(app, ['config', 'user.name', 'rt172']);
  writeFileSync(join(app, 'app.txt'), 'app\n');
  git(app, ['add', '.']);
  git(app, ['commit', '-m', 'app']);
  return { box, source, appHead: execFileSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
}

function commands(dest, extra = {}) {
  let switched = false;
  return {
    pnpm(cwd) {
      mkdirSync(join(cwd, 'node_modules'));
    },
    buildObj(root, ids) {
      for (const id of ids) {
        mkdirSync(join(root, `mls-${id}`, 'obj'), { recursive: true });
        writeFileSync(join(root, `mls-${id}`, 'obj', 'compiled.zip'), `built ${id}\n`);
      }
    },
    release(root) {
      mkdirSync(join(root, 'releases', '1'), { recursive: true });
      symlinkSync('releases/1', join(root, 'current'));
    },
    pm2() {
      switched = true;
    },
    pm2Cwd() {
      return switched ? join(dest, 'current') : '';
    },
    health() {},
    ...extra,
  };
}

test('dry-run lists both projects and writes nothing', async () => {
  const { source, box } = fixture();
  const lines = (await migrateToProjectTree({
    ...parseArgs(['102056', '--root', source, '--dry-run']),
  })).lines.join('\n');
  assert.match(lines, /would clone/);
  assert.match(lines, /would clone .*mls-102056/);
  assert.match(lines, /leave mls-102047/);
  assert.match(lines, /would pnpm install/);
  assert.match(lines, /would release 102056/);
  assert.match(lines, /would pm2 app2056/);
  assert.equal(existsSync(join(box, 'app102056')), false);
  assert.equal(existsSync(join(source, 'mls-102047', 'other.txt')), true);
});

test('copies one project with history, then a second run does not clone again', async () => {
  const { source, appHead } = fixture();
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  const first = await migrateToProjectTree({ ...args, commands: commands(args.destRoot) });
  assert.equal(existsSync(join(args.destRoot, 'mls-102047')), false);
  assert.equal(existsSync(join(source, 'mls-102047', 'other.txt')), true);
  assert.equal(
    execFileSync('git', ['-C', join(args.destRoot, 'mls-102056'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    appHead,
  );
  assert.match(readFileSync(join(args.destRoot, '.env'), 'utf8'), new RegExp(`CBE_PROJECTS_DIR=${args.destRoot}`));
  assert.match(readFileSync(join(args.destRoot, '.env'), 'utf8'), /CBE_STATIC_DIR=/);
  assert.match(readFileSync(join(args.destRoot, 'pm2.apps.d', 'app2056.config.js'), 'utf8'), /\/current"/);

  const second = await migrateToProjectTree({ ...args, commands: commands(args.destRoot) });
  assert.match(second.lines.join('\n'), /skip clone/);
  assert.match(second.lines.join('\n'), /skip clone .*mls-102056/);
  assert.equal(first.lines.filter((line) => line.startsWith('clone ')).length, 2);
});

function heads(repo) {
  return execFileSync('git', ['-C', repo, 'for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads'], { encoding: 'utf8' });
}

function withDraft(dirty) {
  const built = fixture();
  const app = join(built.source, 'mls-102056');
  git(app, ['branch', 'team/7']);
  git(app, ['checkout', '-b', 'user/ab']);
  writeFileSync(join(app, 'user.txt'), 'user\n');
  git(app, ['add', 'user.txt']);
  git(app, ['commit', '-m', 'user']);
  git(app, ['checkout', 'main']);
  const slug = 'ada';
  const work = join(built.source, 'drafts', slug, 'mls-102056');
  mkdirSync(join(built.source, 'drafts', slug), { recursive: true });
  git(app, ['worktree', 'add', work, 'team/7']);
  writeFileSync(join(built.source, 'drafts', slug, 'owner.json'), '{"person":"ada"}\n');
  writeFileSync(join(built.source, 'drafts', slug, 'dev.json'), '{"port":1}\n');
  if (dirty) writeFileSync(join(work, 'dirty.txt'), 'x\n');
  return { ...built, app, slug };
}

test('copies draft branches and owner.json, not the worktree', async () => {
  const { source, app, slug } = withDraft(false);
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  await migrateToProjectTree({ ...args, commands: commands(args.destRoot) });
  const destApp = join(args.destRoot, 'mls-102056');
  assert.equal(heads(destApp), heads(app));
  assert.equal(readFileSync(join(args.destRoot, 'drafts', slug, 'owner.json'), 'utf8'), '{"person":"ada"}\n');
  assert.equal(existsSync(join(args.destRoot, 'drafts', slug, 'mls-102056')), false);
  assert.equal(existsSync(join(args.destRoot, 'drafts', slug, 'dev.json')), false);
  const owner = readFileSync(join(args.destRoot, 'drafts', slug, 'owner.json'));
  const before = heads(destApp);
  const second = await migrateToProjectTree({ ...args, commands: commands(args.destRoot) });
  assert.equal(heads(destApp), before);
  assert.deepEqual(readFileSync(join(args.destRoot, 'drafts', slug, 'owner.json')), owner);
  assert.match(second.lines.join('\n'), new RegExp(`skip copy drafts/${slug}/owner.json`));
});

test('refuses a dirty draft before writing, including dry-run', async () => {
  const { source, box, slug } = withDraft(true);
  const args = parseArgs(['102056', '--root', source]);
  await assert.rejects(
    () => migrateToProjectTree({ ...args, commands: commands(args.destRoot) }),
    new RegExp(`refusing project 102056: uncommitted draft changes: ${slug} \\(1 files\\)`),
  );
  assert.equal(existsSync(join(box, 'app102056')), false);
  const dry = await migrateToProjectTree({ ...args, dryRun: true });
  assert.match(dry.lines.join('\n'), new RegExp(`refusing project 102056: uncommitted draft changes: ${slug} \\(1 files\\)`));
  assert.equal(existsSync(join(box, 'app102056')), false);
});

function writeObj(repo, body) {
  mkdirSync(join(repo, 'obj'), { recursive: true });
  writeFileSync(join(repo, 'obj', 'compiled.zip'), body);
  writeFileSync(join(repo, 'obj', 'source.zip'), `${body}source`);
}

test('copies obj from the old tree at the same commit and skips it the second time', async () => {
  const { source } = fixture();
  const lib = join(source, 'mls-102034');
  git(lib, ['init', '-b', 'main']);
  git(lib, ['config', 'user.email', 'rt172@example.com']);
  git(lib, ['config', 'user.name', 'rt172']);
  git(lib, ['add', '.']);
  git(lib, ['commit', '-m', 'lib']);
  writeObj(lib, 'lib-zip');
  writeObj(join(source, 'mls-102056'), 'app-zip');
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  const built = [];
  const run = { ...commands(args.destRoot), buildObj(root, ids) { built.push(...ids); } };
  const dry = await migrateToProjectTree({ ...args, dryRun: true });
  assert.match(dry.lines.join('\n'), /would copy obj mls-102034/);
  assert.match(dry.lines.join('\n'), /would copy obj mls-102056/);
  assert.equal(existsSync(args.destRoot), false);
  await migrateToProjectTree({ ...args, commands: run });
  assert.equal(built.length, 0);
  assert.equal(readFileSync(join(args.destRoot, 'mls-102056', 'obj', 'compiled.zip'), 'utf8'), 'app-zip');
  assert.equal(readFileSync(join(args.destRoot, 'mls-102056', 'obj', 'source.zip'), 'utf8'), 'app-zipsource');
  assert.equal(existsSync(join(args.destRoot, '.migrando')), false);
  const zip = readFileSync(join(args.destRoot, 'mls-102056', 'obj', 'compiled.zip'));
  const second = await migrateToProjectTree({ ...args, commands: commands(args.destRoot) });
  assert.match(second.lines.join('\n'), /skip copy obj mls-102056/);
  assert.deepEqual(readFileSync(join(args.destRoot, 'mls-102056', 'obj', 'compiled.zip')), zip);
});

test('builds obj when the old tree has no zip or a different commit', async () => {
  const { source } = fixture();
  writeFileSync(join(source, 'config.json'), '{"projects":{"102099":{"root":"../mls-102099"}}}\n');
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  const built = [];
  const record = (_root, ids) => {
    built.push(ids.join(','));
    for (const id of ids) {
      mkdirSync(join(_root, `mls-${id}`, 'obj'), { recursive: true });
      writeFileSync(join(_root, `mls-${id}`, 'obj', 'compiled.zip'), `built ${id}\n`);
    }
  };
  await migrateToProjectTree({
    ...args,
    commands: { ...commands(args.destRoot), buildObj: record },
  });
  assert.deepEqual(built, ['102034,102056,102099']);
  unlinkSync(join(args.destRoot, 'mls-102056', 'obj', 'compiled.zip'));
  git(join(source, 'mls-102056'), ['commit', '--allow-empty', '-m', 'ahead']);
  built.length = 0;
  await migrateToProjectTree({
    ...args,
    commands: { ...commands(args.destRoot), buildObj: record },
  });
  assert.deepEqual(built, ['102056']);
});

test('a failed release removes the folder this run created', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = join(box, 'app102056', 'mls-base');
  await assert.rejects(
    () => migrateToProjectTree({
      ...args,
      commands: { ...commands(dest), release() { throw new Error('release boom'); } },
    }),
    new RegExp(`migration failed: release boom; removed ${dest}`),
  );
  assert.equal(existsSync(dest), false);
});

// startOrReload of a running app leaves cwd alone. delete removes it.
// start sets cwd from the config path, unless startSetsCwd is false.
function fakePm2(oldCwd, newCwd, startSetsCwd = true) {
  const pair = (cwd) => [0, 1].map(() => ({ name: 'app2056', pm2_env: { status: 'online', pm_cwd: cwd } }));
  let rows = pair(oldCwd);
  const calls = [];
  const cwdFor = (config) => (config.includes(`${newCwd.split('/').slice(0, -1).join('/')}/pm2`) ? newCwd : oldCwd);
  return {
    calls,
    rows: () => rows.map((row) => ({ name: row.name, pm2_env: { ...row.pm2_env } })),
    pm2Instances() {
      return rows.map((row) => ({ name: row.name, pm2_env: { ...row.pm2_env } }));
    },
    pm2Delete(app) {
      calls.push(`delete ${app}`);
      rows = rows.filter((row) => row.name !== app);
    },
    pm2(config) {
      calls.push(`start ${config}`);
      const cwd = startSetsCwd ? cwdFor(config) : oldCwd;
      rows = pair(cwd);
    },
    pm2Save() {
      calls.push('save');
    },
  };
}

test('pm2 delete then start moves every instance onto the new cwd', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = join(box, 'app102056', 'mls-base');
  const oldCwd = join(source, 'current-102056');
  const newCwd = join(dest, 'current');
  const pm2 = fakePm2(oldCwd, newCwd);
  await migrateToProjectTree({
    ...args,
    commands: { ...commands(dest), ...pm2 },
  });
  assert.deepEqual(pm2.rows().map((row) => row.pm2_env.pm_cwd), [newCwd, newCwd]);
  assert.deepEqual(pm2.calls, [
    'delete app2056',
    `start ${join(dest, 'pm2.apps.d', 'app2056.config.js')}`,
    'save',
  ]);
});

test('a start that leaves the old cwd fails, restores that cwd, and removes the new folder', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = join(box, 'app102056', 'mls-base');
  const oldCwd = join(source, 'current-102056');
  const pm2 = fakePm2(oldCwd, join(dest, 'current'), false);
  await assert.rejects(
    () => migrateToProjectTree({ ...args, commands: { ...commands(dest), ...pm2 } }),
    new RegExp(`pm2 app2056 cwd is still ${oldCwd}, wanted ${join(dest, 'current')}`),
  );
  assert.equal(existsSync(dest), false);
  assert.deepEqual(pm2.rows().map((row) => row.pm2_env.pm_cwd), [oldCwd, oldCwd]);
  assert.equal(pm2.calls.filter((call) => call.startsWith('delete')).length, 2);
});

test('a second run whose cwd is already the new tree skips pm2 and does not delete', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = join(box, 'app102056', 'mls-base');
  const newCwd = join(dest, 'current');
  await migrateToProjectTree({
    ...args,
    commands: { ...commands(dest), ...fakePm2(join(source, 'current-102056'), newCwd) },
  });
  const pm2 = fakePm2(newCwd, newCwd);
  const second = await migrateToProjectTree({
    ...args,
    commands: { ...commands(dest), ...pm2 },
  });
  assert.match(second.lines.join('\n'), /skip pm2 app2056/);
  assert.equal(pm2.calls.some((call) => call.startsWith('delete')), false);
});

test('a health failure after the pm2 switch puts pm2 back on the old tree and removes the new folder', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = join(box, 'app102056', 'mls-base');
  const oldCwd = join(source, 'current-102056');
  const pm2 = fakePm2(oldCwd, join(dest, 'current'));
  await assert.rejects(
    () => migrateToProjectTree({
      ...args,
      commands: {
        ...commands(dest),
        ...pm2,
        health() { throw new Error('health boom'); },
      },
    }),
    new RegExp(`migration failed: health boom; removed ${dest}; pm2 app2056 restored to ${source}`),
  );
  assert.equal(existsSync(dest), false);
  assert.deepEqual(pm2.rows().map((row) => row.pm2_env.pm_cwd), [oldCwd, oldCwd]);
  assert.deepEqual(pm2.calls, [
    'delete app2056',
    `start ${join(dest, 'pm2.apps.d', 'app2056.config.js')}`,
    'save',
    'delete app2056',
    `start ${join(source, 'pm2.apps.d', 'app2056.config.js')}`,
    'save',
  ]);
});

test('refuses an unfinished destination and does not delete it', async () => {
  const { source } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  mkdirSync(args.destRoot, { recursive: true });
  writeFileSync(join(args.destRoot, 'keep.txt'), 'keep\n');
  const line = new RegExp(`destination exists but is not a finished migration: ${args.destRoot} \\(remove it first\\)`);
  await assert.rejects(
    () => migrateToProjectTree({ ...args, commands: commands(args.destRoot) }),
    line,
  );
  assert.equal(readFileSync(join(args.destRoot, 'keep.txt'), 'utf8'), 'keep\n');
  const dry = await migrateToProjectTree({ ...args, dryRun: true });
  assert.match(dry.lines.join('\n'), line);
  assert.equal(readFileSync(join(args.destRoot, 'keep.txt'), 'utf8'), 'keep\n');
});

test('cli --dry-run exits 0', () => {
  const { source } = fixture();
  const result = spawnSync(process.execPath, [
    join(import.meta.dirname, 'migrateToProjectTree.mjs'), '102047', '--root', source, '--dry-run',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /would clone/);
  assert.match(result.stdout, /leave mls-102056/);
});
