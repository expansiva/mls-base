/**
 * Administrative bench seed for collab-messages humans.
 * Run on the lima against an installed cm root. Not imported by the client release.
 *
 *   node scripts/runtime/seedLocalTestCm.mjs --cm-root <install> --project <id>
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALIASES = ['responsavel', 'membro'];
const NAMES = { responsavel: 'Bench responsible', membro: 'Bench member' };
export const BENCH_STORAGE_PREFIX = 'desenv_';

export function localTestEmail(projectId, alias) {
  return `${alias}.${projectId}@runtime.test`;
}

export function localTestSub(projectId, alias) {
  return `local-test:${projectId}:${alias}`;
}

export function assertProjectId(projectId) {
  if (typeof projectId !== 'string' || !/^\d+$/.test(projectId)) {
    throw new Error('project id is missing or not numeric');
  }
  return projectId;
}

/** Refuse before any lock or user write. */
export function assertBenchStorage(resolvedStorage) {
  const prefix = resolvedStorage?.tablePrefix;
  if (prefix !== BENCH_STORAGE_PREFIX) {
    throw new Error(`refusing cm storage prefix '${prefix ?? ''}' (bench requires ${BENCH_STORAGE_PREFIX})`);
  }
  if (!resolvedStorage.bucket || !resolvedStorage.dynamoRegion) {
    throw new Error('refusing cm storage without a declared local destination');
  }
  return { storagePrefix: prefix };
}

function installedVersion(cmRoot) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(cmRoot, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

function requireExport(mod, key, version) {
  if (mod == null || mod[key] == null) {
    throw new Error(`cm ${version} missing export ${key}`);
  }
  return mod[key];
}

export async function loadInstalledCm(cmRoot) {
  const root = path.resolve(cmRoot);
  const version = installedVersion(root);
  const dist = path.join(root, 'dist');
  let configMod;
  let perfilMod;
  let usersMod;
  try {
    configMod = await import(pathToFileURL(path.join(dist, 'helpers/config.js')).href);
    perfilMod = await import(pathToFileURL(path.join(dist, 'layer_1_external/perfil.js')).href);
    usersMod = await import(pathToFileURL(path.join(dist, 'layer_3_usecases/users.js')).href);
  } catch (error) {
    throw new Error(`cm ${version} missing dist import: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    version,
    config: requireExport(configMod, 'config', version),
    resolvedStorage: requireExport(configMod, 'resolvedStorage', version),
    getPerfil: requireExport(perfilMod, 'getPerfil', version),
    UserRecord: requireExport(usersMod, 'UserRecord', version),
  };
}

function publicFragment(storagePrefix, personas) {
  return {
    storagePrefix,
    personas: personas.map((persona) => ({
      alias: persona.alias,
      email: persona.email,
      sub: persona.sub,
      cmUserId: persona.cmUserId,
    })),
  };
}

async function ensureHuman(perfil, UserRecord, projectId, alias) {
  const email = localTestEmail(projectId, alias);
  const sub = localTestSub(projectId, alias);
  const existing = await perfil.io.users.findByEmail(email);
  if (existing) {
    if (existing.kind !== 'human' || existing.sub !== sub) {
      throw new Error(`cm user for ${alias} exists but is not the local bench human`);
    }
    if (!existing.userId) throw new Error(`cm user for ${alias} has no userId`);
    return { alias, email, sub, cmUserId: existing.userId };
  }
  const record = new UserRecord();
  record.userData.name = NAMES[alias];
  record.userData.email = email;
  record.userData.sub = sub;
  record.userData.kind = 'human';
  const created = await record.create(perfil);
  if (!created || !record.userData.userId) {
    throw new Error(`cm user for ${alias} was not created`);
  }
  return { alias, email, sub, cmUserId: record.userData.userId };
}

export async function seedLocalTestCm(loaded, projectId) {
  const id = assertProjectId(projectId);
  const { storagePrefix } = assertBenchStorage(loaded.resolvedStorage);
  if (typeof loaded.getPerfil !== 'function' || typeof loaded.UserRecord !== 'function') {
    throw new Error(`cm ${loaded.version ?? 'unknown'} missing export getPerfil or UserRecord`);
  }
  const perfil = loaded.getPerfil({ has: 'local-test', user: 'local-test-seed' });
  const lockKey = `local-test-bench:${id}`;
  const entered = await perfil.io.lock.enterCritical(lockKey);
  if (!entered) throw new Error('bench lock is busy, retry');
  try {
    const personas = [];
    for (const alias of ALIASES) {
      personas.push(await ensureHuman(perfil, loaded.UserRecord, id, alias));
    }
    return publicFragment(storagePrefix, personas);
  } finally {
    await perfil.io.lock.leaveCritical(lockKey);
  }
}

export function parseArgs(argv) {
  let cmRoot = '';
  let project = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cm-root') cmRoot = argv[++i] ?? '';
    else if (arg === '--project') project = argv[++i] ?? '';
    else if (arg.startsWith('--')) throw new Error(`unknown argument ${arg}`);
  }
  if (!cmRoot) throw new Error('--cm-root is required');
  return { cmRoot, project: assertProjectId(project) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = await loadInstalledCm(args.cmRoot);
  const fragment = await seedLocalTestCm(loaded, args.project);
  process.stdout.write(`${JSON.stringify(fragment)}\n`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirect) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
