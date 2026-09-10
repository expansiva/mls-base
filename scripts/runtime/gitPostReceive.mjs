#!/usr/bin/env node
// gitPostReceive.mjs — compile the pushed mls-* project and, incrementally,
// the client's fecho (`l5/config.json` projects, no --force); on success cut a
// release via addNewVersion.mjs. Invoked by gitPostReceive.sh while holding
// /data/mls-base/.gitbuild.lock. The shell wrapper always exits 0 (A1).
//
// Gate = the same offline buildCI path as buildProjectsObj.mjs
// (BUILDCI_OFFLINE=1, cwd = mls-base). Type-error verdict comes from
// ##typeCheck## markers (l5/project.json status, gb74) — not from whether
// buildCI recompiled the project. Compile itself stays tolerant (decision
// #19). Syntax / broken import / emit still block. Declaration-pass errors
// become declWarn=N on the success marker. If the typeCheck marker is
// missing (old buildCI), fall back to the pass=code count — never the
// other way around. Marker lines are the gb3 contract — one line, exact
// format. Client l5/config.json is validated warn-only (Wagner 06/09):
// named list in the log + ##clientConfig## marker; never blocks the release.

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTypeCheckMarkers } from '../typeCheckPolicy.mjs';
import { pathIdsOf } from '../syncTsconfigPaths.mjs';
import {
  clientConfigMarker,
  formatClientConfigWarn,
  validateClientConfigFile,
} from '../validateClientConfig.mjs';
import { VM_TSCONFIG, writeVmTsconfig } from './addNewVersion.mjs';
import { ensureProjectApp, hostedProjectIds } from './vmApps.mjs';
import { appNameOf, projectIdToPort, releaseAliasOf } from './projectPorts.mjs';

const TSC_ERROR_LINES = 40;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');

function failUsage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('##gitBackend build=error project=unknown##\n');
  process.exit(0);
}

function parseArgs(argv) {
  let root = DEFAULT_ROOT;
  let project = '';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      root = resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--project' && argv[i + 1]) {
      project = argv[i + 1];
      i += 1;
    }
  }
  return { root, project };
}

/**
 * Opções de push (`git push -o …`) chegam ao hook por ambiente. Requer
 * `receive.advertisePushOptions=true` no repo da VM (gitReposSetup).
 */
export function readPushOptions(env = process.env) {
  const count = Number(env.GIT_PUSH_OPTION_COUNT ?? 0);
  if (!Number.isInteger(count) || count <= 0) return [];
  const options = [];
  for (let i = 0; i < count; i += 1) {
    const value = env[`GIT_PUSH_OPTION_${i}`];
    if (typeof value === 'string' && value) options.push(value);
  }
  return options;
}

/**
 * gb13: o push de um dep de plataforma vem com `skip-build` (só registra); o
 * push do cliente vem por último com `deps=<ids>` e é ele que manda compilar os
 * deps alterados, em ordem, antes do próprio cliente — UMA release no fim.
 */
export function parseBuildPlan(options) {
  const skipBuild = options.includes('skip-build');
  const deps = [];
  for (const option of options) {
    const match = /^deps=(.*)$/u.exec(option);
    if (!match) continue;
    for (const id of match[1].split(/[\s,]+/u)) {
      if (/^\d+$/u.test(id) && !deps.includes(id)) deps.push(id);
    }
  }
  return { skipBuild, deps };
}

function projectIdOf(project) {
  const m = /^(?:mls-)?(\d+)$/u.exec(String(project).trim());
  return m ? m[1] : '';
}

function hasTscError(text) {
  return /\berror TS\d+/u.test(text);
}

export function parsePassErrors(text, pass) {
  const re = new RegExp(`##buildCI pass=${pass} errors=(\\d+)##`, 'u');
  const m = re.exec(String(text));
  return m ? Number(m[1]) : null;
}

export function regionBeforePassMarker(text, pass) {
  const marker = `##buildCI pass=${pass} errors=`;
  const raw = String(text);
  const end = raw.indexOf(marker);
  if (end < 0) return raw;
  const before = raw.slice(0, end);
  const prev = before.lastIndexOf('##buildCI pass=');
  return prev >= 0 ? before.slice(prev) : before;
}

