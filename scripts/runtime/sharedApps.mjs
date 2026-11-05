#!/usr/bin/env node
// sharedApps.mjs — the register of shared apps (controleReleases R4, D21) and the project each one belongs to.
//
// A shared app is installed once on the VM and used by the projects (today only the cm). The register is code (one
// entry); which project the cm belongs to is kept OUTSIDE the sources, in /data/etc/shared.json:
//   { "cm": { "projetoPrincipal": 102047 } }
// Who wins when the release record asks "which project is this shared app's": COLLAB_RELEASE_PROJECT_ID (the sites),
// then shared.json, then (provisional) the smallest project id on the VM, with a log line.
//
//   node scripts/runtime/sharedApps.mjs set-main --nome cm --projeto <id> [--if-absent] [--dry-run] [--etc /data/etc]
//   node scripts/runtime/sharedApps.mjs show [--etc /data/etc]

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARED_APPS = [
  {
    nome: 'cm',
    pasta: '/data/msg.collab.codes',
    arquivoVersao: 'node/collab-messages.version',
    comandoAtualizar: 'collab msg update',
    processos: ['msg', 'msg-worker'],
    porta: 8180,
  },
];

export function sharedAppByName(nome) {
  return SHARED_APPS.find((app) => app.nome === nome) ?? null;
}

function folderOf(app, env) {
  // The cm's own installer lets this env move the folder (tests, a second install); keep honouring it.
  if (app.nome === 'cm') return String(env.COLLAB_MESSAGES_DEPLOY_ROOT ?? '').trim() || app.pasta;
  return app.pasta;
}

/** Installed version of each shared app: `{ cm: '20261102-155346' }`; an app without the file is left out. */
export function readSharedVersions({ env = process.env, apps = SHARED_APPS } = {}) {
  const versions = {};
  for (const app of apps) {
    try {
      const version = readFileSync(join(folderOf(app, env), app.arquivoVersao), 'utf8').trim();
      if (version) versions[app.nome] = version;
    } catch { /* not installed here */ }
  }
  return versions;
}

export function sharedConfigPath(etcDir = '/data/etc') {
  return join(etcDir, 'shared.json');
}

/** `{ config, reason }`: the parsed file, or `config: null` and why (missing, unreadable, not an object). */
export function readSharedConfig({ etcDir = '/data/etc' } = {}) {
  const file = sharedConfigPath(etcDir);
  if (!existsSync(file)) return { config: null, reason: `${file} does not exist` };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { config: null, reason: `${file} is not an object` };
    return { config: parsed, reason: '' };
  } catch (error) {
    return { config: null, reason: `${file} is unreadable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function projectIds(projectsDir) {
  try {
    return readdirSync(projectsDir).map((name) => /^(\d+)\.json$/u.exec(name)?.[1]).filter(Boolean).sort((a, b) => Number(a) - Number(b));
  } catch {
    return [];
  }
}

/** The project a shared app belongs to, with where the answer came from; `null` when nothing can say. */
export function mainProjectOf(nome, { env = process.env, etcDir = '/data/etc', projectsDir = join(etcDir, 'projects'), log = () => {} } = {}) {
  const fromEnv = String(env.COLLAB_RELEASE_PROJECT_ID ?? '').trim();
  if (/^\d+$/u.test(fromEnv)) return { projectId: fromEnv, source: 'COLLAB_RELEASE_PROJECT_ID' };
  const { config, reason } = readSharedConfig({ etcDir });
  const stored = config?.[nome]?.projetoPrincipal;
  if (Number.isInteger(stored) && stored > 0) return { projectId: String(stored), source: 'shared.json' };
  const ids = projectIds(projectsDir);
  if (ids.length === 0) return null;
  log(`sharedApps: ${reason || `no "${nome}" entry in shared.json`}; ${ids.length === 1 ? 'the only project' : `the smallest of ${ids.length} projects`} (${ids[0]}) is taken as the main one`);
  return { projectId: ids[0], source: 'menor projetoId' };
}

/** Write the main project of a shared app, atomically, keeping the other entries. `ifAbsent` never replaces one. */
export function setMainProject(nome, projectId, { etcDir = '/data/etc', ifAbsent = false, dryRun = false } = {}) {
  if (!sharedAppByName(nome)) throw new Error(`unknown shared app: ${nome}`);
  if (!/^\d+$/u.test(String(projectId))) throw new Error(`project id is not a number: ${projectId}`);
  const { config } = readSharedConfig({ etcDir });
  const current = config?.[nome]?.projetoPrincipal;
  if (current !== undefined && ifAbsent) return { changed: false, projectId: String(current), reason: 'already set' };
  if (String(current) === String(projectId)) return { changed: false, projectId: String(projectId), reason: 'already this project' };
  if (dryRun) return { changed: true, projectId: String(projectId), reason: 'dry-run', dryRun: true };
  const next = { ...(config ?? {}), [nome]: { ...(config?.[nome] ?? {}), projetoPrincipal: Number(projectId) } };
  mkdirSync(etcDir, { recursive: true });
  const file = sharedConfigPath(etcDir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, file);
  return { changed: true, projectId: String(projectId), reason: current === undefined ? 'set' : `changed from ${current}` };
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

function cli(argv) {
  const etcDir = flag(argv, '--etc') ?? '/data/etc';
  if (argv[0] === 'show') {
    const { config, reason } = readSharedConfig({ etcDir });
    process.stdout.write(config ? `${JSON.stringify(config)}\n` : `${reason}\n`);
    return 0;
  }
  if (argv[0] === 'set-main') {
    try {
      const result = setMainProject(flag(argv, '--nome') ?? 'cm', flag(argv, '--projeto') ?? '', {
        etcDir, ifAbsent: argv.includes('--if-absent'), dryRun: argv.includes('--dry-run'),
      });
      process.stdout.write(`${result.changed ? (result.dryRun ? 'would set' : 'set') : 'kept'} ${flag(argv, '--nome') ?? 'cm'} main project ${result.projectId} (${result.reason})\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`sharedApps: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }
  }
  process.stderr.write('usage: sharedApps.mjs set-main --nome cm --projeto <id> [--if-absent] [--dry-run] [--etc <pasta>] | show [--etc <pasta>]\n');
  return 2;
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) process.exit(cli(process.argv.slice(2)));
