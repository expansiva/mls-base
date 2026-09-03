#!/usr/bin/env node
// projectInit.mjs — makes a client project be BORN ON THE VM, ready to clone and push.
//
// Runs ON THE VM (local filesystem, no ssh). Two callers, one rule:
//   • the Mac, through `pnpm vm:init <id>` (scripts/vmInit.mjs calls this over ssh);
//   • the VM bootstrap, through collab-runtime's step 12, when the installer got --project-id.
//
// Steps:
//   1. the project folder is born from scripts/templates/<template>, with the
//      __PROJECT_ID__ placeholder replaced by the real id;
//   2. `.collab-git` is written BEFORE gitReposSetup, so the marker lands INSIDE the
//      vm-baseline commit — a project unprotected until its first push is a project the
//      traditional publish may wipe;
//   3. gitReposSetup gives it `main` + `vm-baseline` + the push hook;
//   4. the result is checked, not assumed: no placeholder left, `main` exists, and the
//      project DECLARES its dependencies (without that the host loads no agent at all).
//
// Idempotent: a second run finds the folder and does nothing. `--force` recreates, and it
// FAILS CLOSED — only a repo that positively proves it has nothing beyond the baseline may
// be deleted (mayRecreate).
//
// WHY A TEMPLATE AND NOT A SCAFFOLD PROJECT
// On a brand-new VM the platform arrives as `git clone` of mls-base, and that repository
// tracks NO mls-* project (measured 03/09/2026). There is no scaffold to copy from. A
// template versioned with the scripts exists on every VM, so lima and a remote VM take the
// same path — which is the whole point of the "lima igual" decision.

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_TEMPLATE = 'project';

export const PLACEHOLDER = '__PROJECT_ID__';
export const GIT_MANAGED_MARKER = '.collab-git';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function log(message) {
  process.stderr.write(`[projectInit] ${message}\n`);
}

function usage() {
  return [
    'usage: node scripts/runtime/projectInit.mjs <projetoId|mls-<id>> [--root <dir>]',
    '       [--template <nome>] [--force]',
    `  --root      raiz do mls-base na VM (default ${DEFAULT_ROOT})`,
    `  --template  pasta em scripts/templates/ (default ${DEFAULT_TEMPLATE})`,
    '  --force     recria o projeto — só se main == vm-baseline (nunca apaga história)',
  ].join('\n');
}

export function parseArgs(argv, defaultRoot = DEFAULT_ROOT) {
  const positional = [];
  let root = defaultRoot;
  let template = DEFAULT_TEMPLATE;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') force = true;
    else if (arg === '--root' && argv[i + 1]) { root = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--template' && argv[i + 1]) { template = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--template=')) template = arg.slice('--template='.length);
    else positional.push(arg);
  }
  const idMatch = /^(?:mls-)?(\d+)$/u.exec((positional[0] || '').trim());
  if (!idMatch) return { ok: false, usage: usage() };
  if (!/^[A-Za-z0-9._-]+$/u.test(template)) return { ok: false, usage: usage() };
  return { ok: true, id: idMatch[1], root: resolve(root), template, force };
}

/** What the marker says, for whoever finds the folder without this context. */
export function gitManagedMarkerBody(id) {
  return (
    `git-managed project (mls-${id}): the VM is the source of truth.\n` +
    'The traditional publish must NOT wipe or overwrite this folder — it is updated by git push.\n' +
    'See mls-base/skills/publishGitBackend.md.'
  );
}

/**
 * Guards an `rm -rf`, so it FAILS CLOSED: only a repo that positively proves it has nothing
 * beyond the baseline may be recreated. An unreadable probe (folder without .git, truncated
 * output) refuses — never deletes.
 */
