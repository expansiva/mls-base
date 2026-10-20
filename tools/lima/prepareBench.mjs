/**
 * Migração ou reset da bancada 102047, seed e recibo.
 * A URL do banco segue só para o processo filho; o recibo leva o nome do banco.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectSlot, runOnVm, testDatabaseUrlFromEnvText } from '../../scripts/runtime/prepareLocalTestBench.mjs';
import { TEST_DATABASE_NAME, declaredTestMode } from '../../scripts/runtime/vmApps.mjs';
import { probeBenchHealth } from './health.mjs';
import { SUPPORTED_PROJECTS, projectApp, projectRuntimeRoot } from './session.mjs';
import { DEFAULT_LOCK_PATH, dispatch } from './sessionVm.mjs';

export const BENCH_PROJECT_ID = SUPPORTED_PROJECTS[0];
export const BENCH_APP = projectApp(BENCH_PROJECT_ID);
export const MEMBER_ROLE = 'tarefas.MembroEquipe';
export const VM_RUNTIME_ROOT = projectRuntimeRoot(BENCH_PROJECT_ID);
/** Projects whose bench seed attaches a module role (tarefas). The others get only the test logins. */
const MEMBER_ROLE_PROJECTS = new Set(['102047']);
export const VM_CM_ROOT = '/data/msg.collab.codes/current';
export const VM_BENCH_SCRIPT = '/data/mls-base/tools/lima/prepareBench.mjs';

export const PROBE_DATABASE_SQL = 'SELECT current_database() AS current_database';
export const PROBE_ACTIVITY_SQL = `SELECT application_name, client_addr::text AS client_addr, datname
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()`;
export const PROBE_SCOPE_SQL = `SELECT c.relname AS name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname !~ '^pg_'`;
export const PROBE_DEPENDENTS_SQL = `SELECT dep.relname AS name, dep.relkind AS kind, src.relname AS on_table
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.confrelid
JOIN pg_class dep ON dep.oid = con.conrelid
WHERE con.contype = 'f'
  AND src.relname = ANY($1::text[])
  AND NOT (dep.relname = ANY($1::text[]))
UNION
SELECT v.relname, v.relkind, t.relname
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class v ON v.oid = r.ev_class
JOIN pg_class t ON t.oid = d.refobjid
WHERE d.refclassid = 'pg_class'::regclass
  AND v.relkind = 'v'
  AND t.relkind = 'r'
  AND t.relname = ANY($1::text[])
  AND NOT (v.relname = ANY($1::text[]))`;
export const PROBE_COUNT_SQL = `SELECT s.name AS name,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*)::int AS c FROM public.%I', s.name), false, true, '')))[1]::text::int AS n
FROM unnest($1::text[]) AS s(name)`;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const STAMP_FIELDS = ['id', 'client', 'versionRef', 'platformCommit', 'libs', 'monaco'];

const defaultFs = { existsSync, readFileSync, realpathSync, readdirSync };

export class BenchError extends Error {
  constructor(message, receipt) {
    super(message);
    this.name = 'BenchError';
    this.receipt = receipt;
  }
}

function redact(text) {
  return String(text).replace(/postgres:\/\/\S+/gi, 'postgres://…');
}

function readJsonField(text, label) {
  const match = String(text).match(new RegExp(`${label}:\\s*("(?:\\\\.|[^"])*")`, 'u'));
  if (!match) return undefined;
  return JSON.parse(match[1]);
}

function databaseIdentity(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL_TEST is not a database url');
  }
  const database = parsed.pathname.replace(/^\//, '');
  return { database, host: parsed.hostname };
}

function assertLocalTestTarget(url) {
  const identity = databaseIdentity(url);
  if (identity.database !== TEST_DATABASE_NAME) {
    throw new Error(`database is '${identity.database}', expected ${TEST_DATABASE_NAME}`);
  }
  if (!LOCAL_HOSTS.has(identity.host)) {
    throw new Error('DATABASE_URL_TEST is not a local host');
  }
  return identity;
}

