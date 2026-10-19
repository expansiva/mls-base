import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { inspectSlot } from '../../scripts/runtime/prepareLocalTestBench.mjs';
import { dispatch } from './sessionVm.mjs';
import { prepareBench, main } from './prepareBench.mjs';

const SECRET_URL = 'postgres://bench_user:bench_secret@127.0.0.1:5432/collab_app_test';

function write(file, body) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function benchTree() {
  const root = mkdtempSync(path.join(tmpdir(), 'prepare-bench-health-'));
  const remote = path.join(root, 'vm');
  const release = path.join(remote, 'releases', 'rel-a');
  const cm = path.join(root, 'cm');
  write(path.join(remote, '.env'), 'PGUSER=bench_user\nPGPASSWORD=bench_secret\nPGHOST=127.0.0.1\nPGPORT=5432\n');
  write(path.join(remote, 'mls-102047', 'l5', 'project.json'), JSON.stringify({ appEnv: 'development' }));
  write(path.join(remote, 'scripts', 'runtime', 'seedLocalTestCm.mjs'), 'process.exit(0)\n');
  write(path.join(remote, 'pm2.apps.d', 'app2047.config.js'), `module.exports = {\n  cwd: ${JSON.stringify(release)},\n  env: {\n    COLLAB_PROJECT_ID: "102047",\n    DATABASE_URL_TEST: "(function () { return ''; })()"\n  }\n};\n`);
  write(path.join(remote, 'pm2.apps.d', 'app2043.config.js'), 'module.exports = {\n  cwd: "/data/other",\n  env: {\n    COLLAB_PROJECT_ID: "102043"\n  }\n};\n');
  write(path.join(remote, 'pm2.apps.d', 'app2052.config.js'), 'module.exports = {\n  cwd: "/data/other2",\n  env: {\n    COLLAB_PROJECT_ID: "102052"\n  }\n};\n');
  write(path.join(release, 'config.json'), JSON.stringify({
    defaultProjectId: '102047',
    projects: { 102047: { type: 'client' }, 102034: { type: 'master backend' } },
  }));
  write(path.join(release, 'release.json'), JSON.stringify({
    id: 'rel-a', client: '102047', versionRef: 'abc', platformCommit: 'def', libs: 'pin', monaco: '1',
  }));
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'migrate.js'), 'process.exit(0)\n');
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'resetLocalDb.js'), 'process.exit(0)\n');
  write(path.join(release, 'dist', 'local', '_102034_', 'l1', 'scripts', 'seedLocalTest.js'), 'process.exit(0)\n');
  write(path.join(cm, 'history.txt'), 'cm-history-kept\n');
  return { root, remote, release, cm };
}

function jlistOnline() {
  return JSON.stringify([0, 1].map((index) => ({
    name: 'app2047',
    pid: 4000 + index,
    pm2_env: {
      status: 'online',
      COLLAB_WORKER_COUNT: '2',
      DATABASE_URL_TEST: SECRET_URL,
      cookieKey: 'super-secret-cookie-value',
    },
  })));
}

function recordingSpawn(logFile) {
  return (cmd, args = [], opts = {}) => {
    const record = spawnSync(process.execPath, ['-e', `
      const fs = require('fs');
      const log = process.argv[1];
      const cmd = process.argv[2];
      const args = process.argv.slice(3);
      fs.appendFileSync(log, JSON.stringify({ cmd, args }) + '\\n');
    `, logFile, cmd, ...args], { cwd: opts.cwd, env: opts.env, encoding: 'utf8' });
    if (record.status !== 0) return record;
    if (cmd === process.execPath) return spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env, encoding: 'utf8' });
    const stdout = cmd === 'pm2' && args[0] === 'jlist' ? jlistOnline() : '';
    return { status: 0, stdout, stderr: '' };
  };
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

