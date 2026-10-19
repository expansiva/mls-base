#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VM_BENCH_SCRIPT, VM_CM_ROOT, VM_RUNTIME_ROOT } from './prepareBench.mjs';
import { planLocalSources, prepareSources } from './prepareSources.mjs';
import {
  LONG_TIMEOUT_MS,
  assertProjectId,
  beginSession,
  callVm,
  endSession,
  loadOwnerRef,
  publicView,
  refuseRemoteArgv,
  resolveLocalProfile,
  saveOwnerRef,
  spawnArgsFor,
  statusSession,
} from './session.mjs';

const SESSION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/u;
const SECRET = /cookieKey|postgres:\/\/|PGPASSWORD|secretAccess|DATABASE_URL|token|cookie/iu;
const RELEASE_FIELDS = ['id', 'client', 'versionRef', 'platformCommit', 'libs', 'monaco'];

export function usage() {
  return [
    'usage: node tools/lima/lima.mjs <command>',
    '  begin 102047 --session <name>',
    '  status [--session <name>]',
    '  prepare 102047 --session <name> [--db migrate] [--dry-run]',
    '  end --session <name>',
    'help and status do not start prepare or a browser.',
    'prepare keeps the reservation; --dry-run only reports occupation and the plan.',
  ].join('\n');
}

function takeSession(argv, index) {
  const flag = argv[index];
  if (flag === '--session') return argv[index + 1] || '';
  if (flag.startsWith('--session=')) return flag.slice('--session='.length);
  return null;
}

export function parseCli(argv) {
  refuseRemoteArgv(argv);
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    return { command: 'help' };
  }
  const command = args[0];
  if (!['begin', 'status', 'prepare', 'end'].includes(command)) {
    throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
  }
  let session = '';
  let projectId = '';
  let db = 'migrate';
  let dryRun = false;
  const positional = [];
  for (let i = 1; i < args.length; i += 1) {
    const sessionValue = takeSession(args, i);
    if (sessionValue != null) {
      session = sessionValue;
      if (args[i] === '--session') i += 1;
      continue;
    }
    if (args[i] === '--db') {
      db = args[++i] || '';
      continue;
    }
    if (args[i].startsWith('--db=')) {
      db = args[i].slice('--db='.length);
      continue;
    }
    if (args[i] === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (args[i].startsWith('--')) throw Object.assign(new Error(`unknown argument ${args[i]}`), { code: 'usage', exitCode: 2 });
    positional.push(args[i]);
  }
  if (command === 'begin' || command === 'prepare') {
    projectId = positional[0] || '';
    if (positional.length !== 1) throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
    assertProjectId(projectId);
  } else if (positional.length !== 0) {
    throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
  }
  if (command !== 'status' && !SESSION_NAME.test(session)) {
    throw Object.assign(new Error('--session is required'), { code: 'usage', exitCode: 2 });
  }
  if (session && !SESSION_NAME.test(session)) {
    throw Object.assign(new Error('--session is invalid'), { code: 'usage', exitCode: 2 });
  }
  if (command === 'prepare' && db === 'reset') {
    throw Object.assign(
      new Error('reset is not available in this version of the bench; use --db migrate'),
      { code: 'usage', exitCode: 2 },
    );
  }
  if (command === 'prepare' && db !== 'migrate') {
    throw Object.assign(new Error('--db must be migrate'), { code: 'usage', exitCode: 2 });
  }
  if (dryRun && command !== 'prepare') {
    throw Object.assign(new Error('--dry-run belongs to prepare'), { code: 'usage', exitCode: 2 });
  }
  return { command, session, projectId, db, dryRun };
}

function sessionOptions(env) {
  return {
    sshBin: env.LIMA_SSH_BIN,
    lockPath: env.LIMA_LOCK_PATH,
    env,
    timeoutMs: env.LIMA_CLAIM_TIMEOUT_MS ? Number(env.LIMA_CLAIM_TIMEOUT_MS) : undefined,
  };
}

function receiptPaths(env, session) {
  const dir = env.LIMA_RECEIPT_DIR || env.LIMA_STATE_DIR || tmpdir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return {
    dir,
    ready: join(dir, `lima-receipt-${session}.json`),
    diagnosis: join(dir, `lima-receipt-${session}.diagnosis.json`),
  };
}

function writeAtomic(file, body) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, body, { mode: 0o600 });
  renameSync(tmp, file);
}

function publishDiagnosis(env, session, diagnosis) {
  const paths = receiptPaths(env, session);
  rmSync(paths.ready, { force: true });
  writeAtomic(paths.diagnosis, `${JSON.stringify(diagnosis)}\n`);
  return paths;
}

function assertReceiptSafe(receipt) {
  if (SECRET.test(JSON.stringify(receipt))) {
    throw Object.assign(new Error('receipt would leak a secret'), { code: 'receipt' });
  }
}

function releaseOf(sources) {
  const release = sources?.evidence?.release;
  if (!release || typeof release !== 'object') return null;
  const stamp = {};
  for (const field of RELEASE_FIELDS) stamp[field] = release[field] ?? null;
  return stamp;
}

