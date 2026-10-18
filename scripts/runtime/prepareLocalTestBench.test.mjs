import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SSH_ALIAS,
  buildManifest,
  hostMain,
  inspectSlot,
  parseArgs,
  publicSummary,
  remoteShellCommand,
  runOnVm,
  sshArgs,
} from './prepareLocalTestBench.mjs';

const SECRET = 'pg-secret-do-not-print';

function mdmFragment() {
  return {
    organizationKey: 'org-bench',
    companyMdmId: 'company-1',
    personas: [
      {
        alias: 'responsavel',
        email: 'responsavel.102047@runtime.test',
        name: 'Bench responsible',
        sub: 'local-test:102047:responsavel',
        personMdmId: 'mdm-r',
      },
      {
        alias: 'membro',
        email: 'membro.102047@runtime.test',
        name: 'Bench member',
        sub: 'local-test:102047:membro',
        personMdmId: 'mdm-m',
      },
    ],
  };
}

function cmFragment() {
  return {
    storagePrefix: 'desenv_',
    personas: [
      { alias: 'responsavel', email: 'responsavel.102047@runtime.test', sub: 'local-test:102047:responsavel', cmUserId: 'cm-r' },
      { alias: 'membro', email: 'membro.102047@runtime.test', sub: 'local-test:102047:membro', cmUserId: 'cm-m' },
    ],
  };
}

function fixture(projectId = '102047', opts = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'bench-'));
  const release = path.join(base, 'releases', '20261018120000');
  mkdirSync(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts'), { recursive: true });
  writeFileSync(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'seedLocalTest.js'), '// seed\n');
  writeFileSync(path.join(release, 'config.json'), JSON.stringify({
    defaultProjectId: opts.defaultProjectId ?? projectId,
    projects: { [projectId]: { type: 'client' }, '102034': { type: 'master backend' } },
  }));
  mkdirSync(path.join(base, 'scripts', 'runtime'), { recursive: true });
  writeFileSync(path.join(base, 'scripts', 'runtime', 'seedLocalTestCm.mjs'), '// cm\n');
  writeFileSync(path.join(base, '.env'), `PGUSER=bench\nPGPASSWORD=${SECRET}\nPGHOST=127.0.0.1\nPGPORT=5432\n`);
  const alias = path.join(base, `current-${projectId}`);
  symlinkSync(release, alias);
  const port = 2000 + Number(projectId.slice(-3));
  mkdirSync(path.join(base, 'pm2.apps.d'), { recursive: true });
  const cwd = opts.cwd ?? alias;
  const slotId = opts.slotId ?? projectId;
  writeFileSync(
    path.join(base, 'pm2.apps.d', `app${port}.config.js`),
    `cwd: ${JSON.stringify(cwd)},\nCOLLAB_PROJECT_ID: ${JSON.stringify(slotId)},\n`,
  );
  const cmRoot = path.join(base, 'cm');
  mkdirSync(cmRoot, { recursive: true });
  return { base, release, alias, cmRoot, port };
}

function spawner(calls, failAt) {
  return (bin, args, opts) => {
    calls.push({ bin, args, cwd: opts.cwd, env: opts.env });
    const joined = JSON.stringify(args);
    if (joined.includes(SECRET) || joined.includes('cookieKey')) {
      throw new Error('seed argv contains a secret');
    }
    if (failAt && calls.length === failAt) return { status: 1, stdout: '', stderr: 'cm down' };
    const fragment = String(args[0]).endsWith('seedLocalTest.js') ? mdmFragment() : cmFragment();
    return { status: 0, stdout: `${JSON.stringify(fragment)}\n`, stderr: '' };
  };
}