function probe() {
  return { currentDatabase: 'collab_app_test', scopeCleared: true, seedsOk: true, activity: [], externalDependents: [] };
}

function edges(tree) {
  const logFile = path.join(tree.root, 'log.ndjson');
  return {
    spawnSync: recordingSpawn(logFile),
    probe: () => probe(),
    waitHook: () => {},
    runSeed: () => ({ manifestFile: path.join(tree.root, 'manifest.json'), manifest: manifest() }),
  };
}

function stdinOf(text) {
  return Readable.from(text === undefined ? [] : [Buffer.from(text)]);
}

function capture() {
  const chunks = [];
  return {
    write(value) { chunks.push(String(value)); },
    text() { return chunks.join(''); },
  };
}

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

// A failed assertion must not leave the listener open and hang the runner.
function stopServer(server) {
  server.closeAllConnections();
  if (server.listening) server.close();
}

async function reserve(tree) {
  const lockPath = path.join(tree.root, 'lima.lock');
  const acquired = await dispatch({
    op: 'acquire', session: 'rt97-s2', projectId: '102047', origin: 'test', lockPath,
  });
  const begun = await dispatch({
    op: 'beginOperation', ownerId: acquired.ownerId, name: 'bench', phase: 'preparing', lockPath,
  });
  return { lockPath, ownerId: acquired.ownerId, operationId: begun.operationId };
}

function commandOf(tree, reservation, extra = {}) {
  return JSON.stringify({
    db: 'migrate',
    projectId: '102047',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: {
      ownerId: reservation.ownerId,
      operationId: reservation.operationId,
      lockPath: reservation.lockPath,
    },
    ...extra,
  });
}

function forwardingFetch(port, hits) {
  return async (url, init) => {
    hits.push(String(url));
    const target = new URL(String(url));
    target.protocol = 'http:';
    target.hostname = '127.0.0.1';
    target.port = String(port);
    return fetch(target, init);
  };
}

test('main keeps the stdin protocol and ignores health fields in the command', async () => {
  const stderr = capture();
  const empty = await main({ stdin: stdinOf(''), stdout: capture(), stderr, prepare: () => { throw new Error('prepare ran'); } });
  assert.equal(empty, 2);
  assert.match(stderr.text(), /JSON command on stdin/);

  const badOut = capture();
  const bad = await main({ stdin: stdinOf('{'), stdout: badOut, stderr: capture() });
  assert.equal(bad, 2);
  assert.deepEqual(JSON.parse(badOut.text()), { ok: false, ready: false, code: 'bad-json' });

  let called = false;
  const missingOut = capture();
  const missing = await main({
    stdin: stdinOf(JSON.stringify({ db: 'migrate', health: { ok: true } })),
    stdout: missingOut,
    stderr: capture(),
    prepare: () => { called = true; },
  });
  assert.equal(missing, 1);
  assert.equal(called, false);
  assert.equal(JSON.parse(missingOut.text()).code, 'operation');
});

