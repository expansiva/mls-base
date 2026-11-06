import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { migrateToProjectTree, oldDraftChildren, parseArgs, revertProjectTree } from './migrateToProjectTree.mjs';

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
    arm() {},
    stopDrafts() { return []; },
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

test('--discard-drafts removes dirty drafts and their branches, keeps main, then migrates', async () => {
  const { source, app, slug } = withDraft(true);
  // a draft folder that holds a standalone clone (.git is a directory), as the lima had: no worktree to remove
  mkdirSync(join(source, 'drafts', 'team-other'), { recursive: true });
  execFileSync('git', ['clone', '-q', app, join(source, 'drafts', 'team-other', 'mls-102056')]);
  const args = parseArgs(['102056', '--root', source, '--discard-drafts', '--store', join(source, '..', 'pnpm-store')]);
  assert.equal(args.discardDrafts, true);
  const dry = await migrateToProjectTree({ ...args, dryRun: true });
  assert.match(dry.lines.join('\n'), new RegExp(`would discard draft ${slug}`));
  assert.equal(existsSync(join(source, 'drafts', slug)), true);
  const stopped = [];
  const pruned = [];
  const result = await migrateToProjectTree({
    ...args,
    commands: { ...commands(args.destRoot), stopDrafts: (_s, id) => { stopped.push(id); return []; }, pruneDraftDatabases: (id, data) => { pruned.push([id, data]); return ['dropped collab_app_draft_team_102056 (14 MB)', 'keep collab_app_draft_102047_u1 (active: folder x)']; } },
  });
  assert.deepEqual(stopped, ['102056']);
  assert.deepEqual(pruned, [['102056', dirname(source)]]);
  assert.match(result.lines.join('\n'), /draft databases: dropped collab_app_draft_team_102056 \(14 MB\)/);
  assert.equal(result.lines.join('\n').includes('keep collab_app_draft'), false, 'kept databases are not noise in the migration output');
  assert.match(result.lines.join('\n'), new RegExp(`discarded draft ${slug}`));
  assert.match(result.lines.join('\n'), /deleted branch team\/7/);
  assert.match(result.lines.join('\n'), /deleted branch user\/ab/);
  assert.equal(existsSync(join(source, 'drafts', slug)), false);
  assert.equal(existsSync(join(source, 'drafts', 'team-other')), false);
  const names = (repo) => heads(repo).trim().split('\n').map((l) => l.split(' ')[0]).join(',');
  assert.equal(names(app), 'main');
  assert.equal(names(join(args.destRoot, 'mls-102056')), 'main');
  assert.equal(existsSync(join(args.destRoot, 'drafts', slug)), false);
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

function listenLater(port, delayMs, status) {
  let server;
  let timer;
  return {
    arm() {
      timer = setTimeout(() => {
        server = createServer((req, res) => {
          res.writeHead(status);
          res.end('ok');
        });
        server.listen(port, '127.0.0.1');
      }, delayMs);
    },
    close() {
      clearTimeout(timer);
      return new Promise((resolve) => {
        if (!server || !server.listening) resolve();
        else server.close(() => resolve());
      });
    },
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
    probe.on('error', reject);
  });
}

test('health waits until a late server answers, and a dead or 500 port fails with the real cause', async () => {
  // 2056 is the lima app. The migration still asks for that URL; fetch lands on a free port.
  const port = await freePort();
  const origFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => origFetch(String(url).replace('127.0.0.1:2056', `127.0.0.1:${port}`), init);
  const late = listenLater(port, 600, 200);
  try {
    const { source, box } = fixture();
    const args = parseArgs(['102056', '--root', source]);
    const dest = join(box, 'app102056', 'mls-base');
    const base = commands(dest);
    delete base.health;
    const ok = await migrateToProjectTree({
      ...args,
      healthTimeoutMs: 3000,
      healthStepMs: 100,
      commands: {
        ...base,
        ...fakePm2(join(source, 'current-102056'), join(dest, 'current')),
        release(root) {
          base.release(root);
          late.arm();
        },
      },
    });
    assert.match(ok.lines.join('\n'), /GET http:\/\/127.0.0.1:2056\/health/);
    assert.equal(existsSync(dest), true);
    await late.close();

    const { source: source2, box: box2 } = fixture();
    const args2 = parseArgs(['102056', '--root', source2]);
    const dest2 = join(box2, 'app102056', 'mls-base');
    const oldCwd = join(source2, 'current-102056');
    const pm2 = fakePm2(oldCwd, join(dest2, 'current'));
    const refusedCommands = commands(dest2);
    delete refusedCommands.health;
    await assert.rejects(
      () => migrateToProjectTree({
        ...args2,
        healthTimeoutMs: 400,
        healthStepMs: 100,
        commands: { ...refusedCommands, ...pm2 },
      }),
      /health http:\/\/127\.0\.0\.1:2056\/health not ready after \d+ ms: ECONNREFUSED/,
    );
    assert.equal(existsSync(dest2), false);
    assert.deepEqual(pm2.rows().map((row) => row.pm2_env.pm_cwd), [oldCwd, oldCwd]);

    const failing = listenLater(port, 0, 500);
    failing.arm();
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const { source: source3, box: box3 } = fixture();
      const args3 = parseArgs(['102056', '--root', source3]);
      const dest3 = join(box3, 'app102056', 'mls-base');
      const failingCommands = commands(dest3);
      delete failingCommands.health;
      await assert.rejects(
        () => migrateToProjectTree({
          ...args3,
          healthTimeoutMs: 2000,
          healthStepMs: 100,
          commands: { ...failingCommands, ...fakePm2(join(source3, 'current-102056'), join(dest3, 'current')) },
        }),
        /health http:\/\/127\.0\.0\.1:2056\/health not ready after \d+ ms: HTTP 500/,
      );
      assert.equal(existsSync(dest3), false);
    } finally {
      await failing.close();
    }
  } finally {
    globalThis.fetch = origFetch;
    await late.close();
  }
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

function oldConfig(source, cwd) {
  const file = join(source, 'pm2.apps.d', 'app2056.config.js');
  writeFileSync(file, `module.exports = { cwd: ${JSON.stringify(cwd)}, env: { COLLAB_PROJECT_ID: "102056" } };\n`);
  return file;
}

test('revert points the app at the old cwd and leaves the new folder', async () => {
  const { source, box } = fixture();
  const dest = join(box, 'app102056', 'mls-base');
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, 'keep.txt'), 'keep\n');
  const oldCwd = join(source, 'current-102056');
  const config = oldConfig(source, oldCwd);
  const pm2 = fakePm2(join(dest, 'current'), oldCwd);
  let asked = '';
  const result = await revertProjectTree({
    ...parseArgs(['102056', '--root', source, '--revert']),
    commands: {
      ...pm2,
      health(url) { asked = url; },
    },
  });
  assert.equal(asked, 'http://127.0.0.1:2056/health');
  assert.deepEqual(pm2.rows().map((row) => row.pm2_env.pm_cwd), [oldCwd, oldCwd]);
  assert.deepEqual(pm2.calls, ['delete app2056', `start ${config}`, 'save']);
  assert.equal(result.lines[0], `pm2 app2056 → ${oldCwd}`);
  assert.equal(readFileSync(join(dest, 'keep.txt'), 'utf8'), 'keep\n');
});