test('recusa host, publish e projeto incoerente antes de qualquer ssh', () => {
  assert.throws(() => parseArgs(['--project', '102047', '--runtime-root', '/r', '--cm-root', '/c', '--host', 'evil']), /unknown argument --host/);
  assert.throws(() => parseArgs(['--publish', '--project', '102047', '--runtime-root', '/r', '--cm-root', '/c']), /unknown argument --publish/);
  assert.throws(() => parseArgs(['--project', 'x', '--runtime-root', '/r', '--cm-root', '/c']), /project id/);
  const args = sshArgs('102047', "/tmp/o'brien", '/cm');
  assert.equal(args[0], SSH_ALIAS);
  assert.equal(args.length, 2);
  assert.match(args[1], /LOCAL_TEST_BENCH_ROLE=remote/);
  assert.match(args[1], /'\\''/);
  assert.equal(args[1].includes(SECRET), false);
  assert.equal(remoteShellCommand('102047', '/r', '/c').includes('cookieKey'), false);
});

test('recusa slot e projeto incoerentes antes dos seeds', () => {
  const box = fixture();
  const calls = [];
  writeFileSync(path.join(box.release, 'config.json'), JSON.stringify({
    defaultProjectId: '102056',
    projects: { '102047': { type: 'client' } },
  }));
  assert.throws(() => runOnVm({
    argv: ['--project', '102047', '--runtime-root', box.release, '--cm-root', box.cmRoot],
    spawnSync: spawner(calls),
    manifestDir: path.join(box.base, 'manifests'),
  }), /release config is not project/);
  writeFileSync(path.join(box.release, 'config.json'), JSON.stringify({
    defaultProjectId: '102047',
    projects: { '102047': { type: 'client' } },
  }));
  writeFileSync(
    path.join(box.base, 'pm2.apps.d', 'app2047.config.js'),
    `cwd: ${JSON.stringify(box.alias)},\nCOLLAB_PROJECT_ID: ${JSON.stringify('102056')},\n`,
  );
  assert.throws(() => runOnVm({
    argv: ['--project', '102047', '--runtime-root', box.alias, '--cm-root', box.cmRoot],
    spawnSync: spawner(calls),
    manifestDir: path.join(box.base, 'manifests'),
  }), /slot project/);
  assert.equal(calls.length, 0);
  rmSync(box.base, { recursive: true, force: true });
});

test('falha do cm não publica nem apaga o manifesto anterior', () => {
  const box = fixture();
  const dir = path.join(box.base, 'manifests');
  mkdirSync(dir);
  const file = path.join(dir, '102047.json');
  const previous = `${JSON.stringify({ schema: 1, cookieKey: 'k'.repeat(32), keep: true })}\n`;
  writeFileSync(file, previous);
  const calls = [];
  let caught;
  try {
    runOnVm({
      argv: ['--project', '102047', '--runtime-root', box.alias, '--cm-root', box.cmRoot],
      spawnSync: spawner(calls, 2),
      manifestDir: dir,
    });
  } catch (error) {
    caught = error;
  }
  assert.match(caught.message, /cm down/);
  assert.equal(caught.resume, 'cm');
  assert.equal(calls.length, 2);
  assert.equal(readFileSync(file, 'utf8'), previous);
  assert.equal(JSON.stringify(calls.map((call) => call.args)).includes(SECRET), false);
  assert.match(calls[0].env.DATABASE_URL_TEST, /collab_app_test/);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[1].env, 'DATABASE_URL_TEST'), false);
  rmSync(box.base, { recursive: true, force: true });
});