function masterBackend(config) {
  return Object.entries(config.projects ?? {}).find(([, project]) => project?.type === 'master backend')?.[0];
}

function scriptInRelease(root, backendId, base) {
  return path.join(root, 'dist', 'local', `_${backendId}_`, 'l1', 'scripts', base);
}

export function readReleaseStamp(root, fs = defaultFs) {
  const file = path.join(root, 'release.json');
  if (!fs.existsSync(file)) return {};
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stamp = {};
  for (const field of STAMP_FIELDS) {
    if (raw[field] !== undefined) stamp[field] = raw[field];
  }
  return stamp;
}

/** Outros slots cujo pm2 declara DATABASE_URL_TEST compartilham collab_app_test. */
export function slotConsumers(remoteBase, projectId, fs = defaultFs) {
  const dir = path.join(remoteBase, 'pm2.apps.d');
  if (!fs.existsSync(dir)) {
    return { known: false, others: [], reason: 'pm2.apps.d is missing' };
  }
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.config.js'));
  } catch {
    return { known: false, others: [], reason: 'pm2.apps.d is unreadable' };
  }
  const others = [];
  for (const name of names) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch {
      return { known: false, others: [], reason: `slot ${name} is unreadable` };
    }
    let slotId;
    try {
      slotId = readJsonField(text, 'COLLAB_PROJECT_ID');
    } catch {
      return { known: false, others: [], reason: `slot ${name} has no project id` };
    }
    if (!slotId) return { known: false, others: [], reason: `slot ${name} has no project id` };
    if (slotId === projectId) continue;
    if (text.includes('DATABASE_URL_TEST')) others.push({ projectId: slotId, config: name });
  }
  return { known: true, others };
}

export function assessResetExclusive({ consumers, activity, externalDependents, appName = BENCH_APP }) {
  if (!consumers?.known) {
    return { ok: false, reason: consumers?.reason || 'slot inventory is unknown; migrate remains available' };
  }
  if (consumers.others.length > 0) {
    const ids = consumers.others.map((item) => item.projectId).join(',');
    return { ok: false, reason: `collab_app_test is shared with ${ids}; migrate remains available` };
  }
  if (!Array.isArray(activity)) {
    return { ok: false, reason: 'pg_stat_activity is unknown; migrate remains available' };
  }
  const foreign = [];
  for (const row of activity) {
    if (row?.datname !== TEST_DATABASE_NAME) continue;
    const app = row.applicationName;
    if (typeof app !== 'string' || app === '' || app === appName) {
      return { ok: false, reason: 'a collab_app_test session is unknown or still this app; migrate remains available' };
    }
    foreign.push(app);
  }
  if (foreign.length > 0) {
    return { ok: false, reason: `collab_app_test has other sessions (${foreign.join(',')}); migrate remains available` };
  }
  if (!Array.isArray(externalDependents)) {
    return { ok: false, reason: 'dependents outside the app scope are unknown; migrate remains available' };
  }
  if (externalDependents.length > 0) {
    return { ok: false, reason: 'a dependent outside the app scope would be hit; migrate remains available' };
  }
  return { ok: true };
}

function childEnv(projectId, databaseUrl) {
  return {
    ...process.env,
    COLLAB_PROJECT_ID: projectId,
    DATABASE_URL_TEST: databaseUrl,
  };
}

function runNode(spawn, script, cwd, env) {
  const result = spawn(process.execPath, [script], { cwd, env, encoding: 'utf8' });
  if (!result || result.status !== 0) {
    const detail = redact(result?.stderr?.trim() || result?.error?.message || 'no output');
    throw new Error(`${path.basename(script)} failed: ${detail}`);
  }
  return result;
}

