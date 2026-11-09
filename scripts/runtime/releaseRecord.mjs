// releaseRecord.mjs — the release record of the controleReleases contract (versaoContrato 2).
//
// ONE module writes it: open at the start of a release, continue it step by step, close it in a `finally`
// (also on failure), atomically, keeping the last 10 per queue and project. The same stamp that
// releaseStamp.mjs writes into releases/<id>/release.json is what this reads for "what changed", so there is
// no second source of what a release used.
//
// Where it lives: the project queues (base, libs, shared, app) under <root>/releases/registro/<releaseId>.json;
// the vm queue (the management, collab-runtime) under <etc>/releases/<releaseId>.json.
//
// Read only, for the sites over SSM (rt203; see releaseHistory.mjs):
//   releaseRecord.mjs list --fila <base|libs|shared|app|vm> [--projeto <id>] [--limite 10]
//   releaseRecord.mjs show <releaseId> [--projeto <id>]
// each prints ONE json line, last; `show` stays under 20,000 characters (cut marked, the libs that changed never cut).

import { chownSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { mainProjectOf, readSharedVersions } from './sharedApps.mjs';
import { HistoryError, listRecords, showRecord } from './releaseHistory.mjs';

export { readSharedVersions };

export const CONTRACT_VERSION = 2;
export const KEEP_PER_QUEUE = 10;
export const MAX_COMMITS = 200;
export const MAX_FILES = 50;
export const MAX_MESSAGE = 500;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const PROJECT_QUEUES = new Set(['base', 'libs', 'shared', 'app']);
const VM_QUEUES = new Set(['vm']);
const RELEASE_ID = /^\d{14}$/u;
const SECRET_LINE = /(?:secret|token|password|passwd|api[_-]?key|authorization|bearer|cookie)\b[^\n]*/giu;

export function isVmQueue(queue) {
  return VM_QUEUES.has(queue);
}

export function recordsDir(root, queue, { etcDir = '/data/etc' } = {}) {
  return isVmQueue(queue) ? join(etcDir, 'releases') : join(root, 'releases', 'registro');
}

/** A message short and free of secrets and of URLs with credentials. */
export function scrubMessage(value) {
  const text = String(value ?? '')
    .replace(/:\/\/[^\s/@:]+(?::[^\s/@]*)?@/gu, '://***@')
    .replace(SECRET_LINE, '[redacted]')
    .replace(/\s+/gu, ' ')
    .trim();
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text;
}

/** https://host/owner/repo for a git remote, without credentials or `.git`; null when it is not an https/ssh/scp GitHub-like address. */
export function cleanRepoUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const scp = /^git@([^:]+):(.+?)(?:\.git)?$/u.exec(text);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  try {
    const url = new URL(text);
    if (!['https:', 'http:', 'ssh:'].includes(url.protocol)) return null;
    const path = url.pathname.replace(/\.git$/u, '').replace(/\/+$/u, '');
    return path.split('/').filter(Boolean).length >= 2 ? `https://${url.hostname}${path}` : null;
  } catch {
    return null;
  }
}

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return (result.status ?? 1) === 0 ? String(result.stdout ?? '') : null;
}

export function repoUrlOf(repo) {
  if (!repo || !existsSync(join(repo, '.git'))) return null;
  return cleanRepoUrl(git(repo, ['remote', 'get-url', 'origin']));
}

/** git log between two commits: up to 200 commits, up to 50 files each, with `truncado` flags. */
export function commitsBetween(repo, from, to) {
  if (!repo || !from || !to || from === to) return { commits: [], truncado: false };
  const raw = git(repo, ['log', `--max-count=${MAX_COMMITS + 1}`, '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--name-only', `${from}..${to}`]);
  if (raw === null) return { commits: [], truncado: false };
  const rows = raw.split('\x1e').map((chunk) => chunk.trim()).filter(Boolean);
  const commits = rows.slice(0, MAX_COMMITS).map((row) => {
    const [head, ...files] = row.split('\n');
    const [sha, autor, data, mensagem] = head.split('\x1f');
    const arquivos = files.map((file) => file.trim()).filter(Boolean);
    return {
      sha, autor, data, mensagem: scrubMessage(mensagem),
      arquivos: arquivos.slice(0, MAX_FILES),
      ...(arquivos.length > MAX_FILES ? { truncado: true } : {}),
    };
  });
  return { commits, truncado: rows.length > MAX_COMMITS };
}

