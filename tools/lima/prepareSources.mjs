// Fontes do 102047 a partir do Mac. Não migra, não semeia e não marca a reserva como ready.
// Must run on Mac (lima) AND Windows (multipass). Read mls-base/skills/crossPlatform.md first.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDepIds, snapshotTree } from '../../scripts/publishGitDeps.mjs';
import { loadOwnerRef, shQuote, spawnArgsFor, statusSession } from './session.mjs';

export const PROJECT_ID = '102047';
export const VM_ROOT = '/data/mls-base';
export const BUILD_LOCK = `${VM_ROOT}/.gitbuild.lock`;
const MARKER_OK = /##gitBackend build=ok release=(\d{14}) project=mls-102047##/;
const MARKER_ERR = /##gitBackend build=error\b/;
const OBJ_SUBJECT = 'chore: remove obj/ (build happens on the VM)';
const REBUILD_SUBJECT = /^publish: rebuild after deps \S+(?: \S+)*$/u;

export function readPin(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const pin = pkg.collabLibs || {};
  const libs = typeof pin.libs === 'string' ? pin.libs.trim() : '';
  const monaco = typeof pin.monaco === 'string' ? pin.monaco.trim() : '';
  if (!/^\d{14}$/u.test(libs) || !/^\d{14}$/u.test(monaco)) {
    throw Object.assign(new Error('collabLibs pin missing'), { code: 'pin', sent: false });
  }
  return { libs, monaco };
}

function git(repo, args, env = process.env, raw = false) {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', repo, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({
      code: code ?? 1,
      stdout: raw ? stdout : stdout.trim(),
      stderr: stderr.trim(),
    }));
  });
}

export async function captureRepo(repo, env) {
  const head = await git(repo, ['rev-parse', 'HEAD'], env);
  const status = await git(repo, ['status', '--porcelain'], env);
  const subject = await git(repo, ['log', '-1', '--pretty=%s'], env);
  const snap = snapshotTree(repo, env);
  return {
    sha: head.code === 0 ? head.stdout : '',
    dirty: status.code !== 0 || status.stdout.length > 0,
    subject: subject.code === 0 ? subject.stdout : '',
    tree: snap.ok ? snap.tree : '',
    lock: existsSync(join(repo, '.collab-msg.lock')),
  };
}

export async function planLocalSources(root, projectId = PROJECT_ID, env = process.env) {
  if (String(projectId) !== PROJECT_ID) {
    throw Object.assign(new Error(`project refused: ${projectId}`), { code: 'project', sent: false });
  }
  const pin = readPin(root);
  const platform = await captureRepo(root, env);
  const appRepo = join(root, `mls-${projectId}`);
  const app = await captureRepo(appRepo, env);
  const declared = readDepIds(appRepo, projectId);
  if (declared.includes('102056')) {
    throw Object.assign(new Error('refusing project 102056'), { code: 'project', sent: false });
  }
  const depIds = declared.filter((id) => existsSync(join(root, `mls-${id}`, '.git')));
  const deps = [];
  for (const id of depIds) deps.push({ id, ...(await captureRepo(join(root, `mls-${id}`), env)) });
  const blocked = [];
  if (platform.dirty) blocked.push('mls-base');
  if (platform.lock) blocked.push('mls-base:.collab-msg.lock');
  if (app.dirty) blocked.push(`mls-${projectId}`);
  if (app.lock) blocked.push(`mls-${projectId}:.collab-msg.lock`);
  for (const dep of deps) {
    if (dep.dirty) blocked.push(`mls-${dep.id}`);
    if (dep.lock) blocked.push(`mls-${dep.id}:.collab-msg.lock`);
  }
  return {
    projectId,
    pin,
    rootSha: platform.sha,
    appSha: app.sha,
    appTree: app.tree,
    appSubject: app.subject,
    deps: deps.map((dep) => ({ id: dep.id, sha: dep.sha, tree: dep.tree, subject: dep.subject })),
    blocked,
  };
}

function planKey(plan) {
  return JSON.stringify({
    rootSha: plan.rootSha,
    appSha: plan.appSha,
    appTree: plan.appTree,
    pin: plan.pin,
    deps: plan.deps,
    blocked: plan.blocked,
  });
}