function typeCheckFromMarkers(text) {
  const markers = parseTypeCheckMarkers(text);
  if (markers.length === 0) return null;
  let type = 0;
  let blocking = 0;
  let status = 'permissive';
  const blocked = [];
  for (const marker of markers) {
    type += marker.verdict.type;
    blocking += marker.verdict.blocking;
    if (marker.status === 'strict') status = 'strict';
    if (marker.verdict.block) blocked.push(marker.projectId);
  }
  return {
    ok: blocked.length === 0,
    gate: 'typeCheck',
    typeWarn: type,
    typeCheckStatus: status,
    excerptText: blocked.length > 0 ? text : '',
    blocked,
  };
}

export function evaluateBuild(code, out) {
  const text = String(out ?? '');
  const codeErrors = parsePassErrors(text, 'code');
  const declErrors = parsePassErrors(text, 'declarations') ?? 0;
  const typeCheck = typeCheckFromMarkers(text);

  if (typeCheck) {
    if (!typeCheck.ok) {
      return { ...typeCheck, declWarn: declErrors };
    }
    if (code !== 0) {
      return {
        ok: false,
        gate: 'exit',
        declWarn: declErrors,
        typeWarn: typeCheck.typeWarn,
        typeCheckStatus: typeCheck.typeCheckStatus,
        excerptText: codeErrors != null ? regionBeforePassMarker(text, 'code') : text,
      };
    }
    return {
      ok: true,
      gate: 'typeCheck',
      declWarn: declErrors,
      typeWarn: typeCheck.typeWarn,
      typeCheckStatus: typeCheck.typeCheckStatus,
      excerptText: '',
    };
  }

  if (code !== 0) {
    return {
      ok: false,
      gate: 'exit',
      declWarn: declErrors,
      excerptText: codeErrors != null ? regionBeforePassMarker(text, 'code') : text,
    };
  }

  if (codeErrors == null) {
    return {
      ok: !hasTscError(text),
      gate: 'fallback',
      declWarn: 0,
      excerptText: text,
    };
  }

  if (codeErrors > 0) {
    return {
      ok: false,
      gate: 'pass=code',
      declWarn: declErrors,
      excerptText: regionBeforePassMarker(text, 'code'),
    };
  }

  return {
    ok: true,
    gate: 'pass=code',
    declWarn: declErrors,
    excerptText: '',
  };
}

export function gateMessage(verdict) {
  if (verdict.gate === 'fallback') {
    return 'gitPostReceive: gate=fallback (no ##buildCI pass=code## marker)';
  }
  if (verdict.gate === 'exit') {
    return 'gitPostReceive: gate=exit (build.code!=0)';
  }
  if (verdict.gate === 'typeCheck') {
    const blocked = Array.isArray(verdict.blocked) ? verdict.blocked.filter(Boolean) : [];
    if (blocked.length > 0) {
      return `gitPostReceive: gate=typeCheck blocked projects=${blocked.join(',')}`;
    }
    return `gitPostReceive: gate=typeCheck status=${verdict.typeCheckStatus ?? 'permissive'}`;
  }
  return 'gitPostReceive: gate=pass=code';
}

export function formatOkMarker(project, ts, declWarn) {
  // gb3 token stays exact (`project=mls-N##`) so publishGit's MARKER_OK still
  // matches. declWarn is a suffix on the same line, not inside the token.
  const marker = `##gitBackend build=ok release=${ts} project=${project}##`;
  return declWarn > 0 ? `${marker} declWarn=${declWarn}` : marker;
}

/**
 * Retrato de plataforma recebido: entrou no worktree, não compila aqui. Marcador
 * próprio para o terminal do dev não confundir com um build=ok que não houve.
 */
export function formatSkippedMarker(project) {
  return `##gitBackend build=skipped project=${project}## snapshot received; compiles on the client push`;
}

export function firstTscExcerpt(text, n = TSC_ERROR_LINES) {
  const lines = String(text).split(/\r?\n/u);
  const selected = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\berror TS\d+/u.test(lines[i])) continue;
    selected.push(lines[i]);
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      if (!lines[j].trim()) break;
      if (/\berror TS\d+/u.test(lines[j])) break;
      selected.push(lines[j]);
    }
  }
  if (selected.length > 0) return selected.slice(0, n).join('\n');
  return lines.filter((line) => line.trim()).slice(0, n).join('\n');
}

// D-A2: build.mjs recomposes mls-<id>/l5/config.json in the worktree, copies it
// to <root>/config.json and from there into the release — so the runtime reads
// the RELEASE copy and the worktree one is only an intermediate. Left dirty it
// would make `receive.denyCurrentBranch=updateInstead` refuse the NEXT push, so
// after a successful release the source form is restored. Untracked files are
// left alone (they never block updateInstead).
export function trackedDirtyPaths(porcelain) {
  return String(porcelain ?? '')
    .split(/\r?\n/u)
    .filter((line) => line.trim() && !line.startsWith('??'))
    .map((line) => line.slice(3).trim())
    .map((path) => (path.includes(' -> ') ? path.split(' -> ').pop().trim() : path))
    .filter(Boolean);
}