export function readSwVersion(root) {
  try {
    const text = readFileSync(join(root, 'static', 'mlsServiceWorker.js'), 'utf8');
    return /MLSSERVICEWORKERVERSION\s*=\s*["']([^"']+)["']/u.exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** `release.json` of a release folder, or null. */
export function readStamp(root, releaseId) {
  if (!releaseId) return null;
  try {
    return JSON.parse(readFileSync(join(root, 'releases', releaseId, 'release.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** The release id the project's alias points to right now (before this release activates), or null. */
export function activeReleaseId(root, clientId, { projectTree = false } = {}) {
  const names = projectTree || !clientId ? ['current'] : [`current-${clientId}`, 'current'];
  for (const name of names) {
    try {
      const id = basename(readlinkSync(join(root, name)));
      if (RELEASE_ID.test(id)) return id;
    } catch { /* no such alias */ }
  }
  return null;
}

/** What each piece was and is. `previous` is the stamp of the release that was active before, or null. */
export function buildPieces({ root, clientId, stamp, previous }) {
  const base = {
    commit: stamp.platformCommit ?? null,
    commitAnterior: previous?.platformCommit ?? null,
    repo: repoUrlOf(root),
  };
  const baseLog = commitsBetween(root, base.commitAnterior, base.commit);
  const libs = Object.entries(stamp.deps ?? {}).map(([id, arvore]) => {
    const dir = join(root, `mls-${id}`);
    const commit = stamp.depCommits?.[id] ?? null;
    const commitAnterior = previous?.depCommits?.[id] ?? null;
    const mudou = commit && commitAnterior ? commit !== commitAnterior : (previous?.deps?.[id] ?? null) !== arvore;
    const entry = { id: Number(id), commit, commitAnterior, arvore: arvore || null, repo: repoUrlOf(dir), mudou: Boolean(mudou) };
    if (mudou && commit && commitAnterior) {
      const log = commitsBetween(dir, commitAnterior, commit);
      entry.commits = log.commits;
      if (log.truncado) entry.truncado = true;
    }
    return entry;
  });
  const appDir = clientId ? join(root, `mls-${clientId}`) : '';
  const appLog = commitsBetween(appDir, previous?.versionRef, stamp.versionRef);
  return {
    base: { ...base, commits: baseLog.commits, ...(baseLog.truncado ? { truncado: true } : {}) },
    libs,
    ...(typeof stamp.libs === 'string' && stamp.libs !== '' && typeof stamp.monaco === 'string' && stamp.monaco !== ''
      ? {
        libStudio: {
          libs: stamp.libs,
          monaco: stamp.monaco,
          libsAnterior: previous?.libs ?? null,
          monacoAnterior: previous?.monaco ?? null,
        },
      }
      : {}),
    // The contract takes `versao` as text: a release with no service worker version (a fresh tree made by the migration)
    // leaves the piece out; the sites answered 400 to `versao: null`.
    ...(typeof stamp.swVersion === 'string' && stamp.swVersion !== ''
      ? { serviceWorker: { versao: stamp.swVersion, versaoAnterior: previous?.swVersion ?? null } }
      : {}),
    shared: Object.entries(stamp.sharedApps ?? {}).map(([nome, versao]) => ({
      nome, versao, versaoAnterior: previous?.sharedApps?.[nome] ?? null, repo: null,
    })),
    app: {
      commit: stamp.versionRef ?? null,
      commitAnterior: previous?.versionRef ?? null,
      repo: appDir ? repoUrlOf(appDir) : null,
      commits: appLog.commits,
      ...(appLog.truncado ? { truncado: true } : {}),
    },
  };
}

/**
 * The queue that triggered the release. COLLAB_RELEASE_QUEUE wins when it is a project queue. A release asked by
 * the sites (a request id) is, in this order, `base` when the platform changed, `libs` when a dependency, the
 * Studio lib or the service worker changed, `shared` when a shared app (the cm) changed, else `app`. A push or the Studio's Publish (no request id) is `app`.
 */
export function decideQueue({ requested, hasRequest, pieces }) {
  if (PROJECT_QUEUES.has(requested)) return requested;
  if (!hasRequest || !pieces) return 'app';
  const { base, libs, libStudio, serviceWorker, shared = [] } = pieces;
  if (base.commitAnterior && base.commit !== base.commitAnterior) return 'base';
  const studioChanged = (libStudio?.libsAnterior && libStudio.libs !== libStudio.libsAnterior)
    || (libStudio?.monacoAnterior && libStudio.monaco !== libStudio.monacoAnterior);
  const swChanged = serviceWorker?.versaoAnterior && serviceWorker.versao !== serviceWorker.versaoAnterior;
  if (libs.some((lib) => lib.mudou) || studioChanged || swChanged) return 'libs';
  if (shared.some((item) => item.versaoAnterior && item.versao !== item.versaoAnterior)) return 'shared';
  return 'app';
}

/** Atomic write: temp file in the same folder, then rename. */
/** A script run as root (collab msg update) must not leave files the release scripts (ubuntu) cannot rewrite or prune. */
function matchOwner(path, reference) {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
  try {
    const owner = statSync(reference);
    chownSync(path, owner.uid, owner.gid);
  } catch { /* best effort */ }
}

export function writeRecordFile(dir, releaseId, record) {
  const existed = existsSync(dir);
  mkdirSync(dir, { recursive: true });
  if (!existed) matchOwner(dir, dirname(dir));
  const target = join(dir, `${releaseId}.json`);
  const tmp = join(dir, `.${releaseId}.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(tmp, target);
  matchOwner(target, dir);
  return target;
}

export function readRecordFile(dir, releaseId) {
  try {
    return JSON.parse(readFileSync(join(dir, `${releaseId}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/** Keep the last `keep` records of one queue and project (by release id); remove the rest. */
export function pruneRecords(dir, { fila, projetoId }, keep = KEEP_PER_QUEUE) {
  if (!existsSync(dir)) return [];
  const mine = [];
  for (const name of readdirSync(dir)) {
    const match = /^(\d{14})\.json$/u.exec(name);
    if (!match) continue;
    const record = readRecordFile(dir, match[1]);
    if (record && record.fila === fila && (record.projetoId ?? null) === (projetoId ?? null)) mine.push(match[1]);
  }
  const removed = mine.sort().reverse().slice(keep);
  for (const id of removed) {
    rmSync(join(dir, `${id}.json`), { force: true });
    rmSync(join(dir, `${id}.aviso-pendente`), { force: true });
  }
  return removed;
}

/**
 * Close, as `falhou`, the records still `andamento` after `olderThanMs` (a step that does not run through node, like
 * the sites' `git pull`, can stop a release without closing it). The failing step is the last one left open.
 */
export function closeStaleRecords(dir, { now = Date.now, olderThanMs = STALE_AFTER_MS } = {}) {
  const closed = [];
  if (!existsSync(dir)) return closed;
  for (const name of readdirSync(dir)) {
    const match = /^(\d{14})\.json$/u.exec(name);
    if (!match) continue;
    const record = readRecordFile(dir, match[1]);
    if (!record || record.resultado !== 'andamento') continue;
    const started = Date.parse(record.inicio);
    if (!Number.isFinite(started) || now() - started < olderThanMs) continue;
    const open = [...(record.passos ?? [])].reverse().find((item) => item.resultado === 'andamento');
    for (const item of record.passos ?? []) if (item.resultado === 'andamento') item.resultado = 'falhou';
    record.resultado = 'falhou';
    record.falha = { passo: open?.nome ?? record.passos?.at(-1)?.nome ?? 'start', mensagem: 'sem fechamento: passo terminou fora do runtime' };
    record.fim = nowIso(now);
    record.duracaoMs = now() - started;
    writeRecordFile(dir, match[1], record);
    addNoticeSafely(dir, match[1], 'release.finished');
    closed.push(match[1]);
  }
  return closed;
}

/**
 * The notices the sites has not confirmed yet, in `<releaseId>.aviso-pendente` next to the record (`{ codes: [...] }`).
 * The release script never talks to the sites (it must not read the agent's secret): the agent sends them and
 * removes a code only after the sites confirms it. Writing a notice is idempotent.
 */
export function pendingNoticeFile(dir, releaseId) {
  return join(dir, `${releaseId}.aviso-pendente`);
}

export function readPendingNotice(dir, releaseId) {
  try {
    const parsed = JSON.parse(readFileSync(pendingNoticeFile(dir, releaseId), 'utf8'));
    return Array.isArray(parsed?.codes) ? parsed.codes.filter((code) => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

export function addPendingNotice(dir, releaseId, code) {
  const codes = readPendingNotice(dir, releaseId);
  if (codes.includes(code)) return codes;
  codes.push(code);
  mkdirSync(dir, { recursive: true });
  const target = pendingNoticeFile(dir, releaseId);
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ codes }, null, 2)}\n`);
  renameSync(tmp, target);
  matchOwner(target, dir);
  return codes;
}

/** Remove one confirmed code; the file goes away with its last code. */
export function confirmPendingNotice(dir, releaseId, code) {
  const codes = readPendingNotice(dir, releaseId).filter((item) => item !== code);
  const target = pendingNoticeFile(dir, releaseId);
  if (codes.length === 0) {
    rmSync(target, { force: true });
    return [];
  }
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ codes }, null, 2)}\n`);
  renameSync(tmp, target);
  return codes;
}

/** An open (andamento) record asked by this request id, if one was left by an earlier step of the request. */
export function findOpenRequest(dir, requestId) {
  if (!requestId || !existsSync(dir)) return null;
  for (const name of readdirSync(dir).sort().reverse()) {
    const match = /^(\d{14})\.json$/u.exec(name);
    if (!match) continue;
    const record = readRecordFile(dir, match[1]);
    if (record && record.pedidoId === requestId && record.resultado === 'andamento') return record;
  }
  return null;
}

function addNoticeSafely(dir, releaseId, code) {
  try {
    addPendingNotice(dir, releaseId, code);
  } catch (error) {
    process.stderr.write(`releaseRecord: notice ${code} not written: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

function nowIso(now) {
  return new Date(now()).toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

/**
 * Open the record (or continue the one this request already opened). The returned handle runs steps and
 * closes the record; `step` and `close` never throw because of the record itself, only because of the step.
 */
export function openRelease({
  root, dir = recordsDir(root, 'app'), releaseId, queue = 'app', projectId = null, vmId = 'unknown',
  requestId = null, requestedBy = '', anterior = null, now = Date.now,
}) {
  try {
    closeStaleRecords(dir, { now });
  } catch (error) {
    process.stderr.write(`releaseRecord: stale sweep failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  const continued = findOpenRequest(dir, requestId);
  const id = continued?.releaseId ?? releaseId;
  if (continued) {
    // The first step of a sites request (deps) does not know the project yet: the release step fills it in.
    if (continued.projetoId === null && projectId !== null && projectId !== undefined) continued.projetoId = Number(projectId);
    if (!continued.anterior && anterior) continued.anterior = anterior;
  }
  const record = continued ?? {
    versaoContrato: CONTRACT_VERSION,
    releaseId: id,
    fila: queue,
    projetoId: projectId === null || projectId === undefined ? null : Number(projectId),
    vmId: String(vmId),
    pedidoId: requestId || null,
    pedidoPor: scrubMessage(requestedBy),
    inicio: nowIso(now),
    fim: null,
    duracaoMs: null,
    resultado: 'andamento',
    falha: null,
    passos: [],
    anterior: anterior ?? null,
    pecas: {},
  };
  const started = continued ? Date.parse(continued.inicio) : now();
  const persist = () => {
    try {
      writeRecordFile(dir, id, record);
    } catch (error) {
      process.stderr.write(`releaseRecord: could not write ${id}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  };
  persist();
  // A release the sites did not ask for (push, Studio) has no record there yet: tell it when it starts.
  if (!continued && !requestId) addNoticeSafely(dir, id, 'release.started');

  const handle = {
    releaseId: id,
    record,
    continued: Boolean(continued),
    step(name, fn) {
      const startedAt = now();
      const entry = { nome: name, inicio: nowIso(() => startedAt), duracaoMs: null, resultado: 'andamento' };
      record.passos.push(entry);
      persist();
      try {
        const value = fn();
        entry.resultado = 'ok';
        return value;
      } catch (error) {
        entry.resultado = 'falhou';
        record.falha = { passo: name, mensagem: scrubMessage(error instanceof Error ? error.message : String(error)) };
        throw error;
      } finally {
        entry.duracaoMs = now() - startedAt;
        persist();
      }
    },
    /** A step that failed outside `step()` (the deferred pm2 reload): record it as the failing step. */
    markFailed(name, error) {
      const message = scrubMessage(error instanceof Error ? error.message : String(error));
      const entry = record.passos.find((item) => item.nome === name);
      if (entry) entry.resultado = 'falhou';
      else record.passos.push({ nome: name, inicio: nowIso(now), duracaoMs: 0, resultado: 'falhou' });
      record.falha = { passo: name, mensagem: message };
      persist();
    },
    /** Close it: ok, or falhou with the step where it stopped. `pieces` and `queue` are best effort. */
    close({ error = null, pieces = null, queue: decided = null } = {}) {
      try {
        if (pieces) record.pecas = pieces;
        if (decided) record.fila = decided;
        if (error || record.falha) {
          record.resultado = 'falhou';
          if (!record.falha) {
            record.falha = { passo: record.passos.at(-1)?.nome ?? 'start', mensagem: scrubMessage(error instanceof Error ? error.message : String(error ?? '')) };
          }
        } else {
          record.resultado = 'ok';
        }
        record.fim = nowIso(now);
        record.duracaoMs = now() - started;
        persist();
        addNoticeSafely(dir, id, 'release.finished');
        pruneRecords(dir, { fila: record.fila, projetoId: record.projetoId });
      } catch (closeError) {
        process.stderr.write(`releaseRecord: could not close ${id}: ${closeError instanceof Error ? closeError.message : String(closeError)}\n`);
      }
      return record;
    },
  };
  return handle;
}

/** The VM id the sites uses: COLLAB_VM_ID, else only the server id key of the agent env file, else the host name. */
export function readVmId({ env = process.env, agentEnvFile = '/etc/collab/sites-agent.env' } = {}) {
  if (String(env.COLLAB_VM_ID ?? '').trim()) return String(env.COLLAB_VM_ID).trim();
  try {
    const line = readFileSync(agentEnvFile, 'utf8').split(/\r?\n/u).find((row) => row.startsWith('COLLAB_SITES_SERVER_ID='));
    const value = line ? line.slice('COLLAB_SITES_SERVER_ID='.length).trim().replace(/^["']|["']$/gu, '') : '';
    if (value) return value;
  } catch { /* no agent on this machine */ }
  return hostname();
}

/** Who asked: the sites' actor, or the author of the commit that was pushed (`push:`), or the Studio user (`studio:`). */
export function requestedByFor({ env = process.env, appDir = '' } = {}) {
  const fromSites = String(env.COLLAB_RELEASE_REQUESTED_BY ?? '').trim();
  if (fromSites) return fromSites;
  const author = appDir && existsSync(join(appDir, '.git')) ? (git(appDir, ['log', '-1', '--format=%ae'])?.trim() ?? '') : '';
  const prefix = String(env.COLLAB_RELEASE_ORIGIN ?? '') === 'studio' ? 'studio' : 'push';
  return `${prefix}:${author || 'unknown'}`;
}

/** yyyyMMddHHmmss, the folder name of a release (same shape as addNewVersion.makeReleaseId). */
export function newReleaseId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * A step that runs after the release script has closed its record (the hook reloads pm2 on its own, outside
 * `addNewVersion`): add it to the newest recently closed record that does not have it yet. A failure turns the
 * record `falhou` at that step; a new `release.finished` notice carries the final record to the sites.
 */
export function appendLateStep(dir, name, { ok = true, message = '', durationMs = 0, windowMs = 10 * 60 * 1000, now = Date.now } = {}) {
  if (!existsSync(dir)) return null;
  for (const file of readdirSync(dir).sort().reverse()) {
    const match = /^(\d{14})\.json$/u.exec(file);
    if (!match) continue;
    const record = readRecordFile(dir, match[1]);
    if (!record || record.resultado === 'andamento' || !record.fim) continue;
    if (now() - Date.parse(record.fim) > windowMs) return null; // the newest closed one is too old: nothing to attach to
    if ((record.passos ?? []).some((item) => item.nome === name)) return null;
    record.passos = [...(record.passos ?? []), { nome: name, inicio: nowIso(() => now() - durationMs), duracaoMs: durationMs, resultado: ok ? 'ok' : 'falhou' }];
    if (!ok) {
      record.resultado = 'falhou';
      record.falha = record.falha ?? { passo: name, mensagem: scrubMessage(message || `${name} failed`) };
    }
    writeRecordFile(dir, match[1], record);
    addNoticeSafely(dir, match[1], 'release.finished');
    return record;
  }
  return null;
}

/** `releaseRecord.mjs close --pedido <id> [--falha <passo>] [--mensagem <texto>] [--root <raiz>]`: the sites closes a request that stopped. */
export function closeRequest({ dir, requestId, step = 'platform', message = 'step failed', now = Date.now }) {
  const record = findOpenRequest(dir, requestId);
  if (!record) return null;
  const started = Date.parse(record.inicio);
  for (const item of record.passos ?? []) if (item.resultado === 'andamento') item.resultado = 'falhou';
  if (!(record.passos ?? []).some((item) => item.nome === step)) record.passos.push({ nome: step, inicio: nowIso(now), duracaoMs: 0, resultado: 'falhou' });
  record.resultado = 'falhou';
  record.falha = { passo: step, mensagem: scrubMessage(message) };
  record.fim = nowIso(now);
  record.duracaoMs = Number.isFinite(started) ? now() - started : null;
  writeRecordFile(dir, record.releaseId, record);
  addNoticeSafely(dir, record.releaseId, 'release.finished');
  return record;
}

/** The project a shared app (the cm) belongs to: COLLAB_RELEASE_PROJECT_ID, shared.json, then the smallest id (see sharedApps.mjs). */
export function resolveSharedProject({ env = process.env, projectsDir = '/data/etc/projects', log = () => {}, nome = 'cm', etcDir } = {}) {
  const found = mainProjectOf(nome, { env, etcDir: etcDir ?? dirname(projectsDir), projectsDir, log });
  return found ? found.projectId : null;
}

/** Where a project's records live: its own tree when it exists, else the shared tree. */
export function projectRecordsRoot(projectId, { dataRoot = '/data' } = {}) {
  const own = join(dataRoot, `app${projectId}`, 'mls-base');
  return existsSync(own) ? own : join(dataRoot, 'mls-base');
}

/**
 * Write a whole record in one go (the management update and the cm update are not `addNewVersion`): `fila` vm or
 * shared. `pecas` and `passos` come from the caller; the notice `release.finished` is left for the agent.
 */
export function writeStandaloneRecord({
  dir, queue, projectId = null, vmId, requestId = null, requestedBy = '', anterior = null, started, ended = Date.now(),
  ok = true, failedStep = '', message = '', steps = [], pecas = {}, releaseId = newReleaseId(new Date(started ?? ended)),
}) {
  const record = {
    versaoContrato: CONTRACT_VERSION,
    releaseId,
    fila: queue,
    projetoId: projectId === null || projectId === undefined ? null : Number(projectId),
    vmId: String(vmId),
    pedidoId: requestId || null,
    pedidoPor: scrubMessage(requestedBy),
    inicio: nowIso(() => started ?? ended),
    fim: nowIso(() => ended),
    duracaoMs: Math.max(0, ended - (started ?? ended)),
    resultado: ok ? 'ok' : 'falhou',
    falha: ok ? null : { passo: failedStep || steps.at(-1) || 'update', mensagem: scrubMessage(message || 'update failed') },
    passos: steps.map((name, index) => ({ nome: name, inicio: nowIso(() => started ?? ended), duracaoMs: 0, resultado: !ok && index === steps.length - 1 ? 'falhou' : 'ok' })),
    anterior: anterior ?? null,
    pecas,
  };
  if (requestId === null || requestId === '') addNoticeSafely(dir, releaseId, 'release.started');
  writeRecordFile(dir, releaseId, record);
  addNoticeSafely(dir, releaseId, 'release.finished');
  pruneRecords(dir, { fila: queue, projetoId: record.projetoId });
  return record;
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

function standaloneFromArgs(argv, env = process.env) {
  const started = Date.parse(flag(argv, '--inicio') ?? '') || undefined;
  const ok = (flag(argv, '--resultado') ?? 'ok') !== 'falhou';
  return {
    started,
    ok,
    failedStep: flag(argv, '--falha') ?? '',
    message: flag(argv, '--mensagem') ?? '',
    requestId: String(env.COLLAB_RELEASE_REQUEST_ID ?? '').trim() || null,
    requestedBy: String(env.COLLAB_RELEASE_REQUESTED_BY ?? '').trim() || `cli:${env.SUDO_USER || env.USER || 'root'}`,
    vmId: readVmId({ env }),
    steps: (flag(argv, '--passos') ?? '').split(',').map((item) => item.trim()).filter(Boolean),
  };
}

/** `list` and `show` (rt203): read-only, one json line LAST on stdout, an error is a message on stderr and a code != 0. */
function historyCli(argv) {
  const dataRoot = flag(argv, '--data-root') ?? '/data';
  const etcDir = flag(argv, '--etc');
  try {
    const result = argv[0] === 'list'
      ? listRecords({ fila: flag(argv, '--fila'), projeto: flag(argv, '--projeto'), limite: flag(argv, '--limite'), dataRoot, etcDir })
      : showRecord({ releaseId: argv[1], projeto: flag(argv, '--projeto'), dataRoot, etcDir });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof HistoryError)) throw error;
    process.stderr.write(`releaseRecord ${argv[0]}: ${error.message}\n`);
    return error.code;
  }
}

function cli(argv) {
  if (argv[0] === 'list' || argv[0] === 'show') return historyCli(argv);
  if (argv[0] === 'vm') {
    // releaseRecord.mjs vm --antes <sha> --depois <sha> [--repo-dir <pasta>] [--etc <pasta>] [--passos a,b] [--resultado ok|falhou] [--falha <passo>] [--mensagem <t>] [--inicio <iso>]
    const base = standaloneFromArgs(argv);
    const etc = flag(argv, '--etc') ?? '/data/etc';
    const repoDir = flag(argv, '--repo-dir');
    const record = writeStandaloneRecord({
      ...base,
      dir: recordsDir('', 'vm', { etcDir: etc }),
      queue: 'vm',
      pecas: { gestao: { commit: flag(argv, '--depois') ?? null, commitAnterior: flag(argv, '--antes') ?? null, repo: repoDir ? repoUrlOf(repoDir) : null, passos: base.steps } },
    });
    process.stdout.write(`recorded vm ${record.releaseId} ${record.resultado}\n`);
    return 0;
  }
  if (argv[0] === 'shared') {
    // releaseRecord.mjs shared --nome cm --antes <versao> --depois <versao> [--projeto <id>] [--data-root <pasta>] ...
    const base = standaloneFromArgs(argv);
    const dataRoot = flag(argv, '--data-root') ?? '/data';
    const projectId = flag(argv, '--projeto') ?? resolveSharedProject({ projectsDir: join(dataRoot, 'etc', 'projects'), log: (line) => process.stderr.write(`${line}\n`) });
    if (!projectId) {
      process.stderr.write('releaseRecord: no project on this VM for the shared app; record not written\n');
      return 0;
    }
    const root = projectRecordsRoot(projectId, { dataRoot });
    const previous = activeReleaseId(root, projectId, { projectTree: root !== join(dataRoot, 'mls-base') });
    const record = writeStandaloneRecord({
      ...base,
      dir: recordsDir(root, 'shared'),
      queue: 'shared',
      projectId,
      anterior: previous,
      pecas: { shared: [{ nome: flag(argv, '--nome') ?? 'cm', versao: flag(argv, '--depois') ?? null, versaoAnterior: flag(argv, '--antes') || null, repo: null }] },
    });
    process.stdout.write(`recorded shared ${record.releaseId} project ${projectId} ${record.resultado}\n`);
    return 0;
  }
  if (argv[0] !== 'close') {
    process.stderr.write('usage: releaseRecord.mjs close|vm|shared|list|show ... (see the header of the file)\n');
    return 2;
  }
  const root = resolve(flag(argv, '--root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const requestId = flag(argv, '--pedido');
  if (!requestId) {
    process.stderr.write('close: --pedido is required\n');
    return 2;
  }
  const record = closeRequest({
    dir: recordsDir(root, 'app'), requestId, step: flag(argv, '--falha') ?? 'platform', message: flag(argv, '--mensagem') ?? 'step failed',
  });
  process.stdout.write(record ? `closed ${record.releaseId} as falhou at ${record.falha.passo}\n` : `no open record for ${requestId}\n`);
  return 0;
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) process.exit(cli(process.argv.slice(2)));