function onlineWorkerCounts(raw, appName) {
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  return list
    .filter((row) => row?.name === appName && row?.pm2_env?.status === 'online')
    .map((row) => (row.pm2_env.COLLAB_WORKER_COUNT === undefined ? null : String(row.pm2_env.COLLAB_WORKER_COUNT)));
}

function defaultPm2(spawn) {
  return {
    stop(name) {
      const result = spawn('pm2', ['stop', name], { encoding: 'utf8' });
      if (!result || result.status !== 0) throw new Error(`pm2 stop ${name} failed`);
    },
    restart(configPath) {
      const result = spawn('pm2', ['restart', configPath, '--update-env'], { encoding: 'utf8' });
      if (!result || result.status !== 0) throw new Error('pm2 restart failed');
    },
    describe(name) {
      const result = spawn('pm2', ['jlist'], { encoding: 'utf8' });
      if (!result || result.status !== 0) throw new Error('pm2 jlist failed');
      return onlineWorkerCounts(result.stdout, name);
    },
  };
}

async function readBenchHealth(input, port, stamp) {
  const call = typeof input.health === 'function'
    ? input.health
    : (ctx) => probeBenchHealth(
      { port: ctx.port },
      typeof input.fetchImpl === 'function' ? { fetchImpl: input.fetchImpl } : undefined,
    );
  try {
    return await Promise.resolve(call({ port, release: stamp }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: redact(message).split('\n')[0] };
  }
}

function healthDiagnostic(health) {
  const raw = health && typeof health.message === 'string' && health.message.trim()
    ? health.message
    : 'health did not pass';
  return redact(raw).split('\n')[0];
}

function observedReleaseOf(health) {
  if (health && health.release != null) return health.release;
  return null;
}

function assignObservedRelease(receipt, health) {
  receipt.observedRelease = observedReleaseOf(health);
}

function failedReceipt(base, message) {
  return {
    ...base,
    ok: false,
    phase: 'failed',
    retainLock: true,
    ready: false,
    error: redact(message),
    cm: { preserved: true, historyPreserved: true, humansReused: true },
  };
}

function assertReceiptSafe(receipt) {
  const text = JSON.stringify(receipt);
  if (/cookieKey|postgres:\/\/|PGPASSWORD|secretAccess|DATABASE_URL/i.test(text)) {
    throw new Error('receipt would leak a secret');
  }
}

export async function confirmBenchOperation(operation) {
  if (!operation || typeof operation.ownerId !== 'string' || typeof operation.operationId !== 'string' || typeof operation.lockPath !== 'string') {
    return { ok: false, code: 'operation', message: 'bench operation is missing' };
  }
  const status = await dispatch({
    op: 'status',
    ownerId: operation.ownerId,
    lockPath: operation.lockPath,
  });
  const operations = Array.isArray(status.operations) ? status.operations : [];
  const registered = operations.some((item) => item.id === operation.operationId);
  if (status.owned !== true || !registered) {
    return { ok: false, code: 'operation', message: 'bench operation is not registered for this owner' };
  }
  return { ok: true };
}

const RESET_SUMMARY_MARK = '##resetLocalDb ';

/** A linha marcada do resetLocalDb. Sem ela o reset não tem tabelas semeadas para conferir. */
export function readResetLocalDbLine(stdout) {
  const marked = String(stdout || '').split(/\r?\n/).filter((line) => line.startsWith(RESET_SUMMARY_MARK));
  if (marked.length !== 1) {
    return { ok: false, message: 'resetLocalDb summary line is missing' };
  }
  let parsed;
  try {
    parsed = JSON.parse(marked[0].slice(RESET_SUMMARY_MARK.length));
  } catch {
    return { ok: false, message: 'resetLocalDb summary line is invalid' };
  }
  const tables = parsed?.seededTables;
  if (!parsed || !Array.isArray(parsed.modules) || !Array.isArray(tables) || tables.some((name) => typeof name !== 'string' || name === '')) {
    return { ok: false, message: 'resetLocalDb summary line is invalid' };
  }
  return { ok: true, seededTables: tables, modules: parsed.modules, database: parsed.database };
}

function loadPg(runtimeRoot) {
  const require = createRequire(path.join(runtimeRoot, 'node_modules', 'pg', 'package.json'));
  return require('pg');
}

function countsOf(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (typeof row?.name !== 'string') continue;
    counts.set(row.name, Number(row.n));
  }
  return counts;
}

