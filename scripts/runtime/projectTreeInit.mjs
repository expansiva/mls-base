#!/usr/bin/env node
// projectTreeInit.mjs — makes a project be born in its own tree, /data/app<id>/mls-base (rt187).
//
// ONE writer for what a hosted project needs on the one-tree-per-project layout. Callers: collab-runtime step 12 (the
// first project of a VM, from the tree it just cloned) and the collab-sites slot (a new project on a VM that has no
// /data/mls-base), over SSM. No secret travels in the command: the database keys come from a tree that already runs.
//
//   node <source tree>/scripts/runtime/projectTreeInit.mjs <id> [--port <p>] [--msg-proxy-target <url>]
//        [--data /data] [--source <tree root>] [--store /data/.pnpm-store]      (run as the data owner, ubuntu)
//
// Steps (each idempotent; a second run changes nothing):
//   1. the tree: when /data/app<id>/mls-base has no .git, clone the SOURCE tree into it and detach at the source HEAD
//      (the new project is born with the platform this VM runs). The source is --source, else the cm main project's
//      tree (shared.json), else any other /data/app*/mls-base;
//   2. `pnpm install` (store /data/.pnpm-store) when the tree was just made or has no node_modules;
//   3. `.env`: when missing, the database and mode keys are copied from the source's `.env`; CBE_PROJECTS_DIR and
//      CBE_STATIC_DIR are added when absent. An existing `.env` is never rewritten (step 12 writes it with the
//      installer's secrets before calling this);
//   4. `projectInit.mjs <id> --root <tree> --from-model` (the project's own repo, from the model);
//   5. `ensureProjectApp` (vmApps.mjs): pm2.apps.d/app<port>.config.js and the aggregator;
//   6. pm2 `startOrReload` of that app only when the tree already has `current` (a release); else it waits for one.
// The port is the platform rule (2000 + the last 3 digits of the id): --port is checked against it, not a second rule.
// The last stdout line is JSON: { ok, projectId, root, port, appName, commit, created: { tree, env, project, app },
// started }. A failure exits non-zero with a plain message on stderr; nothing is swallowed.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appNameOf, projectIdToPort } from './projectPorts.mjs';
import { ensureProjectApp } from './vmApps.mjs';

const ENV_KEYS = ['APP_ENV', 'RUNTIME_MODE', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'WRITE_BEHIND_ENABLED'];

export function parseArgs(argv) {
  const out = { projectId: '', port: '', msgProxyTarget: undefined, data: '/data', source: '', store: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--port') out.port = argv[++i] || '';
    else if (token === '--msg-proxy-target') out.msgProxyTarget = argv[++i] ?? '';
    else if (token === '--data') out.data = argv[++i] || '';
    else if (token === '--source') out.source = argv[++i] || '';
    else if (token === '--store') out.store = argv[++i] || '';
    else if (token.startsWith('--')) throw new Error(`unknown argument: ${token}`);
    else rest.push(token);
  }
  out.projectId = rest[0] || '';
  if (!/^\d+$/u.test(out.projectId)) throw new Error('project id must be digits');
  if (!out.data) throw new Error('--data is empty');
  out.data = resolve(out.data);
  out.store = out.store || join(out.data, '.pnpm-store');
  if (out.port !== '' && !/^\d+$/u.test(out.port)) throw new Error('--port must be digits');
  return out;
}

/** The tree an unborn project is cloned from: --source, the cm main project's tree, else any other project tree. */
export function findSourceTree({ data, projectId, source = '' }) {
  if (source) return resolve(source);
  const own = join(data, `app${projectId}`, 'mls-base');
  const sharedFile = join(data, 'etc', 'shared.json');
  if (existsSync(sharedFile)) {
    try {
      const main = JSON.parse(readFileSync(sharedFile, 'utf8'))?.cm?.projetoPrincipal;
      if (Number.isInteger(main)) {
        const tree = join(data, `app${main}`, 'mls-base');
        if (tree !== own && existsSync(join(tree, '.git'))) return tree;
      }
    } catch { /* an unreadable shared.json falls through to the scan */ }
  }
  if (existsSync(data)) {
    for (const entry of readdirSync(data).sort()) {
      if (!/^app\d+$/u.test(entry)) continue;
      const tree = join(data, entry, 'mls-base');
      if (tree !== own && existsSync(join(tree, '.git'))) return tree;
    }
  }
  return '';
}