export function mayRecreate(state) {
  // Dizer QUAL metade falta: a mensagem antiga juntava "sem .git", "sem main" e "sem vm-baseline"
  // num "(sem .git?)" — e em 03/09 o caso real era o primeiro, escondido atrás do palpite.
  if (!state.mainSha && !state.baselineSha) {
    const detail = state.hasGit === false
      ? 'the folder has no .git at all (gitReposSetup never ran here)'
      : 'the repo has neither main nor vm-baseline';
    return { ok: false, reason: `${detail}. Não apago o que não posso provar que é intocado — remova à mão se for o caso.` };
  }
  if (!state.mainSha || !state.baselineSha) {
    const missing = state.mainSha ? 'vm-baseline' : 'main';
    return { ok: false, reason: `branch ${missing} is missing, so I cannot compare. Não apago o que não posso provar que é intocado — remova à mão se for o caso.` };
  }
  if (state.mainSha !== state.baselineSha) {
    return {
      ok: false,
      reason: `main ${state.mainSha.slice(0, 7)} != vm-baseline ${state.baselineSha.slice(0, 7)}. Não apago história de alguém.`,
    };
  }
  return { ok: true, reason: '' };
}

/**
 * A project that does not DECLARE its dependencies cannot load an agent: the host resolves
 * the agent through `l5/config.json.workspaceDependencies` and nothing else (`mlsDep.json`
 * does not serve). Measured 02/09/2026 on the first 102043 run — `send @@newSolution` died
 * in 4s with "Invalid agent agentNewSolution".
 */