/** Lê o pg da release. Sem INSERT/UPDATE/DDL. scopeCleared e seedsOk saem das contagens. */
export async function probeWithPg(client, request = {}) {
  const database = await client.query(PROBE_DATABASE_SQL);
  const currentDatabase = database.rows?.[0]?.current_database;
  const activityResult = await client.query(PROBE_ACTIVITY_SQL);
  const scopeResult = await client.query(PROBE_SCOPE_SQL);
  const scopeTables = (scopeResult.rows || []).map((row) => row.name).filter((name) => typeof name === 'string');
  const seedTables = Array.isArray(request.seedTables) ? request.seedTables.filter((name) => typeof name === 'string') : [];
  const dependents = scopeTables.length
    ? await client.query(PROBE_DEPENDENTS_SQL, [scopeTables])
    : { rows: [] };
  let scopeCleared;
  let seedsOk;
  if (request.phase === 'after') {
    const counted = scopeTables.length ? await client.query(PROBE_COUNT_SQL, [scopeTables]) : { rows: [] };
    const counts = countsOf(counted.rows);
    const seeds = new Set(seedTables);
    scopeCleared = scopeTables.length > 0;
    seedsOk = true;
    for (const name of seedTables) {
      if (!scopeTables.includes(name) || !(counts.get(name) > 0)) seedsOk = false;
    }
    for (const name of scopeTables) {
      if (seeds.has(name)) continue;
      if (counts.get(name) !== 0) scopeCleared = false;
    }
  }
  return {
    currentDatabase,
    activity: (activityResult.rows || []).map((row) => ({
      datname: row.datname,
      applicationName: row.application_name,
      clientAddr: row.client_addr,
    })),
    externalDependents: dependents.rows || [],
    scopeCleared,
    seedsOk,
  };
}

/**
 * @param {object} input
 * @param {'migrate'|'reset'} input.db
 * @param {string} input.runtimeRoot release verificada (cwd do app)
 * @param {string} input.cmRoot
 * @param {Function} input.probe ({ database }) => { currentDatabase, activity, externalDependents, scopeCleared, seedsOk }
 * @param {{ ok?: boolean, script?: string, database?: string, projectId?: string }} [input.priorMigrate]
 */
