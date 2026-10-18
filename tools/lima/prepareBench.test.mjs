import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareBench, BenchError } from './prepareBench.mjs';

const SECRET_URL = 'postgres://bench_user:bench_secret@127.0.0.1:5432/collab_app_test';

function write(file, body) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function benchTree(options = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'prepare-bench-'));
  const remote = path.join(root, 'vm');
  const release = path.join(remote, 'releases', 'rel-a');
  const cm = path.join(root, 'cm');
  write(path.join(remote, '.env'), 'PGUSER=bench_user\nPGPASSWORD=bench_secret\nPGHOST=127.0.0.1\nPGPORT=5432\n');
  write(path.join(remote, 'mls-102047', 'l5', 'project.json'), JSON.stringify({ appEnv: 'development' }));
  write(path.join(remote, 'scripts', 'runtime', 'seedLocalTestCm.mjs'), 'process.exit(0)\n');
  const cwdLine = `  cwd: ${JSON.stringify(release)},\n`;
  const env2047 = options.omitTestUrl
    ? '    COLLAB_PROJECT_ID: "102047"\n'
    : '    COLLAB_PROJECT_ID: "102047",\n    DATABASE_URL_TEST: "(function () { return \'\'; })()"\n';
  write(path.join(remote, 'pm2.apps.d', 'app2047.config.js'), `module.exports = {\n${cwdLine}  env: {\n${env2047}  }\n};\n`);
  const other = options.shared
    ? '    COLLAB_PROJECT_ID: "102043",\n    DATABASE_URL_TEST: "(function () { return \'\'; })()"\n'
    : '    COLLAB_PROJECT_ID: "102043"\n';
  write(path.join(remote, 'pm2.apps.d', 'app2043.config.js'), `module.exports = {\n  cwd: "/data/other",\n  env: {\n${other}  }\n};\n`);
  write(path.join(remote, 'pm2.apps.d', 'app2052.config.js'), 'module.exports = {\n  cwd: "/data/other2",\n  env: {\n    COLLAB_PROJECT_ID: "102052"\n  }\n};\n');
  write(path.join(release, 'config.json'), JSON.stringify({
    defaultProjectId: '102047',
    projects: { 102047: { type: 'client' }, 102034: { type: 'master backend' } },
  }));
  write(path.join(release, 'release.json'), JSON.stringify({
    id: 'rel-a', client: '102047', versionRef: 'abc', platformCommit: 'def', libs: 'pin', monaco: '1',
  }));
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'migrate.js'), 'process.exit(0)\n');
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'resetLocalDb.js'), options.resetBody ?? 'process.exit(0)\n');
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'seedLocalTest.js'), 'process.exit(0)\n');
  write(path.join(cm, 'history.txt'), 'cm-history-kept\n');
  return { root, remote, release, cm };
}

function recordingSpawn(logFile) {
  return (cmd, args = [], opts = {}) => {
    const record = spawnSync(process.execPath, ['-e', `
      const fs = require('fs');
      const log = process.argv[1];
      const cmd = process.argv[2];
      const args = process.argv.slice(3);
      fs.appendFileSync(log, JSON.stringify({
        cmd, args, cwd: process.cwd(),
        project: process.env.COLLAB_PROJECT_ID || '',
        hasUrl: Boolean(process.env.DATABASE_URL_TEST),
      }) + '\\n');
    `, logFile, cmd, ...args], {
      cwd: opts.cwd,
      env: opts.env,
      encoding: 'utf8',
    });
    if (record.status !== 0) return record;
    if (cmd === process.execPath) {
      return spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env, encoding: 'utf8' });
    }
    return { status: 0, stdout: '', stderr: '' };
  };
}