function defaultRun(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function must(result, what) {
  if (result.status !== 0) throw new Error(`${what} failed: ${(result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n').slice(-3).join(' | ')}`);
  return result;
}

function readEnvKeys(file) {
  const found = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match) found.set(match[1], match[2]);
  }
  return found;
}

function ensureEnv(root, sourceRoot) {
  const file = join(root, '.env');
  let created = false;
  if (!existsSync(file)) {
    const sourceEnv = sourceRoot ? join(sourceRoot, '.env') : '';
    if (!sourceEnv || !existsSync(sourceEnv)) {
      throw new Error(`${file} is missing and there is no source .env to copy the database keys from${sourceRoot ? ` (${sourceEnv})` : ' (no source tree)'}`);
    }
    const keys = readEnvKeys(sourceEnv);
    const lines = ENV_KEYS.filter((key) => keys.has(key)).map((key) => `${key}=${keys.get(key)}`);
    if (lines.length === 0) throw new Error(`${sourceEnv} has none of the keys ${ENV_KEYS.join(', ')}`);
    writeFileSync(file, `${lines.join('\n')}\n`);
    created = true;
  }
  const present = readEnvKeys(file);
  const add = [['CBE_PROJECTS_DIR', root], ['CBE_STATIC_DIR', join(root, 'static')]].filter(([key]) => !present.has(key));
  if (add.length) {
    const text = readFileSync(file, 'utf8');
    appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}${add.map(([k, v]) => `${k}=${v}`).join('\n')}\n`);
  }
  return created;
}

export function projectTreeInit(options, deps = {}) {
  const run = deps.run || defaultRun;
  const { projectId, data } = options;
  const port = projectIdToPort(projectId);
  const appName = appNameOf(port);
  if (options.port !== '' && Number(options.port) !== port) {
    throw new Error(`--port ${options.port} is not the port of project ${projectId} (${port}): the port is the platform rule, 2000 + the last 3 digits`);
  }
  const root = join(data, `app${projectId}`, 'mls-base');
  const created = { tree: false, env: false, project: false, app: false };

  if (!existsSync(join(root, '.git'))) {
    const source = findSourceTree({ data, projectId, source: options.source });
    if (!source || !existsSync(join(source, '.git'))) {
      throw new Error(`${root} has no checkout and there is no source tree to clone (looked for --source, the cm main project and /data/app*/mls-base)`);
    }
    mkdirSync(join(data, `app${projectId}`), { recursive: true });
    const head = must(run('git', ['-C', source, 'rev-parse', 'HEAD']), `git rev-parse in ${source}`).stdout.trim();
    must(run('git', ['clone', '--quiet', source, root]), `git clone ${source}`);
    must(run('git', ['-C', root, 'checkout', '--quiet', '--detach', head]), `git checkout ${head}`);
    created.tree = true;
  }
  const sourceRoot = options.source || findSourceTree({ data, projectId });

  const needsInstall = created.tree || !existsSync(join(root, 'node_modules'));
  if (needsInstall && existsSync(join(root, 'package.json'))) {
    mkdirSync(options.store, { recursive: true });
    must(run('pnpm', ['install', '--store-dir', options.store], { cwd: root }), 'pnpm install');
  }

  created.env = ensureEnv(root, sourceRoot);

  const hadProject = existsSync(join(root, `mls-${projectId}`));
  must(run(process.execPath, [join(root, 'scripts', 'runtime', 'projectInit.mjs'), projectId, '--root', root, '--from-model']), 'projectInit');
  created.project = !hadProject && existsSync(join(root, `mls-${projectId}`));

  const app = ensureProjectApp({ root, projectId, remoteBase: root, msgProxyTarget: options.msgProxyTarget });
  created.app = app.wrote;

  let started = false;
  const appConfig = join(root, 'pm2.apps.d', `${appName}.config.js`);
  if (existsSync(join(root, 'current'))) {
    const pm2 = run('pm2', ['startOrReload', appConfig, '--update-env']);
    if (pm2.status !== 0) throw new Error(`pm2 startOrReload ${appConfig} failed: ${(pm2.stderr || pm2.stdout).trim().split('\n').slice(-2).join(' | ')}`);
    started = true;
  }

  const commit = must(run('git', ['-C', root, 'rev-parse', 'HEAD']), 'git rev-parse').stdout.trim();
  return { ok: true, projectId, root, port, appName, commit, created, started };
}

function main() {
  try {
    const result = projectTreeInit(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const entry = process.argv[1] || '';
if (entry && fileURLToPath(import.meta.url) === resolve(entry)) main();