function buildReceipt({ parsed, profile, sources, bench }) {
  const evidence = sources.evidence || {};
  const seed = bench.seed || {};
  const personas = seed.personas || {};
  const receipt = {
    ok: true,
    ready: true,
    session: parsed.session,
    phase: 'ready',
    at: new Date().toISOString(),
    vm: profile.alias,
    projectId: parsed.projectId,
    origin: 'localhost',
    db: parsed.db,
    release: releaseOf(sources) || bench.release || bench.observedRelease || null,
    shas: {
      root: evidence.initialRootSha || null,
      appInitial: evidence.initialAppSha || null,
      appFinal: evidence.finalAppSha || null,
    },
    depTrees: evidence.depTrees || {},
    migrate: bench.migrate || null,
    reset: bench.reset || null,
    modules: bench.modules || bench.reset?.modules || bench.migrate?.modules || null,
    company: {
      companyMdmId: seed.companyMdmId || null,
      organizationKey: seed.organizationKey || null,
    },
    personas,
    cmIds: {
      responsavel: personas.responsavel?.cmUserId || null,
      membro: personas.membro?.cmUserId || null,
    },
    limits: bench.limits || [],
    runtimeTopology: bench.runtimeTopology,
    healthOk: bench.healthOk,
  };
  const topology = receipt.runtimeTopology;
  const topologyOk = topology !== null && typeof topology === 'object' && !Array.isArray(topology)
    && topology.expectedWorkers === 2 && topology.onlineWorkers === 2;
  if (!topologyOk) {
    throw Object.assign(new Error('receipt runtime topology is missing, invalid, or not two workers'), { code: 'receipt' });
  }
  if (receipt.healthOk !== true) {
    throw Object.assign(new Error('receipt health is missing or not affirmed'), { code: 'receipt' });
  }
  if (!receipt.release || RELEASE_FIELDS.some((field) => receipt.release[field] == null || receipt.release[field] === '')) {
    throw Object.assign(new Error('receipt is missing release fields'), { code: 'receipt' });
  }
  if (!receipt.company.companyMdmId || !receipt.cmIds.responsavel || !receipt.cmIds.membro) {
    throw Object.assign(new Error('receipt is missing company or cm ids'), { code: 'receipt' });
  }
  assertReceiptSafe(receipt);
  return receipt;
}

async function loadStages(env) {
  if (!env.LIMA_PREPARE_STAGES) return { prepareSources, planLocalSources };
  return import(pathToFileURL(env.LIMA_PREPARE_STAGES).href);
}

