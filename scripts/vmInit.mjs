#!/usr/bin/env node
// vmInit.mjs — `pnpm vm:init <id>`: one command for "start the VM, put the
// project there (empty), clone it here, ready to change and push".
//
//   1. the lima instance is up and answering ssh
//   2. the platform is on the VM (scripts/runtime/projectInit.mjs + the template)
//   3. the project is BORN ON THE VM — `projectInit.mjs` over ssh does it
//   4. the Mac clones it (publishGit <id> clone <profile>)
//
// Everything that happens ON the VM lives in `scripts/runtime/projectInit.mjs`, so the
// bootstrap of a brand-new VM (collab-runtime step 12) runs the SAME rule without ssh —
// one rule, one place, two triggers. This file is only the Mac side.
//
// Every step is idempotent: a second run finds everything in place and changes
// nothing. The VM is the source of truth for a git-managed project — the
// traditional publish skips it (see publishMlsBase.py, `.collab-git`).

import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProfileConf } from './publishGit.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_REMOTE_BASE = '/data/mls-base';
const DEFAULT_TEMPLATE = 'project';
const SSH_WAIT_SECONDS = 120;

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function log(message) {
  process.stderr.write(`[vmInit] ${message}\n`);
}

function usage() {
  return [
    'usage: node scripts/vmInit.mjs <projetoId|mls-<id>> [--profile local|remote]',
    '       [--template <nome>] [--force]',
    '  --profile  destino (default local: PUBLISH_LOCAL_* do mls-base/.env)',
    `  --template pasta em scripts/templates/ na VM (default ${DEFAULT_TEMPLATE})`,
    '  --force    recria o projeto na VM — só se main == vm-baseline (nunca apaga história)',
  ].join('\n');
}

export function parseArgs(argv) {
  const positional = [];
  let profile = 'local';
  let template = DEFAULT_TEMPLATE;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') force = true;
    else if (arg === '--profile' && argv[i + 1]) { profile = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--profile=')) profile = arg.slice('--profile='.length);
    else if (arg === '--template' && argv[i + 1]) { template = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--template=')) template = arg.slice('--template='.length);
    // The scaffold PROJECT is gone: a brand-new VM clones mls-base, which tracks no
    // mls-* at all, so there is nothing to copy from. Say it instead of guessing.
    else if (arg === '--scaffold' || arg.startsWith('--scaffold=')) {
      fail('--scaffold saiu: o projeto vazio virou template versionado com os scripts. Use --template <nome> (default project).');
    }
    else positional.push(arg);
  }
  const idMatch = /^(?:mls-)?(\d+)$/u.exec((positional[0] || '').trim());
  if (!idMatch || (profile !== 'local' && profile !== 'remote')) {
    fail(usage());
  }
  return { id: idMatch[1], template, profile, force };
}

// `~/.lima/<instance>/ssh.config` is how the local profile names its VM; the
// instance is the folder holding that file. PUBLISH_LOCAL_LIMA_INSTANCE wins.
export function limaInstanceOf(conf, env = process.env) {
  const explicit = (env.PUBLISH_LOCAL_LIMA_INSTANCE || '').trim();
  if (explicit) return explicit;
  const config = conf.SSH_CONFIG || '';
  if (!/[\\/]\.lima[\\/]/u.test(config)) return '';
  return basename(dirname(config));
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...opts });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { code: result.status ?? 1, out };
}

function sshArgs(conf) {
  const args = [];
  if (conf.SSH_CONFIG) args.push('-F', conf.SSH_CONFIG);
  if (conf.CERT) args.push('-i', conf.CERT);
  args.push(conf.SSH_HOST);
  return args;
}

function ssh(conf, script) {
  return run('ssh', [...sshArgs(conf), script]);
}

function sshOrFail(conf, script, what) {
  const result = ssh(conf, script);
  if (result.code !== 0) fail(`${what} falhou na VM:\n${result.out.trim()}`);
  return result.out.trim();
}

function shQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

