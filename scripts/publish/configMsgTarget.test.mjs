import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeTarget, parseArgs, rewriteEnvContent, vmScript } from './configMsgTarget.mjs';

test('normalizeTarget keeps the origin only', () => {
  assert.equal(normalizeTarget('https://102047.collabcodes.com/'), 'https://102047.collabcodes.com');
  assert.equal(normalizeTarget('http://127.0.0.1:8180'), 'http://127.0.0.1:8180');
  assert.equal(normalizeTarget('https://host/msg'), null);
  assert.equal(normalizeTarget('ftp://host'), null);
  assert.equal(normalizeTarget('102047.collabcodes.com'), null);
});

test('parseArgs: target, --unset, --dry-run', () => {
  assert.deepEqual(parseArgs(['https://a.com', '--dry-run']), { ok: true, target: 'https://a.com', dryRun: true });
  assert.deepEqual(parseArgs(['--unset']), { ok: true, target: null, dryRun: false });
  assert.equal(parseArgs([]).ok, false);
  assert.equal(parseArgs(['--unset', 'https://a.com']).ok, false);
  assert.equal(parseArgs(['https://a.com', '--force']).ok, false);
});

test('rewriteEnvContent replaces, appends and unsets the line', () => {
  assert.equal(rewriteEnvContent('A=1\n', 'https://x.com'), 'A=1\nMSG_PROXY_TARGET=https://x.com\n');
  assert.equal(
    rewriteEnvContent('MSG_PROXY_TARGET=https://old.com\nA=1\nexport MSG_PROXY_TARGET=y\n', 'https://x.com'),
    'A=1\nMSG_PROXY_TARGET=https://x.com\n',
  );
  assert.equal(rewriteEnvContent('A=1\nMSG_PROXY_TARGET=https://x.com\n', null), 'A=1\n');
  assert.equal(rewriteEnvContent('A=1', 'https://x.com'), 'A=1\nMSG_PROXY_TARGET=https://x.com\n');
});

test('vmScript rewrites base + app cwd .env and reloads online apps only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'configMsgTarget-'));
  const base = join(dir, 'mls-base');
  const release = join(base, 'current-1');
  mkdirSync(release, { recursive: true });
  writeFileSync(join(base, '.env'), 'A=1\n');
  writeFileSync(join(release, '.env'), 'A=1\nMSG_PROXY_TARGET=https://old.com\n');

  // Fake pm2: jlist prints two apps, reload is logged.
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const apps = JSON.stringify([
    { name: 'app1', pm2_env: { status: 'online', pm_cwd: release } },
    { name: 'app2', pm2_env: { status: 'errored', pm_cwd: join(base, 'current-2') } },
    { name: 'other', pm2_env: { status: 'online', pm_cwd: '/elsewhere' } },
  ]);
  writeFileSync(join(bin, 'pm2'), `#!/bin/sh\nif [ "$1" = jlist ]; then echo '${apps}'; else echo "$@" >> '${join(dir, 'pm2.log')}'; fi\n`);
  chmodSync(join(bin, 'pm2'), 0o755);

  const run = spawnSync('node', ['-', base, 'https://x.com', '0'], {
    input: vmScript(),
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.deepEqual(report.changed, [join(base, '.env'), join(release, '.env')]);
  assert.deepEqual(report.missing, [join(base, 'current-2', '.env')]);
  assert.deepEqual(report.reloaded, ['app1']);
  assert.deepEqual(report.skipped, ['app2 (errored)']);
  assert.equal(readFileSync(join(release, '.env'), 'utf8'), 'A=1\nMSG_PROXY_TARGET=https://x.com\n');
  assert.equal(readFileSync(join(dir, 'pm2.log'), 'utf8'), 'reload app1\n');
});