test('revert hides the new tree boot config (.revertido) and a repeated migration gives it back', async () => {
  const { source, box } = fixture();
  const args = parseArgs(['102056', '--root', source]);
  const dest = args.destRoot;
  await migrateToProjectTree({ ...args, commands: commands(dest) });
  const bootConfig = join(dest, 'pm2.apps.d', 'app2056.config.js');
  assert.equal(existsSync(bootConfig), true);
  const original = readFileSync(bootConfig, 'utf8');
  const oldCwd = join(source, 'current-102056');
  oldConfig(source, oldCwd);
  const dry = await revertProjectTree({ ...parseArgs(['102056', '--root', source, '--revert', '--dry-run']), commands: fakePm2(join(dest, 'current'), oldCwd) });
  assert.match(dry.lines.join('\n'), /would rename .*app2056\.config\.js -> app2056\.config\.js\.revertido/);
  assert.equal(existsSync(bootConfig), true);
  const pm2 = fakePm2(join(dest, 'current'), oldCwd);
  const result = await revertProjectTree({ ...parseArgs(['102056', '--root', source, '--revert']), commands: { ...pm2, health() {} } });
  assert.match(result.lines.join('\n'), /renamed .*app2056\.config\.js\.revertido/);
  assert.equal(existsSync(bootConfig), false);
  assert.equal(readFileSync(`${bootConfig}.revertido`, 'utf8'), original);
  // revert again: already on the old tree, still ends hidden and does not fail
  const again = await revertProjectTree({ ...parseArgs(['102056', '--root', source, '--revert']), commands: { ...fakePm2(oldCwd, oldCwd), health() { throw new Error('no health'); } } });
  assert.match(again.lines.join('\n'), /skip pm2 app2056/);
  await migrateToProjectTree({ ...args, commands: commands(dest) });
  assert.equal(readFileSync(bootConfig, 'utf8'), original);
  assert.equal(existsSync(`${bootConfig}.revertido`), false);
  assert.equal(existsSync(join(box, 'app102056')), true);
});