// ── step 1 ──────────────────────────────────────────────────────────────────
function ensureLima(instance) {
  const listed = run('limactl', ['list', '--format', 'json']);
  if (listed.code !== 0) {
    fail(`limactl list falhou — a lima está instalada?\n${listed.out.trim()}`);
  }
  const rows = listed.out
    .split(/\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
  const found = rows.find((row) => row.name === instance);
  if (!found) {
    fail(`instância lima "${instance}" não existe (limactl list). Ajuste PUBLISH_LOCAL_SSH_CONFIG ou PUBLISH_LOCAL_LIMA_INSTANCE.`);
  }
  if (found.status === 'Running') {
    log(`lima ${instance}: já rodando`);
    return;
  }
  log(`lima ${instance}: ${found.status} → limactl start`);
  const started = run('limactl', ['start', instance], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (started.code !== 0) fail(`limactl start ${instance} falhou (exit ${started.code}).`);
}

function waitForSsh(conf, seconds = SSH_WAIT_SECONDS) {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    if (ssh(conf, 'true').code === 0) return;
    if (Date.now() >= deadline) {
      fail(`a VM não respondeu ssh em ${seconds}s (host ${conf.SSH_HOST}).`);
    }
    run('sleep', ['2']);
  }
}

// ── step 2 ──────────────────────────────────────────────────────────────────
// What the VM must already have for the project to be born there: the script that
// does it and the template it copies from. Both travel with `scripts/`, so this is
// true on any VM that has the mls-base checkout — no scaffold PROJECT needed.
function ensurePlatform(conf, base, template) {
  const initScript = `${base}/scripts/runtime/projectInit.mjs`;
  const templateDir = `${base}/scripts/templates/${template}`;
  const probe = ssh(
    conf,
    `test -f ${shQuote(initScript)} && echo init-ok; test -d ${shQuote(templateDir)} && echo template-ok`,
  );
  const missing = [];
  if (!probe.out.includes('init-ok')) missing.push(initScript);
  if (!probe.out.includes('template-ok')) missing.push(templateDir);
  if (missing.length) {
    fail(
      `a plataforma não está montada na VM — falta:\n  ${missing.join('\n  ')}\n` +
        'Monte com um publish tradicional (ex.: `pnpm publish:local` de dentro de um mls-* já publicado) e rode vm:init de novo.',
    );
  }
  log(`plataforma na VM: ok (template ${template})`);
}

// ── step 3 ──────────────────────────────────────────────────────────────────
// One ssh call, because the whole rule lives on the VM now. Same command the VM
// bootstrap runs by itself (collab-runtime step 12) — that is what keeps lima and a
// remote VM on the same path.
export function projectInitCommand(base, id, template, force) {
  const args = [
    'node', `${base}/scripts/runtime/projectInit.mjs`, id,
    '--root', base, '--template', template,
  ];
  if (force) args.push('--force');
  return args.map(shQuote).join(' ');
}

function initProjectOnVm(conf, base, id, template, force) {
  const command = projectInitCommand(base, id, template, force);
  const result = ssh(conf, command);
  process.stderr.write(result.out.endsWith('\n') || !result.out ? result.out : `${result.out}\n`);
  if (result.code !== 0) fail(`projectInit falhou na VM (exit ${result.code}).`);
  if (!/\b(created|unchanged)\b/u.test(result.out)) {
    fail(`projectInit não confirmou o resultado na VM:\n${result.out.trim()}`);
  }
}

// ── step 4 ──────────────────────────────────────────────────────────────────
function cloneOnMac(id, profile) {
  const result = run('node', [join(SCRIPT_DIR, 'publishGit.mjs'), id, 'clone', profile], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.code !== 0) fail(`clone no Mac falhou (exit ${result.code}).`);
}

async function main() {
  const { id, template, profile, force } = parseArgs(process.argv.slice(2));
  const conf = resolveProfileConf(profile, join(ROOT, `mls-${id}`));
  const base = (conf.REMOTE_BASE || DEFAULT_REMOTE_BASE).replace(/\/+$/u, '');
  log(`mls-${id} → ${conf.SSH_HOST}:${base} (${profile}), template ${template}`);

  if (profile === 'local') {
    const instance = limaInstanceOf(conf);
    if (instance) ensureLima(instance);
    else log('perfil local sem instância lima identificável — assumo a VM já de pé');
  }
  waitForSsh(conf);
  ensurePlatform(conf, base, template);
  initProjectOnVm(conf, base, id, template, force);
  cloneOnMac(id, profile);

  process.stderr.write(
    `\n[vmInit] mls-${id} pronto.\n` +
      `  gerar:    collab-msg com projectId=${id}\n` +
      `  publicar: node scripts/publishGit.mjs ${id} ${profile} --autocommit\n`,
  );
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
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  });
}
