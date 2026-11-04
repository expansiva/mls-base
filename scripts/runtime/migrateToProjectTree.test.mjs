import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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

function commands(dest) {
  let switched = false;
  return {
    pnpm(cwd) {
      mkdirSync(join(cwd, 'node_modules'));
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

test('cli --dry-run exits 0', () => {
  const { source } = fixture();
  const result = spawnSync(process.execPath, [
    join(import.meta.dirname, 'migrateToProjectTree.mjs'), '102047', '--root', source, '--dry-run',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /would clone/);
  assert.match(result.stdout, /leave mls-102056/);
});