test('revert skips when the cwd is already the old tree', async () => {
  const { source } = fixture();
  const oldCwd = join(source, 'current-102056');
  oldConfig(source, oldCwd);
  const pm2 = fakePm2(oldCwd, oldCwd);
  const result = await revertProjectTree({
    ...parseArgs(['102056', '--root', source, '--revert']),
    commands: { ...pm2, health() { throw new Error('health should not run'); } },
  });
  assert.match(result.lines.join('\n'), /skip pm2 app2056/);
  assert.equal(pm2.calls.some((call) => call.startsWith('delete')), false);
});

test('revert fails when start leaves the new cwd', async () => {
  const { source } = fixture();
  const oldCwd = join(source, 'current-102056');
  const newCwd = join(source, '..', 'app102056', 'mls-base', 'current');
  oldConfig(source, oldCwd);
  const pm2 = fakePm2(newCwd, oldCwd, false);
  await assert.rejects(
    () => revertProjectTree({
      ...parseArgs(['102056', '--root', source, '--revert']),
      commands: { ...pm2, health() { throw new Error('health should not run'); } },
    }),
    (error) => {
      assert.equal(error.message, `pm2 app2056 cwd is still ${newCwd}, wanted ${oldCwd}`);
      return true;
    },
  );
});

test('revert refuses when the old config is missing', async () => {
  const { source } = fixture();
  unlinkSync(join(source, 'pm2.apps.d', 'app2056.config.js'));
  await assert.rejects(
    () => revertProjectTree(parseArgs(['102056', '--root', source, '--revert'])),
    new RegExp(`refusing revert of 102056: missing ${join(source, 'pm2.apps.d', 'app2056.config.js')}`),
  );
});

test('revert --dry-run lists the steps and writes nothing', async () => {
  const { source, box } = fixture();
  const dest = join(box, 'app102056', 'mls-base');
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, 'keep.txt'), 'keep\n');
  const oldCwd = join(source, 'current-102056');
  const config = oldConfig(source, oldCwd);
  const before = readFileSync(config, 'utf8');
  const pm2 = fakePm2(join(dest, 'current'), oldCwd);
  const result = await revertProjectTree({
    ...parseArgs(['102056', '--root', source, '--dry-run', '--revert']),
    commands: pm2,
  });
  assert.equal(result.lines[0], `would pm2 delete app2056; start ${config}; save`);
  assert.equal(pm2.calls.length, 0);
  assert.equal(readFileSync(config, 'utf8'), before);
  assert.equal(readFileSync(join(dest, 'keep.txt'), 'utf8'), 'keep\n');
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