export async function prepareBench(input) {
  const fs = input.fs ?? defaultFs;
  const spawn = input.spawnSync ?? spawnSync;
  const projectId = input.projectId ?? BENCH_PROJECT_ID;
  if (input.operation) {
    const confirmed = await confirmBenchOperation(input.operation);
    if (!confirmed.ok) {
      const error = new BenchError(confirmed.message, {
        ok: false, phase: 'refused', ready: false, retainLock: true, ddlStarted: false, code: confirmed.code,
      });
      error.code = confirmed.code;
      throw error;
    }
  }
  if (!SUPPORTED_PROJECTS.includes(projectId)) {
    throw new Error(`project ${projectId} is outside this bench`);
  }
  const appName = projectApp(projectId);
  const noModuleRole = !MEMBER_ROLE_PROJECTS.has(projectId);
  if (input.db !== 'migrate' && input.db !== 'reset') {
    throw new Error('db must be migrate or reset');
  }
  if (input.browsersOpen) {
    throw new Error('bench prepare refuses while a browser is registered');
  }
  const slot = inspectSlot(input.runtimeRoot, projectId, fs);
  if (!fs.existsSync(input.cmRoot)) throw new Error('cm root is missing');
  const config = JSON.parse(fs.readFileSync(path.join(slot.resolvedRoot, 'config.json'), 'utf8'));
  const backendId = masterBackend(config);
  if (!backendId) throw new Error('release has no master backend');
  if (!declaredTestMode(slot.remoteBase, projectId)) {
    throw new Error('appEnv is not a declared test mode');
  }
  const databaseUrl = testDatabaseUrlFromEnvText(fs.readFileSync(slot.envPath, 'utf8'));
  const identity = assertLocalTestTarget(databaseUrl);
  let client = null;
  const probe = typeof input.probe === 'function'
    ? input.probe
    : async (call) => {
      if (!client) {
        const pg = loadPg(slot.resolvedRoot);
        client = new pg.Client({ connectionString: databaseUrl });
        await client.connect();
      }
      return probeWithPg(client, call);
    };
  const before = await Promise.resolve(probe({ database: identity.database, phase: 'before' })) ?? {};
  if (before.currentDatabase !== identity.database) {
    throw new Error('current_database is not the local test database');
  }

  const migrateJs = scriptInRelease(slot.resolvedRoot, backendId, 'migrate.js');
  const resetJs = scriptInRelease(slot.resolvedRoot, backendId, 'resetLocalDb.js');
  const script = input.db === 'reset' ? resetJs : migrateJs;
  if (!fs.existsSync(script)) throw new Error(`${path.basename(script)} is missing from the verified release`);

  const stamp = readReleaseStamp(slot.resolvedRoot, fs);
  const baseReceipt = {
    ok: false,
    phase: 'preparing',
    ready: false,
    retainLock: true,
    projectId,
    app: appName,
    port: slot.port,
    db: input.db,
    database: identity.database,
    release: stamp,
    runtimeRoot: slot.resolvedRoot,
    stoppedOnly: null,
    migrate: null,
    reset: null,
    seed: null,
    cm: { preserved: true, historyPreserved: true, humansReused: true },
    limits: [
      'postgresql cleanup does not clear collab-messages history',
      'humans and cm ids are reused; previous MDM ids are not promised after reset',
      'after reset open new browser jars; do not reuse storage from an older campaign',
      'health does not accept UI or product scenarios',
      'infrastructure preparation does not prove durable integration; the cycle waits for a specific receipt',
    ],
  };

  let exclusive = null;
  if (input.db === 'reset') {
    const consumers = slotConsumers(slot.remoteBase, projectId, fs);
    exclusive = assessResetExclusive({
      consumers,
      activity: before.activity,
      externalDependents: before.externalDependents,
      appName,
    });
    if (!exclusive.ok) {
      throw new BenchError(`${exclusive.reason}; migrate remains available`, {
        ...baseReceipt,
        phase: 'refused',
        retainLock: true,
        ddlStarted: false,
        reset: { refused: true, reason: exclusive.reason },
      });
    }
  }

  const prior = input.priorMigrate;
  let migrateReused = false;
  if (input.db === 'migrate' && prior?.ok === true && prior.database === identity.database
    && prior.projectId === projectId && prior.script && fs.existsSync(prior.script)) {
    if (fs.realpathSync(prior.script) === fs.realpathSync(migrateJs)) migrateReused = true;
  }

  if (input.waitHook) input.waitHook();

  const pm2 = input.pm2 ?? defaultPm2(spawn);
  const needsDdl = input.db === 'reset' || !migrateReused;
  let suspended = false;
  const resume = () => {
    if (!suspended) return;
    pm2.restart(path.join(slot.remoteBase, 'pm2.apps.d', `${appName}.config.js`));
    suspended = false;
  };

  try {
    if (needsDdl) {
      pm2.stop(appName);
      suspended = true;
      baseReceipt.stoppedOnly = appName;
      if (input.db === 'reset') {
        const again = await Promise.resolve(probe({ database: identity.database, phase: 'stopped' })) ?? {};
        const still = assessResetExclusive({
          consumers: { known: true, others: [] },
          activity: again.activity,
          externalDependents: again.externalDependents ?? before.externalDependents,
          appName,
        });
        if (!still.ok) {
          resume();
          throw new BenchError(still.reason, {
            ...baseReceipt,
            phase: 'refused',
            ddlStarted: false,
            reset: { refused: true, reason: still.reason },
          });
        }
      }
      try {
        const ran = runNode(spawn, script, slot.resolvedRoot, childEnv(projectId, databaseUrl));
        if (input.db === 'reset') {
          const summary = readResetLocalDbLine(ran.stdout);
          if (!summary.ok) {
            const receipt = failedReceipt(baseReceipt, summary.message);
            receipt.ddlStarted = true;
            receipt.reset = { started: true, ok: false };
            throw new BenchError(receipt.error, receipt);
          }
          baseReceipt.resetSummary = { modules: summary.modules, seededTables: summary.seededTables, database: summary.database };
        }
      } catch (error) {
        if (error instanceof BenchError) throw error;
        const receipt = failedReceipt(baseReceipt, error.message);
        receipt.ddlStarted = true;
        receipt.stoppedOnly = appName;
        if (input.db === 'reset') receipt.reset = { started: true, ok: false };
        else receipt.migrate = { executed: true, ok: false };
        throw new BenchError(error.message, receipt);
      }
      if (input.db === 'reset') {
        const after = await Promise.resolve(probe({
          database: identity.database,
          phase: 'after',
          seedTables: baseReceipt.resetSummary?.seededTables ?? [],
        })) ?? {};
        if (after.scopeCleared !== true || after.seedsOk !== true) {
          const receipt = failedReceipt(baseReceipt, 'reset did not clear scope rows and reapply schema seeds');
          receipt.ddlStarted = true;
          receipt.reset = { started: true, ok: false, scopeCleared: after.scopeCleared === true, seedsOk: after.seedsOk === true };
          throw new BenchError(receipt.error, receipt);
        }
        baseReceipt.reset = {
          ok: true,
          database: identity.database,
          scopeCleared: true,
          seedsOk: true,
          extensionsPreserved: true,
        };
        baseReceipt.migrate = { executed: false };
      } else {
        baseReceipt.migrate = { executed: true, ok: true, script: path.basename(migrateJs), cwd: slot.resolvedRoot };
      }
    } else {
      baseReceipt.migrate = { executed: false, reused: true, ok: true, script: path.basename(migrateJs) };
    }

    const seedArgv = ['--project', projectId, '--runtime-root', slot.resolvedRoot, '--cm-root', input.cmRoot];
    if (!noModuleRole) seedArgv.push('--member-role', MEMBER_ROLE);
    const seed = input.runSeed
      ? input.runSeed({ argv: seedArgv, cwd: slot.resolvedRoot })
      : runOnVm({
        argv: seedArgv,
        spawnSync: spawn,
        ...(input.manifestDir ? { manifestDir: input.manifestDir } : {}),
      });
    const manifest = seed?.manifest;
    if (!manifest?.companyMdmId || !manifest?.personas?.responsavel || !manifest?.personas?.membro) {
      const receipt = failedReceipt(baseReceipt, 'bench seed did not return company and both sessions');
      receipt.ddlStarted = needsDdl;
      throw new BenchError(receipt.error, receipt);
    }
    const personas = {};
    for (const alias of ['responsavel', 'membro']) {
      const persona = manifest.personas[alias];
      personas[alias] = {
        email: persona.email,
        sub: persona.sub,
        personMdmId: persona.personMdmId,
        cmUserId: persona.cmUserId,
      };
    }
    baseReceipt.seed = {
      ok: true,
      memberRole: noModuleRole ? null : MEMBER_ROLE,
      companyMdmId: manifest.companyMdmId,
      organizationKey: manifest.organizationKey,
      personas,
      manifestFile: seed.manifestFile,
      cmIdsPreserved: true,
      privateKeyPreserved: true,
    };
    if (input.db === 'reset') {
      baseReceipt.limits = baseReceipt.limits.concat(['do not treat previous MDM ids as still valid']);
    }

    resume();
    const health = await readBenchHealth(input, slot.port, stamp);
    if (!health || health.ok !== true) {
      const receipt = failedReceipt(baseReceipt, healthDiagnostic(health));
      receipt.seed = baseReceipt.seed;
      receipt.healthOk = false;
      assignObservedRelease(receipt, health);
      throw new BenchError(receipt.error, receipt);
    }
    let workerCounts;
    let describeError;
    try {
      workerCounts = typeof pm2.describe === 'function'
        ? pm2.describe(appName)
        : onlineWorkerCounts('', appName);
    } catch (error) {
      workerCounts = null;
      const message = error instanceof Error ? error.message : String(error);
      describeError = redact(message.split('\n')[0]);
    }
    const onlineWorkers = Array.isArray(workerCounts) ? workerCounts.length : null;
    const runtimeTopology = { expectedWorkers: 2, onlineWorkers };
    const topologyOk = onlineWorkers === 2 && workerCounts.every((count) => count === '2');
    if (!topologyOk) {
      const cause = describeError ? `; ${describeError}` : '';
      const receipt = failedReceipt(
        baseReceipt,
        `runtime topology needs two online workers with COLLAB_WORKER_COUNT=2; online=${onlineWorkers === null ? 'unreadable' : onlineWorkers}${cause}`,
      );
      receipt.seed = baseReceipt.seed;
      receipt.healthOk = true;
      assignObservedRelease(receipt, health);
      receipt.runtimeTopology = runtimeTopology;
      throw new BenchError(receipt.error, receipt);
    }
    const receipt = {
      ...baseReceipt,
      ok: true,
      phase: 'ready',
      ready: true,
      retainLock: true,
      ddlStarted: needsDdl,
      healthOk: true,
      observedRelease: observedReleaseOf(health),
      runtimeTopology,
    };
    delete receipt.error;
    delete receipt.resetSummary;
    assertReceiptSafe(receipt);
    return receipt;
  } catch (error) {
    if (error instanceof BenchError && error.receipt) {
      assertReceiptSafe(error.receipt);
      throw error;
    }
    if (suspended) {
      const receipt = failedReceipt(baseReceipt, error.message);
      receipt.ddlStarted = needsDdl;
      throw new BenchError(redact(error.message), receipt);
    }
    throw new Error(redact(error.message));
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === import.meta.url;
}

export async function main({
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  prepare = prepareBench,
} = {}) {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    stderr.write('prepareBench: JSON command on stdin\n');
    return 2;
  }
  let command;
  try {
    command = JSON.parse(text);
  } catch {
    stdout.write(`${JSON.stringify({ ok: false, ready: false, code: 'bad-json' })}\n`);
    return 2;
  }
  const operation = command.operation;
  if (!operation || typeof operation !== 'object') {
    stdout.write(`${JSON.stringify({ ok: false, ready: false, code: 'operation', message: 'bench operation is missing' })}\n`);
    return 1;
  }
  if (!operation.lockPath) operation.lockPath = DEFAULT_LOCK_PATH;
  try {
    const receipt = await prepare({
      db: command.db,
      projectId: command.projectId,
      runtimeRoot: command.runtimeRoot,
      cmRoot: command.cmRoot,
      operation,
    });
    stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (error) {
    const body = {
      ok: false,
      ready: false,
      code: error.code || 'bench',
      message: redact(error.message),
      ...(error.receipt || {}),
    };
    delete body.error;
    body.message = redact(error.message);
    stdout.write(`${JSON.stringify(body)}\n`);
    return 1;
  }
}

if (invokedDirectly()) {
  main().then((code) => process.exit(code));
}