test('main probes the slot health URL through a real server and does not invent a release', async (t) => {
  const tree = benchTree();
  const reservation = await reserve(tree);
  const slot = inspectSlot(tree.release, '102047', { existsSync, readFileSync, realpathSync });
  let releaseResponse;
  const held = new Promise((resolve) => { releaseResponse = resolve; });
  let requests = 0;
  const server = await listen(async (req, res) => {
    requests += 1;
    assert.equal(req.url, '/health');
    assert.equal(req.headers.cookie, undefined);
    assert.equal(req.headers.authorization, undefined);
    await held;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  t.after(() => stopServer(server));
  const hits = [];
  let settled = false;
  const stdout = capture();
  const pending = main({
    stdin: stdinOf(commandOf(tree, reservation, { health: { ok: true }, fetchImpl: 'skip' })),
    stdout,
    stderr: capture(),
    prepare: (input) => {
      assert.equal(input.health, undefined);
      assert.equal(input.fetchImpl, undefined);
      return prepareBench({
        ...input,
        ...edges(tree),
        fetchImpl: forwardingFetch(server.address().port, hits),
      });
    },
  }).then((code) => {
    settled = true;
    return code;
  });
  const started = Date.now();
  while (requests === 0 && Date.now() - started < 3000) {
    assert.equal(settled, false);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  try {
    assert.equal(settled, false);
    assert.equal(requests, 1);
    assert.deepEqual(hits, [`http://127.0.0.1:${slot.port}/health`]);
  } finally {
    releaseResponse();
  }
  const code = await pending;
  await closeServer(server);
  assert.equal(code, 0);
  const body = JSON.parse(stdout.text());
  assert.equal(body.ready, true);
  assert.equal(body.healthOk, true);
  assert.equal(body.observedRelease, null);
  assert.equal(body.release.id, 'rel-a');
  assert.equal(existsSync(reservation.lockPath), true);
  assert.match(readFileSync(reservation.lockPath, 'utf8'), new RegExp(reservation.ownerId));
});

test('main refuses a real 200 without ok and keeps the lock', async (t) => {
  const tree = benchTree();
  const reservation = await reserve(tree);
  const before = readFileSync(reservation.lockPath);
  const server = await listen((req, res) => {
    assert.equal(req.url, '/health');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
  });
  t.after(() => stopServer(server));
  const hits = [];
  const stdout = capture();
  const code = await main({
    stdin: stdinOf(commandOf(tree, reservation)),
    stdout,
    stderr: capture(),
    prepare: (input) => prepareBench({
      ...input,
      ...edges(tree),
      fetchImpl: forwardingFetch(server.address().port, hits),
    }),
  });
  await closeServer(server);
  assert.notEqual(code, 0);
  assert.equal(hits.length, 1);
  const body = JSON.parse(stdout.text());
  assert.equal(body.ready, false);
  assert.equal(body.healthOk, false);
  assert.equal(body.retainLock, true);
  assert.match(body.message, /health/);
  assert.deepEqual(readFileSync(reservation.lockPath), before);
});

test('an async health callback blocks the receipt until it fails', async () => {
  const tree = benchTree();
  const reservation = await reserve(tree);
  let finish;
  const pendingHealth = new Promise((resolve) => { finish = resolve; });
  let settled = false;
  const pending = prepareBench({
    db: 'migrate',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation: {
      ownerId: reservation.ownerId,
      operationId: reservation.operationId,
      lockPath: reservation.lockPath,
    },
    ...edges(tree),
    health: () => pendingHealth,
  }).then((receipt) => {
    settled = true;
    return receipt;
  }, (error) => {
    settled = true;
    throw error;
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(settled, false);
  finish({ ok: false, message: 'health status 200 without ok' });
  await assert.rejects(pending, (error) => {
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.healthOk, false);
    assert.equal(error.receipt.retainLock, true);
    return true;
  });
});

test('a rejected health callback and a sync callback keep their receipts', async () => {
  const tree = benchTree();
  const reservation = await reserve(tree);
  const operation = {
    ownerId: reservation.ownerId,
    operationId: reservation.operationId,
    lockPath: reservation.lockPath,
  };
  await assert.rejects(() => prepareBench({
    db: 'migrate',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation,
    ...edges(tree),
    health: async () => { throw new Error('health connection failed'); },
  }), (error) => {
    assert.equal(error.receipt.ready, false);
    assert.equal(error.receipt.healthOk, false);
    assert.match(error.receipt.error, /health connection failed/);
    return true;
  });

  const sync = await prepareBench({
    db: 'migrate',
    runtimeRoot: tree.release,
    cmRoot: tree.cm,
    operation,
    ...edges(tree),
    health: () => ({ ok: true }),
  });
  assert.equal(sync.ready, true);
  assert.equal(sync.healthOk, true);
  assert.equal(sync.observedRelease, null);
});
