import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { dispatch } from './sessionVm.mjs';
import {
  BenchError, PROBE_ACTIVITY_SQL, PROBE_COUNT_SQL, PROBE_DATABASE_SQL, PROBE_DEPENDENTS_SQL, PROBE_SCOPE_SQL, prepareBench, probeWithPg,
} from './prepareBench.mjs';

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
  const resetLine = '##resetLocalDb {"modules":[{"moduleId":"tarefas","tables":1,"seedRows":1}],"seededTables":["schema_seed"],"database":"collab_app_test"}\\n';
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'resetLocalDb.js'), options.resetBody ?? `process.stdout.write('${resetLine}'); process.exit(0);\n`);
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
    const stdout = cmd === 'pm2' && args[0] === 'jlist' ? jlistOnline([{ count: '1' }]) : '';
    return { status: 0, stdout, stderr: '' };
  };
}

function jlistOnline(workers, extraEnv = {}) {
  return JSON.stringify(workers.map((worker, index) => ({
    name: worker.name ?? 'app2047',
    pid: worker.pid ?? 4000 + index,
    pm2_env: {
      status: worker.status ?? 'online',
      COLLAB_WORKER_COUNT: worker.count,
      DATABASE_URL_TEST: SECRET_URL,
      cookieKey: 'super-secret-cookie-value',
      ...extraEnv,
    },
  })));
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

test('migrate uses the verified release and restarts only app2047', async () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const envBefore = readFileSync(path.join(tree.remote, '.env'), 'utf8');
  const otherBefore = readFileSync(path.join(tree.remote, 'pm2.apps.d', 'app2043.config.js'), 'utf8');
  const box = harness(tree, logFile);
  const receipt = await box.run('migrate');
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
  assert.deepEqual(log.filter((row) => row.cmd === 'pm2').map((row) => row.args[0]), ['stop', 'restart', 'jlist']);
  assert.equal(log.filter((row) => row.cmd === 'pm2' && row.args[0] !== 'jlist').every((row) => row.args.join(' ').includes('app2047') && !row.args.join(' ').includes('2043')), true);
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
  assert.deepEqual(receipt.workflowMemory, {
    scope: 'process',
    workers: 1,
    restartLosesOccurrences: true,
    cmIntegrated: false,
  });
  assert.equal(JSON.stringify(receipt).includes('bench_secret'), false);
});

test('reset is a different script and checks scope after ddl', async () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  const receipt = await box.run('reset');
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

test('reuses a proven migrate of the same artifact', async () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  const script = path.join(tree.release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'migrate.js');
  const receipt = await box.run('migrate', {
    priorMigrate: { ok: true, script, database: 'collab_app_test', projectId: '102047' },
  });
  assert.equal(receipt.migrate.reused, true);
  assert.equal(receipt.migrate.executed, false);
  const reusedLog = readLog(logFile);
  assert.equal(reusedLog.some((row) => String(row.args?.[0] || '').includes('migrate.js')), false);
  assert.deepEqual(reusedLog.filter((row) => row.cmd === 'pm2').map((row) => row.args[0]), ['jlist']);
  assert.equal(box.order.includes('seed'), true);
});

