/**
 * Migração ou reset da bancada 102047, seed e recibo.
 * A URL do banco segue só para o processo filho; o recibo leva o nome do banco.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { inspectSlot, runOnVm, testDatabaseUrlFromEnvText } from '../../scripts/runtime/prepareLocalTestBench.mjs';
import { TEST_DATABASE_NAME, declaredTestMode } from '../../scripts/runtime/vmApps.mjs';

export const BENCH_PROJECT_ID = '102047';
export const BENCH_APP = 'app2047';
export const MEMBER_ROLE = 'tarefas.MembroEquipe';
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

export function assessResetExclusive({ consumers, activity, externalDependents }) {
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
    if (typeof app !== 'string' || app === '' || app === BENCH_APP) {
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
  };
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

/**
 * @param {object} input
 * @param {'migrate'|'reset'} input.db
 * @param {string} input.runtimeRoot release verificada (cwd do app)
 * @param {string} input.cmRoot
 * @param {Function} input.probe ({ database }) => { currentDatabase, activity, externalDependents, scopeCleared, seedsOk }
 * @param {{ ok?: boolean, script?: string, database?: string, projectId?: string }} [input.priorMigrate]
 */
export function prepareBench(input) {
  const fs = input.fs ?? defaultFs;
  const spawn = input.spawnSync ?? spawnSync;
  const projectId = input.projectId ?? BENCH_PROJECT_ID;
  if (projectId !== BENCH_PROJECT_ID) {
    throw new Error(`project ${projectId} is outside this bench`);
  }
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
  if (typeof input.probe !== 'function') throw new Error('database probe is required');
  const before = input.probe({ database: identity.database, phase: 'before' }) ?? {};
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
    app: BENCH_APP,
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
    ],
  };

  let exclusive = null;
  if (input.db === 'reset') {
    const consumers = slotConsumers(slot.remoteBase, projectId, fs);
    exclusive = assessResetExclusive({
      consumers,
      activity: before.activity,
      externalDependents: before.externalDependents,
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
    pm2.restart(path.join(slot.remoteBase, 'pm2.apps.d', `${BENCH_APP}.config.js`));
    suspended = false;
  };

  try {
    if (needsDdl) {
      pm2.stop(BENCH_APP);
      suspended = true;
      baseReceipt.stoppedOnly = BENCH_APP;
      if (input.db === 'reset') {
        const again = input.probe({ database: identity.database, phase: 'stopped' }) ?? {};
        const still = assessResetExclusive({
          consumers: { known: true, others: [] },
          activity: again.activity,
          externalDependents: again.externalDependents ?? before.externalDependents,
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
        runNode(spawn, script, slot.resolvedRoot, childEnv(projectId, databaseUrl));
      } catch (error) {
        const receipt = failedReceipt(baseReceipt, error.message);
        receipt.ddlStarted = true;
        receipt.stoppedOnly = BENCH_APP;
        if (input.db === 'reset') receipt.reset = { started: true, ok: false };
        else receipt.migrate = { executed: true, ok: false };
        throw new BenchError(error.message, receipt);
      }
      if (input.db === 'reset') {
        const after = input.probe({ database: identity.database, phase: 'after' }) ?? {};
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

    const seed = input.runSeed
      ? input.runSeed({
        argv: ['--project', projectId, '--runtime-root', slot.resolvedRoot, '--cm-root', input.cmRoot, '--member-role', MEMBER_ROLE],
        cwd: slot.resolvedRoot,
      })
      : runOnVm({
        argv: ['--project', projectId, '--runtime-root', slot.resolvedRoot, '--cm-root', input.cmRoot, '--member-role', MEMBER_ROLE],
        fs,
        spawnSync: spawn,
      });
    const manifest = seed?.manifest;
    if (!manifest?.companyMdmId || !manifest.personas?.responsavel || !manifest.personas?.membro) {
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
      memberRole: MEMBER_ROLE,
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
    const health = input.health ? input.health({ port: slot.port, release: stamp }) : { ok: true };
    if (!health?.ok) {
      const receipt = failedReceipt(baseReceipt, 'health did not pass');
      receipt.seed = baseReceipt.seed;
      receipt.observedRelease = health?.release ?? stamp;
      throw new BenchError(receipt.error, receipt);
    }
    const receipt = {
      ...baseReceipt,
      ok: true,
      phase: 'ready',
      ready: true,
      retainLock: true,
      ddlStarted: needsDdl,
      observedRelease: health.release ?? stamp,
      healthOk: true,
    };
    delete receipt.error;
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
  }
}