test('the new root is on main with the old origin and push settings; the copied repos keep origin and receive settings', async () => {
  const { source } = fixture();
  git(source, ['remote', 'add', 'origin', 'https://github.com/expansiva/mls-base.git']);
  git(source, ['config', '--local', 'receive.denyCurrentBranch', 'updateInstead']);
  git(source, ['config', '--local', 'receive.denyDeletes', 'true']);
  const app = join(source, 'mls-102056');
  git(app, ['config', '--local', 'receive.denyCurrentBranch', 'updateInstead']);
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  const armed = [];
  await migrateToProjectTree({ ...args, commands: commands(args.destRoot, { arm: (dest) => armed.push(dest) }) });
  const dest = args.destRoot;
  const read = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  assert.equal(read(dest, 'symbolic-ref', '--short', 'HEAD'), 'main', 'not a detached HEAD');
  assert.equal(read(dest, 'remote', 'get-url', 'origin'), 'https://github.com/expansiva/mls-base.git');
  assert.equal(read(dest, 'config', '--local', '--get', 'receive.denyCurrentBranch'), 'updateInstead');
  assert.equal(read(dest, 'config', '--local', '--get', 'receive.denyDeletes'), 'true');
  const copied = join(dest, 'mls-102056');
  assert.equal(read(copied, 'config', '--local', '--get', 'receive.denyCurrentBranch'), 'updateInstead');
  assert.equal(execFileSync('git', ['-C', copied, 'remote'], { encoding: 'utf8' }).trim(), '', 'the app had no origin');
  assert.deepEqual(armed, [dest], 'the git repos are armed once, from the new root');
});

test('the draft children of the old tree for this project are found, and only live deno ones of that project', () => {
  const { source } = fixture();
  const write = (slug, info) => {
    mkdirSync(join(source, 'drafts', slug), { recursive: true });
    writeFileSync(join(source, 'drafts', slug, 'dev.json'), JSON.stringify(info));
  };
  // the database names are the real ones: person = `_u<12 hex>`, team = `collab_app_draft_team_<id>`
  write('team-102056', { pid: 111, port: 4100, database: 'collab_app_draft_team_102056' });
  write('user-ab', { pid: 222, port: 4101, database: 'collab_app_draft_102056_u48b2698f03c6' });
  write('user-cd', { pid: 333, port: 4102, database: 'collab_app_draft_102047_u040e29b82e87' });
  write('user-ef', { pid: 444, port: 4103, database: 'collab_app_draft_102056_u679068f3c1ff' });
  write('team-102047', { pid: 555, port: 4105, database: 'collab_app_draft_team_102047' });
  write('odd', { pid: 666, port: 4106, database: 'collab_app_draft_102056_team' });
  write('broken', { port: 4104 });
  const commandOf = (pid) => ({ 111: '/usr/bin/deno run --allow-net=127.0.0.1:4100', 222: 'node something.js', 333: 'deno run', 444: '', 555: 'deno run --allow-read', 666: 'deno run' })[pid] ?? '';
  const found = oldDraftChildren(source, '102056', { readCommand: commandOf });
  assert.deepEqual(found.map((child) => [child.slug, child.pid, child.port]), [['team-102056', 111, 4100]], 'the team child of the project is found; a person with a non-deno pid, an empty command, another project and a name that is no real form are not');
  assert.deepEqual(oldDraftChildren(source, '102047', { readCommand: commandOf }).map((child) => child.slug).sort(), ['team-102047', 'user-cd']);
});

test('a failing prune is said and does not undo the migration', async () => {
  const { source } = withDraft(false);
  const args = parseArgs(['102056', '--root', source, '--discard-drafts', '--store', join(source, '..', 'pnpm-store')]);
  const result = await migrateToProjectTree({
    ...args,
    commands: { ...commands(args.destRoot), pruneDraftDatabases() { throw new Error('sudo: a password is required'); } },
  });
  assert.match(result.lines.join('\n'), /draft databases: prune skipped \(sudo: a password is required\)/);
  assert.equal(existsSync(join(args.destRoot, 'mls-102056')), true);
});

test('a migration without --discard-drafts never touches the draft databases', async () => {
  const { source } = withDraft(false);
  const args = parseArgs(['102056', '--root', source, '--store', join(source, '..', 'pnpm-store')]);
  const result = await migrateToProjectTree({
    ...args,
    commands: { ...commands(args.destRoot), pruneDraftDatabases() { throw new Error('must not be called'); } },
  });
  assert.equal(result.lines.join('\n').includes('draft databases'), false);
});