function runSsh(sshBin, args, input, timeoutMs, env) {
  return new Promise((resolvePromise) => {
    const [bin, binArgs] = spawnArgsFor(sshBin, args);
    const child = spawn(bin, binArgs, { stdio: ['pipe', 'pipe', 'pipe'], env });
    const out = [];
    const err = [];
    let timed = false;
    const timer = setTimeout(() => {
      timed = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ code: 1, timed, stdout: '', stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({
        code: code ?? 1,
        timed,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
    child.stdin.end(input);
  });
}

function lastJson(stdout) {
  const line = String(stdout).trim().split(/\n/u).filter(Boolean).pop() || '';
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function prepareBenchOnVm(profile, env, payload) {
  const sshBin = env.LIMA_SSH_BIN || 'ssh';
  const remote = `node ${VM_BENCH_SCRIPT}`;
  const result = await runSsh(
    sshBin,
    ['-F', profile.sshConfig, profile.alias, remote],
    JSON.stringify(payload),
    LONG_TIMEOUT_MS,
    { ...process.env, ...env },
  );
  if (result.timed) {
    return { ok: false, ready: false, code: 'ssh', message: 'bench ssh timed out' };
  }
  const json = lastJson(result.stdout);
  if (!json) {
    return { ok: false, ready: false, code: 'bench', message: result.stderr.trim() || 'bench ssh returned no receipt' };
  }
  return json;
}

async function vm(profile, command, env) {
  const reply = await callVm(profile, command, sessionOptions(env));
  return reply.json || { ok: false, code: 'ssh' };
}

export async function runPrepare(parsed, profile, env = process.env) {
  const stages = await loadStages(env);
  const options = sessionOptions(env);
  if (parsed.dryRun) {
    const status = await statusSession(profile, parsed.session, options);
    let plan = null;
    let planError = null;
    try {
      plan = await stages.planLocalSources(profile.root, parsed.projectId, env);
    } catch (error) {
      planError = error.code || error.message;
    }
    const report = {
      ok: true,
      dryRun: true,
      ready: false,
      session: parsed.session,
      projectId: parsed.projectId,
      db: parsed.db,
      held: status.held === true,
      phase: status.phase || null,
      occupiedBy: status.session || null,
      plan: plan && {
        rootSha: plan.rootSha,
        appSha: plan.appSha,
        pin: plan.pin,
        // Commit subjects are free text and trip the secret check; sha and tree identify the dependency.
        deps: Array.isArray(plan.deps) ? plan.deps.map(({ id, sha, tree }) => ({ id, sha, tree })) : plan.deps,
        blocked: plan.blocked,
      },
      planError,
    };
    assertReceiptSafe(report);
    process.stdout.write(`${JSON.stringify(publicView(report))}\n`);
    return 0;
  }

  const held = loadOwnerRef(profile, parsed.session);
  if (held) {
    const status = await statusSession(profile, parsed.session, options);
    if ((status.browsers || []).length > 0) {
      publishDiagnosis(env, parsed.session, {
        ok: false, ready: false, session: parsed.session, phase: status.phase || 'testing',
        at: new Date().toISOString(), code: 'browser', message: 'prepare refused while a browser is registered',
      });
      const error = new Error('prepare refused while a browser is registered');
      error.exitCode = 1;
      error.result = { ok: false, code: 'browser', phase: status.phase, browsers: status.browsers, ready: false };
      throw error;
    }
  }

  const begun = await beginSession(profile, parsed.session, parsed.projectId, options);
  let ref = { ...begun.ref, operationId: null };
  const started = await vm(profile, {
    op: 'beginOperation', ownerId: ref.ownerId, name: `prepare-${parsed.db}`, phase: 'preparing',
  }, env);
  if (!started.ok) {
    publishDiagnosis(env, parsed.session, {
      ok: false, ready: false, session: parsed.session, phase: started.phase || 'reserved',
      at: new Date().toISOString(), code: started.code || 'operation', message: 'prepare operation refused',
    });
    const error = new Error(started.code || 'prepare operation refused');
    error.exitCode = started.exitCode || 1;
    error.result = publicView(started);
    throw error;
  }
  ref = { ...ref, operationId: started.operationId };
  saveOwnerRef(profile, ref);

  const fail = async (code, message, uncertain = true) => {
    await vm(profile, {
      op: 'finishOperation', ownerId: ref.ownerId, operationId: ref.operationId, uncertain: true,
    }, env);
    saveOwnerRef(profile, { ...ref, operationId: ref.operationId });
    publishDiagnosis(env, parsed.session, {
      ok: false, ready: false, session: parsed.session, phase: 'failed', at: new Date().toISOString(), code, message, uncertain,
    });
    const error = new Error(message);
    error.code = code;
    error.exitCode = 1;
    error.uncertain = true;
    error.result = { ok: false, ready: false, phase: 'failed', code };
    throw error;
  };

  let sources;
  try {
    sources = await stages.prepareSources({
      root: profile.root,
      projectId: parsed.projectId,
      profile,
      session: parsed.session,
      env,
      sshBin: env.LIMA_SSH_BIN,
      lockPath: env.LIMA_LOCK_PATH,
      db: parsed.db,
    });
  } catch (error) {
    await fail(error.code || 'sources', error.message);
  }
  if (!sources?.ok) await fail(sources?.code || 'sources', sources?.message || 'source prepare failed', sources?.uncertain !== false);

  const bench = await prepareBenchOnVm(profile, env, {
    db: parsed.db,
    projectId: parsed.projectId,
    runtimeRoot: VM_RUNTIME_ROOT,
    cmRoot: VM_CM_ROOT,
    operation: { ownerId: ref.ownerId, operationId: ref.operationId, lockPath: options.lockPath },
  });
  if (!bench?.ready) await fail(bench?.code || 'bench', bench?.message || 'bench did not become ready', true);

  let receipt;
  try {
    receipt = buildReceipt({ parsed, profile, sources, bench });
  } catch (error) {
    await fail(error.code || 'receipt', error.message, false);
  }
  const finished = await vm(profile, {
    op: 'finishOperation', ownerId: ref.ownerId, operationId: ref.operationId, phase: 'ready',
  }, env);
  if (!finished.ok || finished.phase !== 'ready') await fail(finished.code || 'phase', 'reservation did not reach ready', true);
  saveOwnerRef(profile, { ...ref, operationId: null });
  const paths = receiptPaths(env, parsed.session);
  writeAtomic(paths.ready, `${JSON.stringify(receipt)}\n`);
  rmSync(paths.diagnosis, { force: true });
  process.stdout.write(`${JSON.stringify(publicView({ ...receipt, receiptFile: paths.ready }))}\n`);
  return 0;
}

function printView(view) {
  process.stdout.write(`${JSON.stringify(publicView(view))}\n`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const parsed = parseCli(argv);
  if (parsed.command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const profile = resolveLocalProfile(undefined, env);
  if (parsed.command === 'prepare') return runPrepare(parsed, profile, env);
  if (parsed.command === 'begin') {
    const begun = await beginSession(profile, parsed.session, parsed.projectId);
    printView({ ...begun.view, resumed: begun.resumed });
    return 0;
  }
  if (parsed.command === 'status') {
    printView(await statusSession(profile, parsed.session || ''));
    return 0;
  }
  printView(await endSession(profile, parsed.session));
  return 0;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === import.meta.url;
}

if (invokedDirectly()) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const body = error.result ? `${JSON.stringify(publicView(error.result))}\n` : '';
    process.stderr.write(`${body}${error.message}\n`);
    process.exitCode = error.exitCode || (error.code === 'busy' ? 73 : 1);
  });
}

export { LONG_TIMEOUT_MS };