function readLog(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function manifest() {
  return {
    companyMdmId: 'co-1',
    organizationKey: 'org-1',
    cookieKey: 'super-secret-cookie-value',
    personas: {
      responsavel: { email: 'responsavel.102047@runtime.test', sub: 'local-test:102047:responsavel', personMdmId: 'p-r', cmUserId: 'cm-r' },
      membro: { email: 'membro.102047@runtime.test', sub: 'local-test:102047:membro', personMdmId: 'p-m', cmUserId: 'cm-m' },
    },
  };
}

function harness(tree, logFile, extras = {}) {
  const order = [];
  const seedArgv = [];
  const probe = (call) => {
    order.push(`probe:${call.phase}`);
    if (extras.probe) return extras.probe(call);
    if (call.phase === 'after') {
      return { currentDatabase: 'collab_app_test', scopeCleared: true, seedsOk: true, activity: [], externalDependents: [] };
    }
    return { currentDatabase: 'collab_app_test', activity: [], externalDependents: [] };
  };
  return {
    order,
    seedArgv,
    run(db, more = {}) {
      return prepareBench({
        db,
        runtimeRoot: tree.release,
        cmRoot: tree.cm,
        fs: undefined,
        spawnSync: recordingSpawn(logFile),
        probe,
        waitHook: () => { order.push('hook'); },
        pm2: undefined,
        runSeed: (info) => {
          order.push('seed');
          seedArgv.push(info.argv);
          const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { encoding: 'utf8' });
          assert.equal(child.status, 0);
          return { manifestFile: '/etc/collab/local-tests/102047.json', manifest: manifest() };
        },
        health: () => { order.push('health'); return { ok: true, release: { id: 'rel-a' } }; },
        ...more,
      });
    },
  };
}

test('migrate uses the verified release and restarts only app2047', () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const envBefore = readFileSync(path.join(tree.remote, '.env'), 'utf8');
  const otherBefore = readFileSync(path.join(tree.remote, 'pm2.apps.d', 'app2043.config.js'), 'utf8');
  const box = harness(tree, logFile);
  const receipt = box.run('migrate');
  const log = readLog(logFile);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.phase, 'ready');
  assert.equal(receipt.migrate.executed, true);
  assert.equal(receipt.reset, null);
  assert.equal(receipt.database, 'collab_app_test');
  assert.equal(receipt.stoppedOnly, 'app2047');
  const node = log.find((row) => row.cmd === process.execPath);
  assert.equal(node.args[0], realpathSync(path.join(tree.release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'migrate.js')));
  assert.equal(node.cwd, realpathSync(tree.release));
  assert.equal(node.project, '102047');
  assert.equal(node.hasUrl, true);
  assert.equal(JSON.stringify(log).includes('resetLocalDb'), false);
  assert.deepEqual(log.filter((row) => row.cmd === 'pm2').map((row) => row.args[0]), ['stop', 'restart']);
  assert.equal(log.filter((row) => row.cmd === 'pm2').every((row) => row.args.join(' ').includes('app2047') && !row.args.join(' ').includes('2043')), true);
  assert.equal(box.order.indexOf('seed') > box.order.indexOf('probe:before'), true);
  assert.ok(box.seedArgv[0].includes('--member-role'));
  assert.ok(box.seedArgv[0].includes('tarefas.MembroEquipe'));
  assert.equal(receipt.seed.companyMdmId, 'co-1');
  assert.equal(receipt.seed.personas.membro.cmUserId, 'cm-m');
  assert.equal(JSON.stringify(receipt).includes('cookie'), false);
  assert.equal(JSON.stringify(receipt).includes(SECRET_URL), false);
  assert.equal(readFileSync(path.join(tree.cm, 'history.txt'), 'utf8'), 'cm-history-kept\n');
  assert.equal(readFileSync(path.join(tree.remote, '.env'), 'utf8'), envBefore);
  assert.equal(readFileSync(path.join(tree.remote, 'pm2.apps.d', 'app2043.config.js'), 'utf8'), otherBefore);
  assert.equal(receipt.cm.historyPreserved, true);
});

