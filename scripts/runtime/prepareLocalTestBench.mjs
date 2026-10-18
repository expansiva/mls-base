/**
 * Host command: prepare the lima bench (MDM + cm) and publish a private manifest.
 *
 *   node scripts/runtime/prepareLocalTestBench.mjs --project 102047 --runtime-root <release> --cm-root <cm>
 *
 * Talks only to the SSH alias lima-ubuntu24. Paths are on the VM. No --host and no publish.
 * The same file is piped to the VM (`LOCAL_TEST_BENCH_ROLE=remote`) so seeds run there.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SSH_ALIAS = 'lima-ubuntu24';
export const CM_TARGET = 'http://127.0.0.1:8180';
export const MANIFEST_DIR = '/etc/collab/local-tests';
export const TEST_DATABASE_NAME = 'collab_app_test';
const ALIASES = ['responsavel', 'membro'];
const BENCH_NAMES = { responsavel: 'Bench responsible', membro: 'Bench member' };

export function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function assertProjectId(projectId) {
  if (typeof projectId !== 'string' || !/^\d+$/.test(projectId)) {
    throw new Error('project id is missing or not numeric');
  }
  return projectId;
}

export function projectPort(projectId) {
  const id = assertProjectId(projectId);
  const port = 2000 + Number(id.slice(-3));
  if (port < 2000 || port > 2999) throw new Error('project port is outside 2000-2999');
  return port;
}

export function localTestEmail(projectId, alias) {
  return `${alias}.${projectId}@runtime.test`;
}

export function localTestSub(projectId, alias) {
  return `local-test:${projectId}:${alias}`;
}

export function allowedOriginsFor(port) {
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
}

const MEMBER_ROLE = /^[A-Za-z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*$/;

export function parseArgs(argv) {
  let project = '';
  let runtimeRoot = '';
  let cmRoot = '';
  const memberRoles = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') project = argv[++i] ?? '';
    else if (arg === '--runtime-root') runtimeRoot = argv[++i] ?? '';
    else if (arg === '--cm-root') cmRoot = argv[++i] ?? '';
    else if (arg === '--member-role') {
      const role = argv[++i] ?? '';
      if (!MEMBER_ROLE.test(role)) throw new Error(`--member-role '${role}' is not <moduleId>.<Tipo>`);
      memberRoles.push(role);
    }
    else if (arg.startsWith('--')) throw new Error(`unknown argument ${arg}`);
    else throw new Error(`unexpected argument ${arg}`);
  }
  if (!runtimeRoot) throw new Error('--runtime-root is required');
  if (!cmRoot) throw new Error('--cm-root is required');
  return { project: assertProjectId(project), runtimeRoot, cmRoot, memberRoles };
}

export function remoteShellCommand(project, runtimeRoot, cmRoot, memberRoles = []) {
  const parts = [
    'env',
    'LOCAL_TEST_BENCH_ROLE=remote',
    'node',
    '--input-type=module',
    '-',
    '--project',
    project,
    '--runtime-root',
    runtimeRoot,
    '--cm-root',
    cmRoot,
  ];
  for (const role of memberRoles) parts.push('--member-role', role);
  return parts.map(shQuote).join(' ');
}

export function sshArgs(project, runtimeRoot, cmRoot, memberRoles = []) {
  return [SSH_ALIAS, remoteShellCommand(project, runtimeRoot, cmRoot, memberRoles)];
}

export function testDatabaseUrlFromEnvText(text) {
  const env = {};
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  const user = env.PGUSER;
  const password = env.PGPASSWORD;
  if (!user || password == null || password === '') {
    throw new Error('PGUSER/PGPASSWORD missing; DATABASE_URL_TEST is not implied by name or PG* fallback');
  }
  const host = env.PGHOST || '127.0.0.1';
  const port = env.PGPORT || '5432';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${TEST_DATABASE_NAME}`;
}

function readJsonField(text, label) {
  const match = String(text).match(new RegExp(`${label}:\\s*("(?:\\\\.|[^"])*")`, 'u'));
  if (!match) throw new Error(`slot config is missing ${label}`);
  return JSON.parse(match[1]);
}

export function inspectSlot(runtimeRoot, projectId, fs) {
  const id = assertProjectId(projectId);
  const port = projectPort(id);
  const io = fs;
  if (!io.existsSync(runtimeRoot)) throw new Error('runtime root is missing');
  const resolvedRoot = io.realpathSync(runtimeRoot);
  let remoteBase = '';
  let appText = '';
  let dir = resolvedRoot;
  const appName = `app${port}.config.js`;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, 'pm2.apps.d', appName);
    if (io.existsSync(candidate)) {
      remoteBase = dir;
      appText = io.readFileSync(candidate, 'utf8');
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!remoteBase) throw new Error('runtime root is not the project slot');
  const slotId = readJsonField(appText, 'COLLAB_PROJECT_ID');
  const cwdRaw = readJsonField(appText, 'cwd');
  if (slotId !== id) throw new Error(`slot project ${slotId} does not match ${id}`);
  const cwd = path.isAbsolute(cwdRaw) ? cwdRaw : path.join(remoteBase, cwdRaw);
  if (!io.existsSync(cwd) || io.realpathSync(cwd) !== resolvedRoot) {
    throw new Error('runtime root is not the release the slot serves');
  }
  const configPath = path.join(resolvedRoot, 'config.json');
  if (!io.existsSync(configPath)) throw new Error('release config.json is missing');
  const config = JSON.parse(io.readFileSync(configPath, 'utf8'));
  if (config.defaultProjectId !== id || !config.projects?.[id]) {
    throw new Error(`release config is not project ${id}`);
  }
  const seedJs = path.join(resolvedRoot, 'dist', 'local', '_102034_', 'l1', 'scripts', 'seedLocalTest.js');
  if (!io.existsSync(seedJs)) throw new Error('compiled seedLocalTest.js is missing from the release');
  const cmSeed = path.join(remoteBase, 'scripts', 'runtime', 'seedLocalTestCm.mjs');
  if (!io.existsSync(cmSeed)) throw new Error('seedLocalTestCm.mjs is missing on the VM checkout');
  const envPath = path.join(remoteBase, '.env');
  if (!io.existsSync(envPath)) throw new Error('VM .env is missing; refusing to invent DATABASE_URL_TEST');
  return { remoteBase, resolvedRoot, port, seedJs, cmSeed, envPath, origins: allowedOriginsFor(port) };
}

function personaByAlias(list, alias) {
  const found = (list ?? []).filter((item) => item?.alias === alias);
  if (found.length !== 1) throw new Error(`fragment is missing a single ${alias}`);
  return found[0];
}

export function buildManifest({ projectId, mdm, cm, cookieKey, origins }) {
  const id = assertProjectId(projectId);
  const port = projectPort(id);
  const expectedOrigins = allowedOriginsFor(port);
  if (!Array.isArray(origins) || origins.length !== expectedOrigins.length
    || origins.some((origin, index) => origin !== expectedOrigins[index])
    || origins.some((origin) => origin.includes('*'))) {
    throw new Error('allowedOrigins must be only the local slot');
  }
  if (cm?.storagePrefix !== 'desenv_') throw new Error('cm fragment storagePrefix is not desenv_');
  if (!mdm?.organizationKey || !mdm?.companyMdmId) throw new Error('mdm fragment is missing organization or company');
  const cmOrgId = `runtime-test:${id}`;
  if (mdm.companyMdmId === cmOrgId) throw new Error('cmOrgId must not be the company id');
  if (typeof cookieKey !== 'string' || Buffer.byteLength(cookieKey) < 32) {
    throw new Error('cookieKey must be at least 32 bytes');
  }
  const personas = {};
  const seenMdm = new Set();
  const seenCm = new Set();
  for (const alias of ALIASES) {
    const left = personaByAlias(mdm.personas, alias);
    const right = personaByAlias(cm.personas, alias);
    const email = localTestEmail(id, alias);
    const sub = localTestSub(id, alias);
    if (left.email !== email || right.email !== email || left.sub !== sub || right.sub !== sub) {
      throw new Error(`persona ${alias} does not match the bench email and sub`);
    }
    if (left.name !== BENCH_NAMES[alias]) throw new Error(`persona ${alias} name is not the bench name`);
    if (!left.personMdmId || !right.cmUserId) throw new Error(`persona ${alias} is missing an id`);
    if (seenMdm.has(left.personMdmId) || seenCm.has(right.cmUserId)) throw new Error('bench ids are not distinct');
    if (right.cmUserId === email || right.cmUserId === left.personMdmId || right.cmUserId === sub) {
      throw new Error(`cm user id for ${alias} collides with another bench id`);
    }
    seenMdm.add(left.personMdmId);
    seenCm.add(right.cmUserId);
    personas[alias] = {
      email,
      name: left.name,
      sub,
      personMdmId: left.personMdmId,
      cmUserId: right.cmUserId,
    };
  }
  return {
    schema: 1,
    scope: 'lima',
    projectId: id,
    organizationKey: mdm.organizationKey,
    companyMdmId: mdm.companyMdmId,
    cmTarget: CM_TARGET,
    cmOrgId,
    storagePrefix: 'desenv_',
    allowedOrigins: expectedOrigins,
    cookieKey,
    personas,
  };
}

export function keepCookieKey(previous, nextBytes = randomBytes(32)) {
  if (previous && previous.schema === 1 && previous.scope === 'lima'
    && typeof previous.cookieKey === 'string' && Buffer.byteLength(previous.cookieKey) >= 32) {
    return previous.cookieKey;
  }
  const key = Buffer.from(nextBytes).toString('base64url');
  if (Buffer.byteLength(key) < 32) throw new Error('generated cookieKey is shorter than 32 bytes');
  return key;
}

export function publicSummary(manifest, manifestFile) {
  const lines = [
    `manifest: ${manifestFile}`,
    `projectId: ${manifest.projectId}`,
    `organizationKey: ${manifest.organizationKey}`,
    `companyMdmId: ${manifest.companyMdmId}`,
    `cmOrgId: ${manifest.cmOrgId}`,
    `cmTarget: ${manifest.cmTarget}`,
    `storagePrefix: ${manifest.storagePrefix}`,
  ];
  for (const alias of ALIASES) {
    const persona = manifest.personas[alias];
    lines.push(
      `${alias}: email=${persona.email} sub=${persona.sub} personMdmId=${persona.personMdmId} cmUserId=${persona.cmUserId}`,
    );
  }
  const text = `${lines.join('\n')}\n`;
  if (/cookieKey|DATABASE_URL|secretAccess|PGPASSWORD/i.test(text)) {
    throw new Error('summary would leak a secret');
  }
  return text;
}

export function assertPublicText(text) {
  if (/cookieKey|DATABASE_URL|secretAccess|PGPASSWORD/i.test(text)) {
    throw new Error('refusing output that contains a secret');
  }
  return text;
}

function lastJson(text) {
  const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('{')) return JSON.parse(lines[i]);
  }
  throw new Error('seed returned no JSON fragment');
}

function readPrevious(file, fs) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('existing manifest is not readable JSON; refusing to replace it');
  }
}

export function publishManifest(file, manifest, fs) {
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (error) {
    const code = error && error.code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error('supervisor must grant write on /etc/collab/local-tests (mode 0700, file 0600)');
    }
    throw error;
  }
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  const body = `${JSON.stringify(manifest)}\n`;
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
}

function spawnSeed(spawn, commandArgs, cwd, env, label) {
  const result = spawn(commandArgs[0], commandArgs.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
  });
  if (!result || result.status !== 0) {
    const detail = result?.stderr?.trim() || result?.error?.message || 'no output';
    const error = new Error(`${label} failed: ${detail}`);
    error.resume = label;
    throw error;
  }
  return lastJson(result.stdout);
}

export function runOnVm(options) {
  const fs = options.fs ?? {
    existsSync, readFileSync, realpathSync, mkdirSync, writeFileSync, renameSync, chmodSync,
  };
  const spawn = options.spawnSync ?? spawnSync;
  const { project, runtimeRoot, cmRoot, memberRoles } = parseArgs(options.argv);
  if (!fs.existsSync(cmRoot)) throw new Error('cm root is missing');
  const slot = inspectSlot(runtimeRoot, project, fs);
  const manifestFile = path.join(options.manifestDir ?? MANIFEST_DIR, `${project}.json`);
  const previous = readPrevious(manifestFile, fs);
  const databaseUrl = testDatabaseUrlFromEnvText(fs.readFileSync(slot.envPath, 'utf8'));
  const childEnv = { ...process.env, DATABASE_URL_TEST: databaseUrl };
  let mdm;
  try {
    const seedArgs = ['node', slot.seedJs];
    for (const role of memberRoles) seedArgs.push('--member-role', role);
    mdm = spawnSeed(spawn, seedArgs, slot.resolvedRoot, childEnv, 'mdm');
  } catch (error) {
    error.resume = 'mdm';
    throw error;
  }
  let cm;
  try {
    cm = spawnSeed(
      spawn,
      ['node', slot.cmSeed, '--cm-root', cmRoot, '--project', project],
      slot.remoteBase,
      process.env,
      'cm',
    );
  } catch (error) {
    error.resume = 'cm';
    throw error;
  }
  const manifest = buildManifest({
    projectId: project,
    mdm,
    cm,
    cookieKey: keepCookieKey(previous, options.randomBytes ? options.randomBytes() : undefined),
    origins: slot.origins,
  });
  publishManifest(manifestFile, manifest, fs);
  return { manifestFile, summary: publicSummary(manifest, manifestFile), manifest };
}

export function hostMain(argv = process.argv.slice(2), spawn = spawnSync) {
  const args = parseArgs(argv);
  const command = sshArgs(args.project, args.runtimeRoot, args.cmRoot, args.memberRoles);
  if (command[0] !== SSH_ALIAS) throw new Error('ssh target is not lima-ubuntu24');
  const source = readFileSync(fileURLToPath(import.meta.url));
  const result = spawn('ssh', command, { input: source, encoding: 'utf8' });
  const stdout = result?.stdout ?? '';
  const stderr = result?.stderr ?? '';
  assertPublicText(stdout);
  if (stderr) process.stderr.write(stderr.endsWith('\n') || !stderr ? stderr : `${stderr}\n`);
  if (!result || result.status !== 0) {
    const detail = stderr.trim() || stdout.trim() || 'ssh failed';
    throw new Error(detail);
  }
  process.stdout.write(stdout.endsWith('\n') || !stdout ? stdout : `${stdout}\n`);
}

function isDirect() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

async function remoteMain() {
  const { summary } = await runOnVm({
    argv: process.argv.slice(2),
    manifestDir: process.env.LOCAL_TEST_BENCH_MANIFEST_DIR || undefined,
  });
  process.stdout.write(summary);
}

if (process.env.LOCAL_TEST_BENCH_ROLE === 'remote') {
  remoteMain().catch((error) => {
    const resume = error?.resume ? `resume: ${error.resume}\n` : '';
    process.stderr.write(`${resume}${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
} else if (isDirect()) {
  try {
    hostMain();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
