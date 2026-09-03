#!/usr/bin/env node
// gitPostReceive.mjs — compile the pushed mls-* project; on success cut a
// release via addNewVersion.mjs. Invoked by gitPostReceive.sh while holding
// /data/mls-base/.gitbuild.lock. The shell wrapper always exits 0 (A1).
//
// Gate = the same offline buildCI path as buildProjectsObj.mjs
// (BUILDCI_OFFLINE=1, cwd = mls-base). Code-pass tsc errors
// (##buildCI pass=code##) are treated as build=error even though buildCI
// itself is tolerant. Declaration-pass errors become declWarn=N on the
// success marker. If the pass=code marker is missing (old buildCI,
// truncated output), fall back to scanning the whole output — never the
// other way around. Marker lines are the gb3 contract — one line, exact
// format.

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureProjectApp } from './vmApps.mjs';
import { releaseAliasOf } from './projectPorts.mjs';

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

export function evaluateBuild(code, out) {
  const text = String(out ?? '');
  const codeErrors = parsePassErrors(text, 'code');
  const declErrors = parsePassErrors(text, 'declarations') ?? 0;

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
  return `##gitBackend build=skipped project=${project}## retrato recebido; compila no push do cliente`;
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

function restoreWorktree(root, projectName) {
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
      `worktree ainda suja em ${projectName} (${still.join(' ') || 'erro no checkout'}) — ` +
        'o próximo push pode ser recusado pelo updateInstead\n',
    );
    return;
  }
  process.stderr.write(`worktree restaurada: ${dirty.join(' ')} (recomposto pelo build, já está na release)\n`);
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
    process.stderr.write(`gitPostReceive: log de push não escrito (${error.message})\n`);
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
 * Devolve `{ clientId, ownClient }`; `ownClient` liga o alias por projeto.
 */
export function clientIdForRelease(root, pushedId = '') {
  const own = pushedId ? clientOf(join(root, `mls-${pushedId}`, 'l5', 'config.json'), pushedId) : '';
  if (own) return { clientId: own, ownClient: true };
  return { clientId: clientOf(join(root, 'config.json')), ownClient: false };
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

  for (const depId of deps) {
    if (depId === id) continue;
    const depName = `mls-${depId}`;
    if (!existsSync(join(root, depName))) {
      process.stderr.write(`gitPostReceive: dep ${depName} não existe na VM — ignorado\n`);
      continue;
    }
    process.stderr.write(`gitPostReceive: compilando dep ${depName}\n`);
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
  const releaseArgs = ['scripts/runtime/addNewVersion.mjs'];
  if (clientId) releaseArgs.push('--client', clientId);

  // Multiprojeto: o app do projeto tem porta e alias PRÓPRIOS. Escrever a
  // config antes do release porque o `pm2 startOrReload` acontece lá dentro —
  // e o alias current-<id> que o app aponta é criado no mesmo passo, antes do
  // reload.
  const releaseEnv = { ...process.env, CBE_BUILD_OBJS: 'false' };
  if (ownClient) {
    const app = ensureProjectApp({ root, projectId: clientId });
    releaseEnv.COLLAB_RELEASE_ALIAS = releaseAliasOf(clientId);
    process.stderr.write(`gitPostReceive: app ${app.appName} (porta ${app.port}) → ${releaseAliasOf(clientId)}\n`);
    if (app.replacedLegacy) {
      process.stderr.write(
        'gitPostReceive: pm2.config.js legado (app único no `current`) trocado pelo agregador — '
        + 'remova o app antigo uma vez com `pm2 delete app`, senão ele segue servindo a release de quem empurrou por último.\n',
      );
    }
  }

  const release = await runLive(
    'node',
    releaseArgs,
    {
      cwd: root,
      // Gate already built this project's obj. Other projects' objs already
      // exist on the VM (needed by cbe login, not by scripts/build.mjs).
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
  // último push, seja de quem for.
  const alias = ownClient ? releaseAliasOf(clientId) : 'current';
  const ts = currentReleaseId(root, alias) || currentReleaseId(root) || fromLog?.[1] || '';
  process.stderr.write(`${gateMessage(verdict)}\n`);
  process.stderr.write(`${formatOkMarker(projectName, ts, verdict.declWarn)}\n`);
  if (verdict.declWarn > 0) {
    process.stderr.write(`declarations: ${verdict.declWarn} type errors (best-effort, does not block)\n`);
  }
  process.stderr.write(`release ${ts} ativa\n`);
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

if (invokedAsMain()) {
  main().catch((error) => {
    const project = parseArgs(process.argv.slice(2)).project || 'unknown';
    const name = projectIdOf(project) ? `mls-${projectIdOf(project)}` : project;
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.stderr.write(`##gitBackend build=error project=${name}##\n`);
  });
}