function git(repo, args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function restoreWorktree(root, projectName) {
  const repo = join(root, projectName);
  if (!existsSync(join(repo, '.git'))) return;
  const status = git(repo, ['status', '--porcelain']);
  if (status.code !== 0) return;
  const dirty = trackedDirtyPaths(status.out);
  if (dirty.length === 0) return;
  const restored = git(repo, ['checkout', '--', ...dirty]);
  const still = trackedDirtyPaths(git(repo, ['status', '--porcelain']).out);
  if (restored.code !== 0 || still.length > 0) {
    process.stderr.write(
      `worktree still dirty in ${projectName} (${still.join(' ') || 'checkout error'}) — ` +
        'the next push may be refused by updateInstead\n',
    );
    return;
  }
  process.stderr.write(`worktree restored: ${dirty.join(' ')} (rewritten by the build, already in the release)\n`);
}

/**
 * Quem empurrou (gb50) × quem assinou o commit.
 *
 * O `/git/` do 102034 exporta `COLLAB_PUSH_ACTOR_EMAIL` com o e-mail do token JWT, e o receive-pack
 * herda esse ambiente até aqui. O hook é o ÚNICO ponto que vê o commit que chegou, então é aqui que a
 * divergência se anota. Alpha (gb50): anota, não recusa — um commit assinado com outro e-mail é o caso
 * normal de quem tem duas identidades git, e recusar o push por isso trocaria auditoria por bloqueio.
 *
 * Sem a variável (push por ssh/lima) não há nada para comparar e a função não escreve nada.
 */
export function authorNote(actorEmail, commitEmail) {
  if (!actorEmail) return '';
  if (!commitEmail) return `push por ${actorEmail} (autor do commit desconhecido)`;
  if (actorEmail.trim().toLowerCase() === commitEmail.trim().toLowerCase()) return '';
  return `push por ${actorEmail}, commit assinado por ${commitEmail} — identidades divergentes`;
}

/**
 * VM: refresh tsconfig.vm.json from the mls-* folders on disk. Never write
 * the versioned tsconfig.json — a dirty tree blocks `git pull --ff-only`
 * (Atualizar plataforma).
 *
 * Mac: addMissingTsconfigPaths (publishGit / projectInit) stays the writer
 * of the versioned file. There the repo is the source and the entry is
 * committed with the project.
 */
export function ensureTsconfigPaths(root, write = (text) => process.stderr.write(text)) {
  const previousFile = existsSync(join(root, VM_TSCONFIG))
    ? join(root, VM_TSCONFIG)
    : join(root, 'tsconfig.json');
  const before = existsSync(previousFile)
    ? new Set(pathIdsOf(readFileSync(previousFile, 'utf8')))
    : new Set();
  const ids = writeVmTsconfig(root);
  const added = ids.filter((id) => !before.has(id));
  if (added.length) {
    write(
      `gitPostReceive: ${VM_TSCONFIG} paths: added ${added.map((id) => `"/_${id}_/*"`).join(', ')}` +
        ' — setup mapping, not an agent error.\n',
    );
  }
  return added;
}

/**
 * Warn-only. collab-sites *Build release* calls this hook without publishGit,
 * so this is the place that always sees a release. Missing shellTemplates is
 * not a degraded app — it is an app that will 502 — but the release still
 * goes up (Wagner 06/09): the named list is logged, never a throw / exit != 0.
 */
export function reportClientConfig(root, projectId, {
  write = (text) => process.stderr.write(text),
  now = () => new Date().toISOString(),
} = {}) {
  const configPath = join(root, `mls-${projectId}`, 'l5', 'config.json');
  const result = validateClientConfigFile(configPath);
  write(`${formatClientConfigWarn(result, 'gitPostReceive:')}\n`);
  write(`${clientConfigMarker(result)}\n`);
  try {
    mkdirSync(join(root, 'logs'), { recursive: true });
    appendFileSync(
      join(root, 'logs', 'git-push.jsonl'),
      `${JSON.stringify({
        at: now(),
        projectId,
        endpoint: 'clientConfig',
        ok: result.ok,
        errors: result.errors,
      })}\n`,
    );
  } catch (error) {
    write(`gitPostReceive: clientConfig log not written (${error.message})\n`);
  }
  return result;
}

function notePushActor(root, projectName) {
  const actorEmail = process.env.COLLAB_PUSH_ACTOR_EMAIL ?? '';
  if (!actorEmail) return;
  const repo = join(root, projectName);
  const head = git(repo, ['log', '-1', '--format=%H%n%ae']);
  const [commit = '', commitEmail = ''] = head.code === 0 ? head.out.trim().split('\n') : [];
  const note = authorNote(actorEmail, commitEmail);
  if (note) process.stderr.write(`gitPostReceive: ${note}\n`);
  try {
    mkdirSync(join(root, 'logs'), { recursive: true });
    appendFileSync(
      join(root, 'logs', 'git-push.jsonl'),
      `${JSON.stringify({
        at: new Date().toISOString(),
        email: actorEmail,
        projectId: projectName.replace(/^mls-/u, ''),
        endpoint: 'post-receive',
        commit,
        commitAuthor: commitEmail,
        note,
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(`gitPostReceive: push log not written (${error.message})\n`);
  }
}

function currentReleaseId(root, alias = 'current') {
  try {
    const target = readlinkSync(join(root, alias));
    const base = String(target).split('/').pop() ?? '';
    return /^\d{14}$/u.test(base) ? base : '';
  } catch {
    return '';
  }
}

// The VM's config.json names the client this machine is running. build.mjs
// refuses to guess when several client apps sit on disk.
function clientOf(path, expectedId = '') {
  try {
    const config = JSON.parse(readFileSync(path, 'utf8'));
    const found = Object.entries(config.projects ?? {}).find(([, project]) => project?.type === 'client');
    const id = found?.[0] ?? '';
    return expectedId && id !== expectedId ? '' : id;
  } catch {
    return '';
  }
}

/**
 * Quem é o cliente desta release. gb15 item 2: quem manda é o PROJETO
 * EMPURRADO, não o config.json do root — numa VM com N projetos o root é do
 * último publish e empurrar B recompilava A calado. Só se o projeto empurrado
 * não for um cliente (push de plataforma) é que se cai no root.
 * Devolve `{ clientId, ownClient }`. `ownClient` = o empurrado É o app
 * cliente (ensureProjectApp, fecho daquele cliente). O alias por projeto
 * não depende só disto: ver `releaseAliasesToFlip`.
 */
export function clientIdForRelease(root, pushedId = '') {
  const own = pushedId ? clientOf(join(root, `mls-${pushedId}`, 'l5', 'config.json'), pushedId) : '';
  if (own) return { clientId: own, ownClient: true };
  return { clientId: clientOf(join(root, 'config.json')), ownClient: false };
}

/**
 * Quais aliases `current-<id>` esta release deve virar.
 *
 * Push do próprio app (`ownClient`): só o alias daquele cliente — o vizinho
 * fica na release que já serve.
 * Push de biblioteca: a release é um snapshot da árvore inteira e o asset
 * static é servido do cwd do processo (`current-<id>`). Vira o alias de
 * TODOS os clientes em `pm2.apps.d/`. Sem o scan, o defeito só muda
 * de lugar: some para o `clientId` do root/config.json, fica para o outro
 * app da VM.
 * `pm2.apps.d/` vazio + `clientId` resolvido: vira esse um (primeiro app,
 * ou lima sem aggregator ainda).
 */
export function releaseAliasesToFlip({ root, clientId, ownClient }) {
  if (ownClient && clientId) return [releaseAliasOf(clientId)];
  const hosted = hostedProjectIds(root);
  if (hosted.length > 0) return hosted.map((id) => releaseAliasOf(id));
  if (clientId) return [releaseAliasOf(clientId)];
  return [];
}

export function formatReleaseAliasLines(aliases) {
  return aliases.map((alias) => {
    const id = String(alias).replace(/^current-/u, '');
    const port = projectIdToPort(id);
    return `gitPostReceive: app ${appNameOf(port)} (porta ${port}) → ${alias}`;
  });
}

export function formatReleaseAliasFlip(aliases, releaseId) {
  if (!aliases.length || !releaseId) return '';
  return `gitPostReceive: ${aliases.join(', ')} → releases/${releaseId}`;
}

/**
 * Env do `addNewVersion` + side-effect de `ensureProjectApp` no push do app.
 * Push de biblioteca NÃO cria app pm2 — só preenche `COLLAB_RELEASE_ALIAS`.
 */
export function prepareReleaseEnv({ root, clientId, ownClient, env = process.env }) {
  const releaseEnv = { ...env, CBE_BUILD_OBJS: 'false' };
  let appName = clientId ? appNameOf(projectIdToPort(clientId)) : '';
  let replacedLegacy = false;
  if (ownClient && clientId) {
    const app = ensureProjectApp({ root, projectId: clientId });
    appName = app.appName;
    replacedLegacy = app.replacedLegacy;
  }
  const aliases = releaseAliasesToFlip({ root, clientId, ownClient });
  if (aliases.length > 0) {
    releaseEnv.COLLAB_RELEASE_ALIAS = aliases.join(',');
  }
  return { releaseEnv, aliases, appName, replacedLegacy };
}

/** Ids in `config.projects` — the release fecho the browser will load from obj/compiled.zip. */
export function fechoProjectIds(config) {
  return Object.keys(config?.projects ?? {}).filter((id) => /^\d+$/u.test(String(id)));
}

export function readFechoIds(root, clientId) {
  if (!clientId) return [];
  try {
    const config = JSON.parse(readFileSync(join(root, `mls-${clientId}`, 'l5', 'config.json'), 'utf8'));
    return fechoProjectIds(config);
  } catch {
    return [];
  }
}

export function fechoMissingMessage(id) {
  return `gitPostReceive: mls-${id} does not exist on the VM — ignored`;
}

/**
 * Incremental compile of the client's fecho: `--only` the projects on disk,
 * never `--force`. Missing folders are logged, not a failure (same as deps).
 */
export function planFechoCompile(root, clientId) {
  const ids = readFechoIds(root, clientId);
  const present = [];
  const missing = [];
  for (const id of ids) {
    if (existsSync(join(root, `mls-${id}`))) present.push(id);
    else missing.push(id);
  }
  return {
    ids,
    present,
    missing,
    args: present.length > 0
      ? ['scripts/runtime/buildProjectsObj.mjs', '--only', present.join(',')]
      : null,
  };
}

export function parseBuildObjSummary(out) {
  const m = /\[buildProjectsObj\] summary: built \[([^\]]*)\] \| up-to-date \[([^\]]*)\] \| failed \[([^\]]*)\]/u
    .exec(String(out ?? ''));
  const parse = (raw) => {
    const text = String(raw ?? '').trim();
    if (!text || text === '-') return [];
    return text.split(',').map((part) => part.trim()).filter(Boolean);
  };
  if (!m) return { built: [], skipped: [], failed: [] };
  return { built: parse(m[1]), skipped: parse(m[2]), failed: parse(m[3]) };
}

function asMls(id) {
  return `mls-${String(id).replace(/^mls-/u, '')}`;
}

/**
 * A batched `--only a,b,c` exits 0 when any id is up-to-date even if another
 * failed (`buildProjectsObj` only exits 1 when nothing built and nothing skipped).
 * Name the failed project the same way the dep loop names a dep.
 */
export function fechoCompileVerdict(code, out, fallbackIds = []) {
  const verdict = evaluateBuild(code, out);
  const summary = parseBuildObjSummary(out);
  if (summary.failed.length > 0) {
    return { ok: false, project: asMls(summary.failed[0]), verdict };
  }
  if (!verdict.ok) {
    const named = verdict.blocked?.[0] ?? fallbackIds[0];
    return { ok: false, project: named ? asMls(named) : 'mls-unknown', verdict };
  }
  return { ok: true, project: '', verdict };
}

export async function compileFecho(root, clientId, { run = runLive, write = (text) => process.stderr.write(text) } = {}) {
  const plan = planFechoCompile(root, clientId);
  for (const id of plan.missing) write(`${fechoMissingMessage(id)}\n`);
  if (!plan.args) return { ok: true, project: '', present: plan.present };
  write(`gitPostReceive: compilando fecho ${plan.present.map((id) => `mls-${id}`).join(', ')}\n`);
  const build = await run('node', plan.args, {
    cwd: root,
    env: { ...process.env, BUILDCI_OFFLINE: '1' },
  });
  const result = fechoCompileVerdict(build.code, build.out, plan.present);
  if (result.ok) {
    for (const id of plan.present) restoreWorktree(root, `mls-${id}`);
  }
  return { ...result, present: plan.present };
}

function runLive(command, args, opts) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const take = (buf) => {
      const text = buf.toString();
      out += text;
      process.stderr.write(text);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => {
      const message = `failed to start ${command}: ${error.message}\n`;
      process.stderr.write(message);
      resolvePromise({ code: 1, out: out + message });
    });
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, out });
    });
  });
}

export function formatErrorOutput(project, verdict) {
  const parts = [gateMessage(verdict)];
  if (hasTscError(verdict.excerptText)) {
    const excerpt = firstTscExcerpt(verdict.excerptText);
    if (excerpt) parts.push(excerpt);
  }
  parts.push(`##gitBackend build=error project=${project}##`);
  return `${parts.join('\n')}\n`;
}

function printError(project, verdict) {
  process.stderr.write(formatErrorOutput(project, verdict));
}

/**
 * True when this hook runs under git-http-backend (the app serves /git/).
 *
 * CGI vars (`GIT_PROJECT_ROOT` + `REQUEST_METHOD`) are mounted by any parent that
 * can serve a push — including a 102034 that predates `COLLAB_GIT_HTTP`. The flag
 * stays as a cheap extra signal; it is not the decision.
 */
export function shouldDeferPm2Reload(env = process.env) {
  if (env.COLLAB_GIT_HTTP === '1') return true;
  return Boolean(env.GIT_PROJECT_ROOT) && Boolean(env.REQUEST_METHOD);
}

export function pm2ConfigRel(root) {
  return existsSync(join(root, 'pm2.config.js')) ? 'pm2.config.js' : 'servers/pm2.config.js';
}

export function parsePm2Jlist(text) {
  const raw = String(text ?? '');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clusterWorkers(jlist, appName) {
  if (!appName || !Array.isArray(jlist)) return [];
  return jlist.filter((proc) => proc?.name === appName);
}

export function restartTimesById(jlist, appName) {
  const out = {};
  for (const proc of clusterWorkers(jlist, appName)) {
    out[String(proc.pm_id)] = Number(proc?.pm2_env?.restart_time ?? 0);
  }
  return out;
}

export function formatStaleWorkerLog(appName, pmId) {
  return `${appName} worker ${pmId} still on the previous release`;
}

/**
 * Workers of `appName` that did not come up after `reloadStartedAt`.
 * Stale = `pm_uptime` not newer than the reload start, or `restart_time` did
 * not advance for a pm_id we saw before the reload.
 */
export function staleClusterWorkers(jlist, { appName, reloadStartedAt, restartTimeBefore = {} } = {}) {
  return clusterWorkers(jlist, appName).filter((proc) => {
    const uptime = Number(proc?.pm2_env?.pm_uptime ?? 0);
    const restart = Number(proc?.pm2_env?.restart_time ?? 0);
    const before = restartTimeBefore[String(proc.pm_id)];
    const uptimeFresh = uptime > reloadStartedAt;
    const restartAdvanced = before === undefined ? true : restart > before;
    return !(uptimeFresh && restartAdvanced);
  });
}

async function loadPm2Jlist({ jlistFn, root, env }) {
  if (jlistFn) {
    const raw = await jlistFn();
    return Array.isArray(raw) ? raw : parsePm2Jlist(raw);
  }
  const listed = spawnSync('pm2', ['jlist'], { cwd: root, env, encoding: 'utf8' });
  return parsePm2Jlist(`${listed.stdout ?? ''}${listed.stderr ?? ''}`);
}

/**
 * Reload in a new session after a delay, so git-http-backend can finish writing
 * the hook output before pm2 kills the app that owns the TCP connection.
 * The child is this same script with `--reload-pm2` (reload + worker detector).
 */
export function scheduleDetachedPm2Reload(root, { spawnFn = spawn, delaySec = 2, appName = '' } = {}) {
  const pm2Config = pm2ConfigRel(root);
  mkdirSync(join(root, 'logs'), { recursive: true });
  const logPath = join(root, 'logs', 'gitPostReceive-pm2-reload.log');
  const args = [fileURLToPath(import.meta.url), '--reload-pm2', '--root', root, '--delay', String(delaySec)];
  if (appName) args.push('--app', appName);
  const fd = openSync(logPath, 'a');
  const child = spawnFn(process.execPath, args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  try { closeSync(fd); } catch { /* inherited */ }
  if (typeof child?.unref === 'function') child.unref();
  process.stderr.write(
    `gitPostReceive: pm2 reload in ${delaySec}s outside the hook tree (${pm2Config}) — ` +
      'on https the reload kills the process that serves /git/\n',
  );
  return { pm2Config, delaySec, appName, logPath };
}

export async function reloadPm2Now(root, {
  appName = '',
  run = runLive,
  jlistFn,
  now = Date.now,
  write = (text) => process.stderr.write(text),
  env = process.env,
} = {}) {
  const pm2Config = pm2ConfigRel(root);
  mkdirSync(join(root, 'logs'), { recursive: true });
  write(`--- pm2 reload (${pm2Config})\n`);

  const listed = appName
    ? await loadPm2Jlist({ jlistFn, root, env })
    : [];
  const restartTimeBefore = appName ? restartTimesById(listed, appName) : {};
  const reloadStartedAt = now();

  let last = { code: 1, out: '' };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    last = await run('pm2', ['startOrReload', pm2Config, '--update-env'], { cwd: root, env });
    if (last.code === 0) break;
    if (attempt < 3) {
      write(`--- retry ${attempt}/2 after failure\n`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  if (last.code !== 0) {
    write(`gitPostReceive: pm2 reload failed (exit ${last.code}) — the release is already in current\n`);
  }

  if (appName) {
    const after = await loadPm2Jlist({ jlistFn, root, env });
    const stale = staleClusterWorkers(after, { appName, reloadStartedAt, restartTimeBefore });
    for (const proc of stale) write(`${formatStaleWorkerLog(appName, proc.pm_id)}\n`);
    if (stale.length > 0) {
      write('gitPostReceive: retry pm2 reload (uneven workers)\n');
      last = await run('pm2', ['startOrReload', pm2Config, '--update-env'], { cwd: root, env });
      const again = await loadPm2Jlist({ jlistFn, root, env });
      const still = staleClusterWorkers(again, { appName, reloadStartedAt, restartTimeBefore });
      for (const proc of still) write(`${formatStaleWorkerLog(appName, proc.pm_id)}\n`);
    }
  }

  try {
    await run('pm2', ['save'], { cwd: root, env });
  } catch {
    /* non-fatal */
  }
}

async function main() {
  const { root, project } = parseArgs(process.argv.slice(2));
  const id = projectIdOf(project);
  if (!id) failUsage(`gitPostReceive: invalid project "${project}"`);
  const projectName = `mls-${id}`;

  notePushActor(root, projectName);

  const { skipBuild, deps } = parseBuildPlan(readPushOptions());

  // Dep de plataforma: o retrato entra no worktree e pronto. Quem compila é o
  // push do cliente, que vem a seguir com `deps=…` — assim N deps alterados dão
  // UMA compilação e UMA release, não N.
  if (skipBuild) {
    process.stderr.write(`${formatSkippedMarker(projectName)}\n`);
    return;
  }

  reportClientConfig(root, id);
  ensureTsconfigPaths(root);

  for (const depId of deps) {
    if (depId === id) continue;
    const depName = `mls-${depId}`;
    if (!existsSync(join(root, depName))) {
      process.stderr.write(`gitPostReceive: dep ${depName} does not exist on the VM — ignored\n`);
      continue;
    }
    process.stderr.write(`gitPostReceive: compiling dep ${depName}\n`);
    const depBuild = await runLive(
      'node',
      ['scripts/runtime/buildProjectsObj.mjs', '--only', depId, '--force'],
      { cwd: root, env: { ...process.env, BUILDCI_OFFLINE: '1' } },
    );
    const depVerdict = evaluateBuild(depBuild.code, depBuild.out);
    if (!depVerdict.ok) {
      // Nomeia o DEP, não o cliente: quem quebrou foi ele, e a release não sobe (D-C2).
      printError(depName, depVerdict);
      return;
    }
    restoreWorktree(root, depName);
  }

  const build = await runLive(
    'node',
    ['scripts/runtime/buildProjectsObj.mjs', '--only', id, '--force'],
    { cwd: root, env: { ...process.env, BUILDCI_OFFLINE: '1' } },
  );
  const verdict = evaluateBuild(build.code, build.out);
  if (!verdict.ok) {
    printError(projectName, verdict);
    return;
  }

  const { clientId, ownClient } = clientIdForRelease(root, id);
  // Fecho incremental (no --force): zip of every config.projects id, including
  // platform deps that arrived via deps-update rather than this push. Missing
  // folders are ignored; a compile/typeCheck failure names the project and
  // the release does not go up.
  const fecho = await compileFecho(root, clientId);
  if (!fecho.ok) {
    printError(fecho.project, fecho.verdict);
    return;
  }

  const releaseArgs = ['scripts/runtime/addNewVersion.mjs'];
  if (clientId) releaseArgs.push('--client', clientId);
  // Reload is ours: restoreWorktree and the ok marker must run first. On https
  // the app IS git-http-backend; pm2 reload inside addNewVersion killed the hook
  // before those steps (dirty worktree → next push refused).
  releaseArgs.push('--skip-pm2');

  // Multiprojeto: cada app tem porta e alias próprios. Push do app
  // (ownClient) garante o arquivo em pm2.apps.d/ e vira só o alias daquele
  // cliente. Push de biblioteca vira o alias de TODOS os apps em
  // pm2.apps.d/ — o asset static é servido do cwd (current-<id>), não do zip.
  const { releaseEnv, aliases, appName, replacedLegacy } = prepareReleaseEnv({
    root, clientId, ownClient,
  });
  for (const line of formatReleaseAliasLines(aliases)) {
    process.stderr.write(`${line}\n`);
  }
  if (replacedLegacy) {
    process.stderr.write(
      'gitPostReceive: legacy pm2.config.js (single app on `current`) replaced by the aggregator — '
      + 'delete the old app once with `pm2 delete app`, or it keeps serving whoever pushed last.\n',
    );
  }

  const release = await runLive(
    'node',
    releaseArgs,
    {
      cwd: root,
      // Fecho objs were just compiled incrementally. CBE_BUILD_OBJS=false now
      // skips only projects outside config.projects (Studio), not the fecho.
      env: releaseEnv,
    },
  );
  // addNewVersion already switched `current` only after a successful emit.
  // Do not scan its logs for "error TS" — runtime emit is --noCheck by design.
  if (release.code !== 0) {
    printError(projectName, { ok: false, gate: 'exit', declWarn: 0, excerptText: '' });
    return;
  }

  // Both worktrees can come back dirty: the pushed project (buildCI) and the
  // release CLIENT (build.mjs recomposes mls-<client>/l5/config.json), which is
  // not necessarily the project that was pushed.
  restoreWorktree(root, projectName);
  if (clientId && `mls-${clientId}` !== projectName) restoreWorktree(root, `mls-${clientId}`);

  const fromLog = /(?:release |releases\/)(\d{14})/u.exec(release.out);
  // Multiprojeto: a release do PROJETO é o alias dele; o `current` global é do
  // último push, seja de quem for. Em biblioteca o alias também vira, então
  // o timestamp sai de current-<id>, não só do `current` global.
  const alias = aliases[0] || 'current';
  const ts = currentReleaseId(root, alias) || currentReleaseId(root) || fromLog?.[1] || '';
  process.stderr.write(`${gateMessage(verdict)}\n`);
  process.stderr.write(`${formatOkMarker(projectName, ts, verdict.declWarn)}\n`);
  if (verdict.declWarn > 0) {
    process.stderr.write(`declarations: ${verdict.declWarn} type errors (best-effort, does not block)\n`);
  }
  if ((verdict.typeWarn ?? 0) > 0) {
    process.stderr.write(
      `typeCheck: ${verdict.typeWarn} type errors (status=${verdict.typeCheckStatus ?? 'permissive'}, does not block)\n`,
    );
  }
  const flip = formatReleaseAliasFlip(aliases, ts);
  if (flip) process.stderr.write(`${flip}\n`);
  process.stderr.write(`release ${ts} ativa\n`);

  // Marker already flushed. Reload last: ssh/SSM in-process; https detached so
  // this hook (and the TCP connection that carries its output) can finish.
  if (shouldDeferPm2Reload(process.env)) {
    scheduleDetachedPm2Reload(root, { appName });
  } else {
    await reloadPm2Now(root, { appName });
  }
}

function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
  } catch {
    return false;
  }
}

function parseReloadArgs(argv) {
  let root = DEFAULT_ROOT;
  let appName = '';
  let delaySec = 2;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      root = resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--app' && argv[i + 1]) {
      appName = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--delay' && argv[i + 1]) {
      delaySec = Number(argv[i + 1]);
      if (!Number.isFinite(delaySec) || delaySec < 0) delaySec = 0;
      i += 1;
    }
  }
  return { root, appName, delaySec };
}

if (invokedAsMain()) {
  if (process.argv.includes('--reload-pm2')) {
    const { root, appName, delaySec } = parseReloadArgs(process.argv.slice(2));
    Promise.resolve()
      .then(async () => {
        if (delaySec > 0) await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        await reloadPm2Now(root, { appName });
      })
      .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
      });
  } else {
    main().catch((error) => {
      const project = parseArgs(process.argv.slice(2)).project || 'unknown';
      const name = projectIdOf(project) ? `mls-${projectIdOf(project)}` : project;
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.stderr.write(`##gitBackend build=error project=${name}##\n`);
    });
  }
}