// Mirrors gitignoreCoversObj in scripts/publishGit.mjs (that module runs main on import); keep both equal.
function gitignoreCoversObj(text) {
  const candidates = new Set(['/obj/', 'obj', '/obj', 'obj/', '**/obj', '**/obj/']);
  return text.split(/\r?\n/u).some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && candidates.has(trimmed);
  });
}

function gitignoreAppended(before, after) {
  if (gitignoreCoversObj(before)) return false;
  const glue = before.length === 0 || before.endsWith('\n') ? '' : '\n';
  return after === `${before}${glue}/obj/\n`;
}

function parseRawDiff(text) {
  if (!text) return [];
  const parts = text.split('\0');
  if (parts.at(-1) === '') parts.pop();
  const entries = [];
  for (let i = 0; i < parts.length;) {
    const meta = parts[i];
    if (!meta?.startsWith(':')) return null;
    const tokens = meta.slice(1).split(' ');
    if (tokens.length < 5) return null;
    const [oldMode, newMode, oldSha, newSha, status] = tokens;
    const renamed = status.startsWith('R') || status.startsWith('C');
    const path = parts[i + 1];
    const newPath = renamed ? parts[i + 2] : path;
    if (!path || (renamed && !newPath)) return null;
    entries.push({ oldMode, newMode, oldSha, newSha, status, path, newPath });
    i += renamed ? 3 : 2;
  }
  return entries;
}

function objDeletion(entry) {
  return entry.status === 'D'
    && entry.newMode === '000000'
    && entry.path === entry.newPath
    && (entry.path === 'obj' || entry.path.startsWith('obj/'));
}

async function blobBytes(repo, sha, env) {
  if (/^0+$/u.test(sha)) return '';
  const read = await git(repo, ['cat-file', '-p', '--', sha], env, true);
  if (read.code !== 0) return null;
  return read.stdout;
}

async function commitKind(repo, sha, subject, env) {
  const diff = await git(repo, ['diff-tree', '-z', '-r', '--raw', '--no-commit-id', '-M', sha], env, true);
  if (diff.code !== 0) return '';
  const entries = parseRawDiff(diff.stdout);
  if (!entries) return '';
  if (REBUILD_SUBJECT.test(subject)) return entries.length === 0 ? 'rebuild' : '';
  if (subject !== OBJ_SUBJECT || entries.length === 0) return '';
  let gitignore = 0;
  for (const entry of entries) {
    if (objDeletion(entry)) continue;
    if (entry.path !== '.gitignore' || entry.newPath !== '.gitignore') return '';
    if (entry.status !== 'A' && entry.status !== 'M') return '';
    if (entry.newMode !== '100644') return '';
    if (entry.status === 'M' && entry.oldMode !== '100644') return '';
    const before = await blobBytes(repo, entry.oldSha, env);
    const after = await blobBytes(repo, entry.newSha, env);
    if (before == null || after == null || !gitignoreAppended(before, after)) return '';
    gitignore += 1;
    if (gitignore > 1) return '';
  }
  return 'clean';
}

async function portraitMatches(repo, before, after, env) {
  const diff = await git(repo, ['diff-tree', '-z', '-r', '--raw', '-M', before.appTree, after.appTree], env, true);
  if (diff.code !== 0) return false;
  const entries = parseRawDiff(diff.stdout);
  if (!entries) return false;
  return entries.every((entry) => entry.path === '.gitignore' && entry.newPath === '.gitignore'
    && (entry.status === 'A' || entry.status === 'M')
    && entry.newMode === '100644');
}