test('reset is a different script and checks scope after ddl', () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  const receipt = box.run('reset');
  const log = readLog(logFile);
  const scripts = log.filter((row) => row.cmd === process.execPath).map((row) => row.args[0]);
  assert.equal(scripts.length, 1);
  assert.equal(path.basename(scripts[0]), 'resetLocalDb.js');
  assert.equal(log.find((row) => row.cmd === process.execPath).cwd, realpathSync(tree.release));
  assert.equal(receipt.migrate.executed, false);
  assert.equal(receipt.reset.scopeCleared, true);
  assert.equal(receipt.reset.seedsOk, true);
  assert.equal(box.order.indexOf('seed') > box.order.indexOf('probe:after'), true);
});

test('reuses a proven migrate of the same artifact', () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  const script = path.join(tree.release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'migrate.js');
  const receipt = box.run('migrate', {
    priorMigrate: { ok: true, script, database: 'collab_app_test', projectId: '102047' },
  });
  assert.equal(receipt.migrate.reused, true);
  assert.equal(receipt.migrate.executed, false);
  const reusedLog = readLog(logFile);
  assert.equal(reusedLog.some((row) => String(row.args?.[0] || '').includes('migrate.js')), false);
  assert.equal(reusedLog.some((row) => row.cmd === 'pm2'), false);
  assert.equal(box.order.includes('seed'), true);
});

test('refuses a shared or unknown consumer before ddl', () => {
  const shared = benchTree({ shared: true });
  const logFile = path.join(shared.root, 'log.ndjson');
  const box = harness(shared, logFile);
  assert.throws(() => box.run('reset'), (error) => {
    assert.equal(error instanceof BenchError, true);
    assert.equal(error.receipt.ddlStarted, false);
    assert.equal(error.receipt.reset.refused, true);
    assert.match(error.message, /migrate remains available/);
    return true;
  });
  assert.equal(readLog(logFile).length, 0);

  const unknown = benchTree();
  const logUnknown = path.join(unknown.root, 'log.ndjson');
  const boxUnknown = harness(unknown, logUnknown, {
    probe: () => ({ currentDatabase: 'collab_app_test', activity: [{ datname: 'collab_app_test' }], externalDependents: [] }),
  });
  assert.throws(() => boxUnknown.run('reset'), /unknown|migrate remains available/);
  assert.equal(readLog(logUnknown).length, 0);

  const dependents = benchTree();
  const logDeps = path.join(dependents.root, 'log.ndjson');
  const boxDeps = harness(dependents, logDeps, {
    probe: () => ({
      currentDatabase: 'collab_app_test',
      activity: [],
      externalDependents: undefined,
    }),
  });
  assert.throws(() => boxDeps.run('reset'), /unknown/);
  assert.equal(readLog(logDeps).length, 0);
});

test('a failed reset after ddl stays failed and does not restart the app', () => {
  const tree = benchTree({
    resetBody: 'console.error("ddl started"); process.exit(1);\n',
  });
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  assert.throws(() => box.run('reset'), (error) => {
    assert.equal(error instanceof BenchError, true);
    assert.equal(error.receipt.phase, 'failed');
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.retainLock, true);
    assert.equal(error.receipt.ddlStarted, true);
    assert.equal(error.receipt.cm.historyPreserved, true);
    return true;
  });
  const log = readLog(logFile);
  assert.equal(log.some((row) => row.args[0] === 'stop'), true);
  assert.equal(log.some((row) => row.args[0] === 'restart'), false);
  assert.equal(box.order.includes('seed'), false);
  assert.equal(readFileSync(path.join(tree.cm, 'history.txt'), 'utf8'), 'cm-history-kept\n');
  assert.equal(JSON.stringify(log).includes('2043'), false);
});

test('receipt stays free of the database url', () => {
  const source = readFileSync(new URL('./prepareBench.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('DROP DATABASE'), false);
  assert.equal(source.includes('DROP SCHEMA'), false);
  assert.equal(source.includes('TRUNCATE'), false);
});