test('refuses a shared or unknown consumer before ddl', async () => {
  const shared = benchTree({ shared: true });
  const logFile = path.join(shared.root, 'log.ndjson');
  const box = harness(shared, logFile);
  await assert.rejects(() => box.run('reset'), (error) => {
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
  await assert.rejects(() => boxUnknown.run('reset'), /unknown|migrate remains available/);
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
  await assert.rejects(() => boxDeps.run('reset'), /unknown/);
  assert.equal(readLog(logDeps).length, 0);
});

test('a failed reset after ddl stays failed and does not restart the app', async () => {
  const tree = benchTree({
    resetBody: 'console.error("ddl started"); process.exit(1);\n',
  });
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  await assert.rejects(() => box.run('reset'), (error) => {
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

test('vm stdin refuses a missing operation before any ddl', () => {
  const tree = benchTree({
    resetBody: 'require("fs").writeFileSync(process.env.BENCH_DDL_MARKER, "ran\\n"); process.exit(0);\n',
  });
  const marker = path.join(tree.root, 'ddl-ran');
  const child = spawnSync(process.execPath, [new URL('./prepareBench.mjs', import.meta.url).pathname], {
    input: JSON.stringify({
      db: 'reset',
      projectId: '102047',
      runtimeRoot: tree.release,
      cmRoot: tree.cm,
    }),
    encoding: 'utf8',
    env: { ...process.env, BENCH_DDL_MARKER: marker },
  });
  assert.notEqual(child.status, 0);
  const body = JSON.parse(child.stdout);
  assert.equal(body.code, 'operation');
  assert.equal(body.ready, false);
  assert.equal(existsSync(marker), false);
});

test('the real session lock is awaited before ddl', async () => {
  const tree = benchTree({
    resetBody: 'require("fs").writeFileSync(process.env.BENCH_DDL_MARKER, "ran\\n"); process.exit(0);\n',
  });
  const lockPath = path.join(tree.root, 'lima.lock');
  const marker = path.join(tree.root, 'ddl-ran');
  const acquired = await dispatch({
    op: 'acquire', session: 'rt89-r3', projectId: '102047', origin: 'test', lockPath,
  });
  const begun = await dispatch({
    op: 'beginOperation', ownerId: acquired.ownerId, name: 'bench', phase: 'preparing', lockPath,
  });
  let probed = false;
  await prepareBench({
    db: 'migrate',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: { ownerId: acquired.ownerId, operationId: begun.operationId, lockPath },
    probe: () => { probed = true; return { currentDatabase: 'collab_app_test', activity: [], externalDependents: [] }; },
    spawnSync: (cmd, args, opts) => {
      if (cmd === 'pm2' && args[0] === 'jlist') return { status: 0, stdout: jlistOnline([{ count: '1' }]), stderr: '' };
      if (cmd === 'pm2') return { status: 0, stdout: '', stderr: '' };
      return spawnSync(cmd, args, opts);
    },
    runSeed: () => ({ manifest: manifest(), manifestFile: 'manifest.json' }),
    health: () => ({ ok: true }),
    waitHook: () => {},
  });
  assert.equal(probed, true);
  assert.equal(existsSync(marker), false);

  let refusedProbe = false;
  await assert.rejects(() => prepareBench({
    db: 'reset',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: { ownerId: 'cd'.repeat(16), operationId: begun.operationId, lockPath },
    probe: () => { refusedProbe = true; },
    spawnSync: () => { throw new Error('ddl'); },
  }), /not registered/);
  assert.equal(refusedProbe, false);

  const bare = path.join(tree.root, 'empty.lock');
  await assert.rejects(() => prepareBench({
    db: 'reset',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: { ownerId: acquired.ownerId, operationId: begun.operationId, lockPath: bare },
    probe: () => { refusedProbe = true; },
    spawnSync: () => { throw new Error('ddl'); },
  }), /not registered/);
  assert.equal(refusedProbe, false);
  assert.equal(existsSync(marker), false);
});

test('a reset without the summary line stays failed after ddl', async () => {
  const tree = benchTree({ resetBody: 'process.stdout.write("done\\n"); process.exit(0);\n' });
  const logFile = path.join(tree.root, 'log.ndjson');
  const box = harness(tree, logFile);
  await assert.rejects(() => box.run('reset'), (error) => {
    assert.equal(error.receipt.phase, 'failed');
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.ddlStarted, true);
    assert.match(error.message, /summary line/);
    return true;
  });
  assert.equal(box.order.includes('seed'), false);
  assert.equal(box.order.includes('probe:after'), false);
});

test('an unregistered operation is refused before the probe', async () => {
  const tree = benchTree();
  let probed = false;
  await assert.rejects(() => prepareBench({
    db: 'reset',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: { ownerId: 'ab'.repeat(16), operationId: 'missing', lockPath: path.join(tree.root, 'lima.lock') },
    probe: () => { probed = true; },
    spawnSync: () => { throw new Error('ddl'); },
  }), /not registered/);
  assert.equal(probed, false);
});

test('seed writes the manifest through the real runOnVm fs', async () => {
  const tree = benchTree();
  const manifestDir = path.join(tree.root, 'manifests');
  const mdm = {
    organizationKey: 'org-bench',
    companyMdmId: 'company-1',
    personas: [
      { alias: 'responsavel', email: 'responsavel.102047@runtime.test', name: 'Bench responsible', sub: 'local-test:102047:responsavel', personMdmId: 'mdm-r' },
      { alias: 'membro', email: 'membro.102047@runtime.test', name: 'Bench member', sub: 'local-test:102047:membro', personMdmId: 'mdm-m' },
    ],
  };
  const cm = {
    storagePrefix: 'desenv_',
    personas: [
      { alias: 'responsavel', email: 'responsavel.102047@runtime.test', sub: 'local-test:102047:responsavel', cmUserId: 'cm-r' },
      { alias: 'membro', email: 'membro.102047@runtime.test', sub: 'local-test:102047:membro', cmUserId: 'cm-m' },
    ],
  };
  const receipt = await prepareBench({
    db: 'migrate',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    manifestDir,
    probe: () => ({ currentDatabase: 'collab_app_test', activity: [], externalDependents: [] }),
    waitHook: () => {},
    health: () => ({ ok: true }),
    spawnSync: (cmd, args = [], opts = {}) => {
      if (cmd === 'pm2' && args[0] === 'jlist') return { status: 0, stdout: jlistOnline([{ count: '1' }]), stderr: '' };
      if (cmd === 'pm2') return { status: 0, stdout: '', stderr: '' };
      const script = String(args[0] ?? '');
      if (script.endsWith('seedLocalTest.js')) return { status: 0, stdout: `${JSON.stringify(mdm)}\n`, stderr: '' };
      if (script.endsWith('seedLocalTestCm.mjs')) return { status: 0, stdout: `${JSON.stringify(cm)}\n`, stderr: '' };
      return spawnSync(cmd, args, { ...opts, encoding: 'utf8' });
    },
  });
  const file = path.join(manifestDir, '102047.json');
  assert.equal(existsSync(file), true);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.companyMdmId, 'company-1');
  assert.equal(saved.personas.responsavel.personMdmId, 'mdm-r');
  assert.equal(saved.personas.membro.cmUserId, 'cm-m');
  assert.equal(receipt.seed.manifestFile, file);
  assert.equal(JSON.stringify(receipt).includes('cookie'), false);
});

function fakePg(script) {
  const seen = [];
  return {
    seen,
    async query(sql, params) {
      seen.push(sql);
      if (/insert|update|delete|drop|truncate|alter/iu.test(sql)) throw new Error('probe wrote');
      return script(sql, params);
    },
  };
}

test('pg probe reads counts and does not invent a cleared scope', async () => {
  const client = fakePg((sql) => {
    if (sql === PROBE_DATABASE_SQL) return { rows: [{ current_database: 'collab_app_test' }] };
    if (sql === PROBE_ACTIVITY_SQL) return { rows: [{ application_name: 'other', client_addr: '127.0.0.1/32', datname: 'collab_app_test' }] };
    if (sql === PROBE_SCOPE_SQL) return { rows: [{ name: 'tarefas_task' }, { name: 'schema_seed' }] };
    if (sql === PROBE_DEPENDENTS_SQL) return { rows: [{ name: 'outside_view', kind: 'v', on_table: 'tarefas_task' }] };
    if (sql === PROBE_COUNT_SQL) return { rows: [{ name: 'tarefas_task', n: 4 }, { name: 'schema_seed', n: 0 }] };
    throw new Error(`unexpected sql ${sql}`);
  });
  const dirty = await probeWithPg(client, { phase: 'after', seedTables: ['schema_seed'] });
  assert.equal(dirty.currentDatabase, 'collab_app_test');
  assert.equal(dirty.activity[0].applicationName, 'other');
  assert.equal(dirty.activity[0].clientAddr, '127.0.0.1/32');
  assert.equal(dirty.externalDependents[0].name, 'outside_view');
  assert.equal(dirty.scopeCleared, false);
  assert.equal(dirty.seedsOk, false);
  const clean = fakePg((sql) => {
    if (sql === PROBE_DATABASE_SQL) return { rows: [{ current_database: 'collab_app_test' }] };
    if (sql === PROBE_ACTIVITY_SQL) return { rows: [] };
    if (sql === PROBE_SCOPE_SQL) return { rows: [{ name: 'tarefas_task' }, { name: 'schema_seed' }] };
    if (sql === PROBE_DEPENDENTS_SQL) return { rows: [] };
    if (sql === PROBE_COUNT_SQL) return { rows: [{ name: 'tarefas_task', n: 0 }, { name: 'schema_seed', n: 1 }] };
    throw new Error(`unexpected sql ${sql}`);
  });
  const after = await probeWithPg(clean, { phase: 'after', seedTables: ['schema_seed'] });
  assert.equal(after.scopeCleared, true);
  assert.equal(after.seedsOk, true);
  assert.equal(client.seen.some((sql) => /insert|update|delete|drop/iu.test(sql)), false);
});

test('receipt waits for one online worker and count 1', async () => {
  const tree = benchTree();
  const logFile = path.join(tree.root, 'log.ndjson');
  const two = harness(tree, logFile, {});
  const spawnTwo = (cmd, args = [], opts = {}) => {
    const recorded = recordingSpawn(logFile)(cmd, args, opts);
    if (cmd === 'pm2' && args[0] === 'jlist') {
      return { status: 0, stdout: jlistOnline([{ count: '1' }, { count: '1', pid: 4002 }]), stderr: '' };
    }
    return recorded;
  };
  await assert.rejects(() => two.run('migrate', { spawnSync: spawnTwo }), (error) => {
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.retainLock, true);
    assert.equal(error.receipt.workflowMemory.workers, 2);
    assert.equal(error.receipt.workflowMemory.cmIntegrated, false);
    assert.equal(JSON.stringify(error.receipt).includes(SECRET_URL), false);
    assert.equal(JSON.stringify(error.receipt).includes('cookie'), false);
    return true;
  });

  const missing = harness(benchTree(), path.join(tree.root, 'missing.ndjson'));
  await assert.rejects(() => missing.run('migrate', {
    spawnSync: (cmd, args = [], opts = {}) => {
      if (cmd === 'pm2' && args[0] === 'jlist') {
        return { status: 0, stdout: jlistOnline([{ count: undefined }]), stderr: '' };
      }
      if (cmd === 'pm2') return { status: 0, stdout: '', stderr: '' };
      return spawnSync(cmd, args, opts);
    },
  }), (error) => {
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.retainLock, true);
    assert.deepEqual(error.receipt.workflowMemory.counts, [null]);
    assert.equal(JSON.stringify(error.receipt).includes('bench_secret'), false);
    return true;
  });
});

test('receipt stays free of the database url', () => {
  const source = readFileSync(new URL('./prepareBench.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('DROP DATABASE'), false);
  assert.equal(source.includes('DROP SCHEMA'), false);
  assert.equal(source.includes('TRUNCATE'), false);
});