async function allowedAfterPublish(before, after, root, projectId, env) {
  if (before.rootSha !== after.rootSha) return false;
  if (before.pin.libs !== after.pin.libs || before.pin.monaco !== after.pin.monaco) return false;
  if (before.blocked.length || after.blocked.length) return false;
  if (JSON.stringify(before.deps) !== JSON.stringify(after.deps)) return false;
  if (before.appSha === after.appSha) return before.appTree === after.appTree;
  const repo = join(root, `mls-${projectId}`);
  const listed = await git(repo, ['rev-list', '--reverse', `${before.appSha}..${after.appSha}`], env);
  if (listed.code !== 0) return false;
  const shas = listed.stdout.split('\n').filter(Boolean);
  if (shas.length < 1 || shas.length > 2 || shas.at(-1) !== after.appSha) return false;
  let parent = before.appSha;
  const kinds = [];
  for (const sha of shas) {
    const meta = await git(repo, ['log', '-1', '--format=%P%n%s', sha], env, true);
    if (meta.code !== 0 || !meta.stdout) return false;
    const splitAt = meta.stdout.indexOf('\n');
    if (splitAt < 0) return false;
    const parents = meta.stdout.slice(0, splitAt).split(' ').filter(Boolean);
    const subject = meta.stdout.slice(splitAt + 1).replace(/\n$/u, '');
    if (parents.length !== 1 || parents[0] !== parent) return false;
    const kind = await commitKind(repo, sha, subject, env);
    if (!kind) return false;
    kinds.push(kind);
    parent = sha;
  }
  const accepted = (kinds.length === 1 && (kinds[0] === 'clean' || kinds[0] === 'rebuild'))
    || (kinds.length === 2 && kinds[0] === 'clean' && kinds[1] === 'rebuild');
  if (!accepted) return false;
  return portraitMatches(repo, before, after, env);
}