export function missingWorkspaceDependencies(configText) {
  if (configText === '') return 'l5/config.json ausente';
  let parsed;
  try {
    parsed = JSON.parse(configText);
  } catch {
    return 'l5/config.json inválido (JSON)';
  }
  const list = parsed && typeof parsed === 'object' ? parsed.workspaceDependencies : null;
  if (!Array.isArray(list) || list.length === 0) return 'l5/config.json sem workspaceDependencies';
  return '';
}

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}`.trim() };
}

export function projectState(root, id) {
  const dir = join(root, `mls-${id}`);
  if (!existsSync(dir)) return { exists: false, hasGit: false, dir, mainSha: '', baselineSha: '' };
  if (!existsSync(join(dir, '.git'))) return { exists: true, hasGit: false, dir, mainSha: '', baselineSha: '' };
  const revOf = (ref) => {
    const result = git(dir, ['rev-parse', ref]);
    return result.code === 0 ? result.out : '';
  };
  return { exists: true, hasGit: true, dir, mainSha: revOf('main'), baselineSha: revOf('vm-baseline') };
}

/**
 * macOS metadata that must never reach a project. Measured while shipping the template to
 * lima: a `tar` from the Mac carried `._*` AppleDouble files, and the copy would have put
 * one beside every file of every new project.
 */
export function isMacMetadata(name) {
  return name === '.DS_Store' || name.startsWith('._');
}

/** A file with a NUL byte is binary: copied as-is, never substituted. */
function substituteInto(buffer, id) {
  if (buffer.includes(0)) return buffer;
  return Buffer.from(buffer.toString('utf8').replaceAll(PLACEHOLDER, id), 'utf8');
}

/**
 * Copies the template into `destDir`, replacing the placeholder in every text file — in the
 * CONTENT and in the PATH, so a template may name a file after the project one day.
 *
 * Done in Node, not `rsync | sed -i`: the same code then runs on the VM and in a unit test on
 * the Mac. The shell version could not be tested here at all — BSD `sed -i` takes a different
 * argument than the VM's GNU `sed` (noted while measuring gb16).
 */
export function copyTemplate(templateDir, destDir, id) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (isMacMetadata(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(templateDir);

  for (const file of files) {
    const rel = relative(templateDir, file).replaceAll(PLACEHOLDER, id);
    const target = join(destDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, substituteInto(readFileSync(file), id), { mode: statSync(file).mode & 0o777 });
  }
  return files.length;
}

/** Files where the placeholder survived — a guard, because a leftover id is a silent bug. */
export function remainingPlaceholders(dir) {
  const left = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.includes(PLACEHOLDER)) { left.push(relative(dir, full)); continue; }
      const body = readFileSync(full);
      if (!body.includes(0) && body.toString('utf8').includes(PLACEHOLDER)) left.push(relative(dir, full));
    }
  };
  walk(dir);
  return left.sort();
}

function runGitReposSetup(root, id) {
  const result = spawnSync('node', ['scripts/runtime/gitReposSetup.mjs', '--root', root], {
    cwd: root,
    encoding: 'utf8',
  });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if ((result.status ?? 1) !== 0) fail(`gitReposSetup falhou:\n${out.trim()}`);
  const line = out.split(/\n/u).find((row) => row.includes(`mls-${id}`)) || '';
  log(`gitReposSetup: ${line.trim() || 'ok'}`);
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) fail(parsed.usage);
  const { id, root, template, force } = parsed;

  const templateDir = join(root, 'scripts', 'templates', template);
  if (!existsSync(templateDir)) {
    fail(`template não encontrado: ${templateDir}\n${usage()}`);
  }
  const setup = join(root, 'scripts', 'runtime', 'gitReposSetup.mjs');
  if (!existsSync(setup)) fail(`plataforma incompleta: falta ${setup}`);

  const state = projectState(root, id);
  if (state.exists && !force) {
    log(`mls-${id}: já existe — não toco nos arquivos (idempotente)`);
    // Mas o REPO é conferido mesmo assim: uma pasta de projeto sem `.git` não tem para onde
    // receber push, e era o estado de toda VM criada antes da correção do `isRepo` (03/09). O
    // `gitReposSetup` é idempotente — quando já está pronto, ele não faz nada.
    runGitReposSetup(root, id);
    process.stdout.write('unchanged\n');
    return;
  }
  if (state.exists && force) {
    const verdict = mayRecreate(state);
    if (!verdict.ok) fail(`--force recusado: ${verdict.reason}`);
    log(`mls-${id}: --force, main == vm-baseline → recriando`);
    rmSync(state.dir, { recursive: true, force: true });
  }

  const copied = copyTemplate(templateDir, state.dir, id);
  writeFileSync(join(state.dir, GIT_MANAGED_MARKER), `${gitManagedMarkerBody(id)}\n`);

  const left = remainingPlaceholders(state.dir);
  if (left.length) fail(`sobrou ${PLACEHOLDER} em:\n  ${left.join('\n  ')}`);
  log(`mls-${id}: ${copied} arquivo(s) do template ${template}, id substituído, ${GIT_MANAGED_MARKER} escrito`);

  runGitReposSetup(root, id);

  const after = projectState(root, id);
  if (!after.mainSha) fail(`mls-${id} ficou sem branch main após o gitReposSetup.`);

  const configPath = join(state.dir, 'l5', 'config.json');
  const problem = missingWorkspaceDependencies(existsSync(configPath) ? readFileSync(configPath, 'utf8').trim() : '');
  if (problem) {
    fail(
      `mls-${id} não vai conseguir carregar agente: ${problem}.\n` +
        'O host resolve o agente por l5/config.json.workspaceDependencies. Corrija o template ' +
        `(scripts/templates/${template}/l5/config.json) e rode de novo.`,
    );
  }
  log(`mls-${id}: declara dependências (l5/config.json) — agentes carregam`);
  process.stdout.write('created\n');
}

// realpath on BOTH sides: `import.meta.url` is already the resolved path, while
// `process.argv[1]` is whatever the caller typed. Comparing them raw makes the script a
// silent no-op when it is reached through a symlinked directory — which is exactly what a
// temp dir on macOS is, and what a /data symlink on a VM could be.
function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  const real = (path) => { try { return realpathSync(path); } catch { return resolve(path); } };
  try {
    return real(fileURLToPath(import.meta.url)) === real(entry);
  } catch {
    return false;
  }
}

if (invokedAsMain()) {
  try {
    main();
  } catch (error) {
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
}