test('reexecução conserva a chave e a saída não traz cookie nem senha', () => {
  const box = fixture();
  const dir = path.join(box.base, 'manifests');
  const argv = ['--project', '102047', '--runtime-root', box.release, '--cm-root', box.cmRoot];
  const first = runOnVm({ argv, spawnSync: spawner([]), manifestDir: dir, randomBytes: () => Buffer.from('a'.repeat(32)) });
  const saved = JSON.parse(readFileSync(first.manifestFile, 'utf8'));
  assert.equal(saved.schema, 1);
  assert.equal(saved.scope, 'lima');
  assert.equal(saved.cmTarget, 'http://127.0.0.1:8180');
  assert.equal(saved.cmOrgId, 'runtime-test:102047');
  assert.deepEqual(saved.allowedOrigins, [`http://localhost:${box.port}`, `http://127.0.0.1:${box.port}`]);
  assert.equal(saved.personas.responsavel.personMdmId, 'mdm-r');
  assert.equal(saved.personas.membro.cmUserId, 'cm-m');
  assert.ok(Buffer.byteLength(saved.cookieKey) >= 32);
  assert.equal((statSync(first.manifestFile).mode & 0o777), 0o600);
  assert.equal(first.summary.includes(saved.cookieKey), false);
  assert.equal(first.summary.includes(SECRET), false);
  const second = runOnVm({
    argv,
    spawnSync: spawner([]),
    manifestDir: dir,
    randomBytes: () => Buffer.from('b'.repeat(32)),
  });
  const again = JSON.parse(readFileSync(second.manifestFile, 'utf8'));
  assert.equal(again.cookieKey, saved.cookieKey);
  assert.equal(again.personas.responsavel.cmUserId, saved.personas.responsavel.cmUserId);
  assert.throws(() => buildManifest({
    projectId: '102047',
    mdm: mdmFragment(),
    cm: cmFragment(),
    cookieKey: saved.cookieKey,
    origins: ['http://*', `http://127.0.0.1:${box.port}`],
  }), /allowedOrigins/);
  assert.throws(() => publicSummary({ ...saved, organizationKey: 'has-DATABASE_URL' }, first.manifestFile), /leak/);
  rmSync(box.base, { recursive: true, force: true });
});

test('caminho remoto real aguarda o retorno e publica o resumo sem cookie', () => {
  const box = fixture();
  const dir = path.join(box.base, 'manifests');
  mkdirSync(dir);
  const seedJs = path.join(box.release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'seedLocalTest.js');
  writeFileSync(seedJs, `process.stdout.write(${JSON.stringify(`${JSON.stringify(mdmFragment())}\n`)});\n`);
  writeFileSync(
    path.join(box.base, 'scripts', 'runtime', 'seedLocalTestCm.mjs'),
    `process.stdout.write(${JSON.stringify(`${JSON.stringify(cmFragment())}\n`)});\n`,
  );
  const script = new URL('./prepareLocalTestBench.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [
    script,
    '--project', '102047',
    '--runtime-root', box.alias,
    '--cm-root', box.cmRoot,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LOCAL_TEST_BENCH_ROLE: 'remote',
      LOCAL_TEST_BENCH_MANIFEST_DIR: dir,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stderr ?? '').includes('then is not a function'), false);
  assert.match(result.stdout, /^manifest: /);
  assert.equal(result.stdout.includes('cookieKey'), false);
  assert.equal(result.stdout.includes(SECRET), false);
  const saved = JSON.parse(readFileSync(path.join(dir, '102047.json'), 'utf8'));
  assert.equal(saved.personas.responsavel.personMdmId, 'mdm-r');
  assert.equal(saved.personas.membro.cmUserId, 'cm-m');
  assert.equal((statSync(path.join(dir, '102047.json')).mode & 0o777), 0o600);
  rmSync(box.base, { recursive: true, force: true });
});

test('o host só chama ssh lima-ubuntu24 e recusa stdout com cookie', () => {
  let seen;
  hostMain(['--project', '102047', '--runtime-root', '/rel', '--cm-root', '/cm'], (cmd, args) => {
    seen = { cmd, args };
    return { status: 0, stdout: 'manifest: /etc/collab/local-tests/102047.json\nprojectId: 102047\n', stderr: '' };
  });
  assert.equal(seen.cmd, 'ssh');
  assert.equal(seen.args[0], SSH_ALIAS);
  assert.throws(() => hostMain(['--project', '102047', '--runtime-root', '/rel', '--cm-root', '/cm'], () => ({
    status: 0,
    stdout: 'cookieKey=abc\n',
    stderr: '',
  })), /secret/);
});