function ssh(profile, command, options) {
  const sshBin = options.sshBin || process.env.LIMA_SSH_BIN || 'ssh';
  const timeoutMs = options.timeoutMs ?? 120000;
  return new Promise((resolve) => {
    const [bin, binArgs] = spawnArgsFor(sshBin, ['-F', profile.sshConfig, profile.alias, command]);
    const child = spawn(bin, binArgs, {
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ code: null, stdout, stderr, uncertain: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish({ code: null, stdout, stderr: error.message, uncertain: true }));
    child.on('close', (code) => {
      finish({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        uncertain: code == null || code === 255,
      });
    });
  });
}

// git runs GIT_SSH_COMMAND in sh on every platform: quoted, with `/` (Windows accepts it too).
function shPath(value) {
  return shQuote(String(value).replaceAll('\\', '/'));
}

async function pushRoot(root, profile, capturedSha, remoteSha, options) {
  const url = `ssh://${profile.alias}${VM_ROOT}`;
  const sshBin = options.sshBin || process.env.LIMA_SSH_BIN || 'ssh';
  const env = {
    ...process.env,
    ...options.env,
    GIT_SSH_COMMAND: `${spawnArgsFor(sshBin, []).flat().map(shPath).join(' ')} -F ${shPath(profile.sshConfig)}`,
  };
  return git(root, [
    'push',
    `--force-with-lease=refs/heads/main:${remoteSha}`,
    url,
    `${capturedSha}:refs/heads/main`,
  ], env);
}

export function publishCommand(root, projectId = PROJECT_ID) {
  return [process.execPath, [join(root, 'scripts', 'publishGit.mjs'), String(projectId), 'local'], { cwd: root }];
}

function runPublish(root, projectId, options) {
  if (options.spawnPublish) return options.spawnPublish({ projectId, autocommit: false, cwd: root });
  const spec = publishCommand(root, projectId);
  return new Promise((resolve) => {
    const child = spawn(spec[0], spec[1], {
      cwd: spec[2].cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({
      code: code ?? 1,
      stdout,
      stderr,
      text: `${stdout}\n${stderr}`,
      uncertain: code == null || code === 255,
    }));
  });
}

function markerOf(text) {
  if (MARKER_ERR.test(text || '')) return { kind: 'error' };
  const ok = MARKER_OK.exec(text || '');
  if (ok) return { kind: 'ok', releaseId: ok[1] };
  return { kind: 'absent' };
}

async function readVm(profile, plan, options) {
  const rootSha = await ssh(profile, `git -C ${VM_ROOT} rev-parse HEAD`, options);
  const appSha = await ssh(profile, `git -C ${VM_ROOT}/mls-${PROJECT_ID} rev-parse HEAD`, options);
  const alias = await ssh(profile, `readlink ${VM_ROOT}/current-${PROJECT_ID}`, options);
  const workersRaw = await ssh(profile, 'pm2 jlist', options);
  if ([rootSha, appSha, alias].some((item) => item.uncertain || item.code !== 0)) {
    return { uncertain: true };
  }
  const releasePath = alias.stdout.startsWith('/') ? alias.stdout : `${VM_ROOT}/${alias.stdout}`;
  const stampRaw = await ssh(profile,
    `node -e 'const fs=require("node:fs"); const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const keep=["id","client","versionRef","platformCommit","libs","monaco"]; const out={}; for (const key of keep) out[key]=j[key]??null; process.stdout.write(JSON.stringify(out));' ${releasePath}/release.json`,
    options);
  let stamp = null;
  try { stamp = JSON.parse(stampRaw.stdout); } catch { stamp = null; }
  let workers = [];
  try {
    const list = JSON.parse(workersRaw.stdout || '[]');
    workers = (Array.isArray(list) ? list : []).map((item) => ({
      name: item.name || '',
      cwd: item.pm2_env?.pm_cwd || '',
    }));
  } catch {
    workers = [];
  }
  const depTrees = {};
  for (const dep of plan.deps) {
    const tree = await ssh(profile, `git -C ${VM_ROOT}/mls-${dep.id} rev-parse 'HEAD^{tree}'`, options);
    if (tree.uncertain || tree.code !== 0) return { uncertain: Boolean(tree.uncertain), stamp, workers, alias: alias.stdout, depTrees };
    depTrees[dep.id] = tree.stdout;
  }
  return {
    uncertain: Boolean(stampRaw.uncertain),
    rootSha: rootSha.stdout,
    appSha: appSha.stdout,
    alias: alias.stdout,
    stamp,
    workers,
    depTrees,
  };
}

function sourcesMatch(plan, vm, appSha) {
  const stamp = vm.stamp;
  if (!stamp) return false;
  if (stamp.platformCommit !== plan.rootSha) return false;
  if (stamp.versionRef !== appSha) return false;
  if (stamp.libs !== plan.pin.libs || stamp.monaco !== plan.pin.monaco) return false;
  if (String(stamp.client || '') !== PROJECT_ID) return false;
  if (!String(vm.alias || '').includes(String(stamp.id || ''))) return false;
  const app2047 = (vm.workers || []).find((item) => item.name === 'app2047');
  if (!app2047) return false;
  if (!app2047.cwd.includes(`current-${PROJECT_ID}`)) return false;
  for (const dep of plan.deps) {
    if (vm.depTrees[dep.id] !== dep.tree) return false;
  }
  return true;
}

function failed(phase, extra = {}) {
  return { ok: false, ready: false, phase, ...extra };
}

export async function prepareSources({
  root,
  projectId = PROJECT_ID,
  profile,
  session,
  env = process.env,
  sshBin,
  timeoutMs,
  lockPath,
  spawnPublish,
} = {}) {
  const options = { env, sshBin, timeoutMs, spawnPublish };
  const sessionOptions = { sshBin, env, timeoutMs, lockPath: lockPath || process.env.LIMA_LOCK_PATH };
  if (String(projectId) !== PROJECT_ID) return failed('preparing', { code: 'project', sent: false });
  const ref = loadOwnerRef(profile, session);
  if (!ref?.operationId) return failed('preparing', { code: 'operation', sent: false });
  const status = await statusSession(profile, session, sessionOptions);
  if ((status.browsers || []).length > 0) return failed('preparing', { code: 'browser', sent: false });

  let plan;
  try {
    plan = await planLocalSources(root, projectId, env);
  } catch (error) {
    return failed('preparing', { code: error.code || 'plan', sent: false, message: error.message });
  }
  if (plan.blocked.length) return failed('preparing', { code: 'dirty', sent: false, blocked: plan.blocked });
  let again;
  try {
    again = await planLocalSources(root, projectId, env);
  } catch (error) {
    return failed('preparing', { code: error.code || 'plan', sent: false });
  }
  if (planKey(plan) !== planKey(again)) return failed('preparing', { code: 'concurrent', sent: false });

  const vmHead = await ssh(profile, `git -C ${VM_ROOT} rev-parse HEAD`, options);
  if (vmHead.uncertain || vmHead.code !== 0) return failed('failed', { code: 'ssh', sent: false, uncertain: true });

  let sent = false;
  const rootChanged = vmHead.stdout !== plan.rootSha;
  if (rootChanged) {
    const pushed = await pushRoot(root, profile, plan.rootSha, vmHead.stdout, options);
    sent = true;
    if (pushed.code !== 0) return failed('failed', { code: 'root-push', sent: true, uncertain: true });
    const seen = await ssh(profile, `git -C ${VM_ROOT} rev-parse HEAD`, options);
    if (seen.uncertain || seen.stdout !== plan.rootSha) return failed('failed', { code: 'root-sha', sent: true, uncertain: true });
  }

  let mid;
  try {
    mid = await planLocalSources(root, projectId, env);
  } catch (error) {
    return failed(sent ? 'failed' : 'preparing', { code: 'concurrent', sent, uncertain: sent });
  }
  if (planKey(plan) !== planKey(mid)) return failed(sent ? 'failed' : 'preparing', { code: 'concurrent', sent, uncertain: sent });

  const published = await runPublish(root, projectId, options);
  const publishText = published.text || `${published.stdout || ''}\n${published.stderr || ''}`;
  const appPushed = !/Nothing to publish/u.test(publishText);
  if (appPushed || published.uncertain) sent = true;
  if (published.uncertain || published.code == null) {
    return failed('failed', { code: 'publish-disconnect', sent: true, uncertain: true });
  }

  let after;
  try {
    after = await planLocalSources(root, projectId, env);
  } catch (error) {
    return failed('failed', { code: 'concurrent', sent: true, uncertain: true });
  }
  if (!await allowedAfterPublish(plan, after, root, projectId, env)) {
    return failed('failed', {
      code: 'concurrent', sent: true, uncertain: true, initialAppSha: plan.appSha, finalAppSha: after.appSha,
    });
  }
  const publishMarker = markerOf(publishText);
  if (publishMarker.kind === 'error' || (published.code !== 0 && appPushed)) {
    return failed('failed', { code: 'build', sent: true, initialAppSha: plan.appSha, finalAppSha: after.appSha });
  }

  let observed = await readVm(profile, plan, options);
  if (observed.uncertain) return failed('failed', { code: 'ssh', sent, uncertain: true });
  let buildText = publishText;
  let forcedBuild = false;
  const coherent = sourcesMatch(plan, observed, after.appSha);
  if (!coherent) {
    if (appPushed && publishMarker.kind === 'ok') {
      return failed('failed', { code: 'release', sent: true });
    }
    const built = await ssh(profile,
      `flock ${BUILD_LOCK} node ${VM_ROOT}/scripts/runtime/gitPostReceive.mjs --root ${VM_ROOT} --project ${PROJECT_ID}`,
      options);
    forcedBuild = true;
    sent = true;
    buildText += `\n${built.stdout}\n${built.stderr}`;
    if (built.uncertain) return failed('failed', { code: 'build-disconnect', sent: true, uncertain: true });
    if (markerOf(`${built.stdout}\n${built.stderr}`).kind !== 'ok') {
      return failed('failed', { code: 'build', sent: true });
    }
    observed = await readVm(profile, plan, options);
    if (observed.uncertain) return failed('failed', { code: 'ssh', sent: true, uncertain: true });
  }
  if (markerOf(buildText).kind === 'error') return failed('failed', { code: 'build', sent });
  if (!sourcesMatch(plan, observed, after.appSha)) return failed('failed', { code: 'release', sent });
  return {
    ok: true,
    ready: false,
    phase: 'sources',
    sent,
    forcedBuild,
    evidence: {
      projectId,
      pin: plan.pin,
      initialRootSha: plan.rootSha,
      initialAppSha: plan.appSha,
      finalAppSha: after.appSha,
      depTrees: observed.depTrees,
      release: observed.stamp,
      alias: observed.alias,
      workers: (observed.workers || []).filter((item) => item.name === 'app2047'),
    },
  };
}

const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === entry) {
  process.stderr.write('prepareSources is a library; the prepare command arrives in s7\n');
  process.exit(2);
}
