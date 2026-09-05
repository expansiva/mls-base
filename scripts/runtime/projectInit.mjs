#!/usr/bin/env node
// projectInit.mjs — makes a client project be BORN ON THE VM, ready to clone and push.
//
// Runs ON THE VM (local filesystem, no ssh). Callers, one rule:
//   • the Mac, through `pnpm vm:init <id>` (scripts/vmInit.mjs calls this over ssh);
//   • the VM bootstrap, through collab-runtime's step 12, when the installer got --project-id;
//   • collab-sites slot (gb52), the same command over SSM.
//
// Steps:
//   1. `git clone --depth 1` of mls-102039 (the public model) into mls-<id>;
//   2. the model's `.git` is removed (the client does not inherit that history), plus
//      `.github/` and `obj/` if they travelled with the clone;
//   3. every `102039` / `_102039_` is rewritten to the new id (content and path);
//      the model's modules stay — a client with empty l5.modules skips config composers
//      (build.mjs:211) and never gets persistenceModules, so the app dies on an empty
//      registry (`_schema_migrations does not exist`). Measured on 102043 (gb56). An
//      empty client is not a client;
//   4. `.collab-git` is written BEFORE gitReposSetup, so the marker lands INSIDE the
//      vm-baseline commit — a project unprotected until its first push is a project
//      anyone with disk access on the VM may wipe;
//   5. gitReposSetup gives it `main` + `vm-baseline` + the push hook;
//   6. the result is checked, not assumed: no model id left, `main` exists, the project
//      DECLARES its dependencies, and `shellTemplates.spa` is present (without that the
//      app becomes a zombie: pm2 green, nothing listening — measured on 102043).
//
// Idempotent: a second run finds the folder and does nothing. `--force` recreates, and it
// FAILS CLOSED — only a repo that positively proves it has nothing beyond the baseline may
// be deleted (mayRecreate).
//
// The static tree under scripts/templates/project/ is gone on purpose (gb70 / Q1): it was
// a second source of truth that nobody validated, and it shipped without shellTemplates.
// No network to GitHub ⇒ fail with a clear message. There is no offline fallback.

import { spawnSync } from 'node:child_process';
import {
  existsSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');

export const MODEL_ID = '102039';
export const MODEL_REPO_URL = 'https://github.com/expansiva/mls-102039.git';
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
    'usage: node scripts/runtime/projectInit.mjs <projectId|mls-<id>> --from-model [--root <dir>]',
    '       [--force] [--model-url <url>]',
    '  --from-model  clone mls-102039 from GitHub and renumber (the only source)',
    `  --root        mls-base root on the VM (default ${DEFAULT_ROOT})`,
    '  --force       recreate the project — only when main == vm-baseline (never deletes history)',
    '  --model-url   override the model URL (tests only)',
  ].join('\n');
}

export function parseArgs(argv, defaultRoot = DEFAULT_ROOT) {
  const positional = [];
  let root = defaultRoot;
  let force = false;
  let fromModel = false;
  let modelUrl = MODEL_REPO_URL;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') force = true;
    else if (arg === '--from-model') fromModel = true;
    else if (arg === '--root' && argv[i + 1]) { root = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--model-url' && argv[i + 1]) { modelUrl = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--model-url=')) modelUrl = arg.slice('--model-url='.length);
    else if (arg === '--template' || arg.startsWith('--template=')) {
      return {
        ok: false,
        usage: 'the static template is gone; use --from-model (the model is mls-102039 on GitHub).\n' + usage(),
      };
    }
    else positional.push(arg);
  }
  const idMatch = /^(?:mls-)?(\d+)$/u.exec((positional[0] || '').trim());
  if (!idMatch) return { ok: false, usage: usage() };
  const url = String(modelUrl || '').trim();
  if (!url) return { ok: false, usage: usage() };
  // --from-model is the only source: the flag documents the contract; omitting it still clones.
  return { ok: true, id: idMatch[1], root: resolve(root), force, fromModel: true, modelUrl: url, askedFromModel: fromModel };
}

/** What the marker says, for whoever finds the folder without this context. */
export function gitManagedMarkerBody(id, modelCommit = '') {
  const lines = [
    `git-managed project (mls-${id}): the VM is the source of truth.`,
    'The traditional publish must NOT wipe or overwrite this folder — it is updated by git push.',
    'See mls-base/skills/publishGitBackend.md.',
  ];
  if (modelCommit) lines.push(`model-commit: ${modelCommit}`);
  return lines.join('\n');
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
    return { ok: false, reason: `${detail}. I do not delete what I cannot prove is untouched — remove it by hand if that is the case.` };
  }
  if (!state.mainSha || !state.baselineSha) {
    const missing = state.mainSha ? 'vm-baseline' : 'main';
    return { ok: false, reason: `branch ${missing} is missing, so I cannot compare. I do not delete what I cannot prove is untouched — remove it by hand if that is the case.` };
  }
  if (state.mainSha !== state.baselineSha) {
    return {
      ok: false,
      reason: `main ${state.mainSha.slice(0, 7)} != vm-baseline ${state.baselineSha.slice(0, 7)}. I do not delete somebody's history.`,
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

/**
 * Without shellTemplates.spa the app never listens: pm2 stays green and the domain is 502
 * (measured on 102043 — the static scaffold omitted the key). A model that does not carry
 * it is not a client.
 */
export function missingShellTemplates(configText) {
  if (configText === '') return 'l5/config.json ausente';
  let parsed;
  try {
    parsed = JSON.parse(configText);
  } catch {
    return 'l5/config.json inválido (JSON)';
  }
  if (!parsed?.shellTemplates?.spa) return 'l5/config.json sem shellTemplates.spa';
  return '';
}

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: gitEnv() });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}`.trim() };
}

function gitEnv() {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0' };
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
 * macOS metadata that must never reach a project. Measured while shipping files to
 * lima: a `tar` from the Mac carried `._*` AppleDouble files.
 */
export function isMacMetadata(name) {
  return name === '.DS_Store' || name.startsWith('._');
}

function idPattern(id, flags = '') {
  return new RegExp(`(?<![0-9])${id}(?![0-9])`, flags);
}

function walkEntries(dir, onEntry) {
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (isMacMetadata(entry.name)) continue;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = join(current, entry.name);
      onEntry(entry, full);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(dir);
}

function stripMacMetadata(dir) {
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        walk(full);
        continue;
      }
      if (entry.isFile() && isMacMetadata(entry.name)) unlinkSync(full);
    }
  };
  walk(dir);
}

/** Rewrite every model id in CONTENT and PATH. Binary files (NUL) are left as-is. */
export function renumberModel(dir, fromId, toId) {
  if (fromId === toId) return 0;
  const replace = idPattern(fromId, 'g');
  const inName = idPattern(fromId);
  let rewritten = 0;
  const files = [];
  const entries = [];
  walkEntries(dir, (entry, full) => {
    entries.push({ full, name: entry.name });
    if (entry.isFile()) files.push(full);
  });
  for (const file of files) {
    const body = readFileSync(file);
    if (body.includes(0)) continue;
    const text = body.toString('utf8');
    replace.lastIndex = 0;
    const next = text.replace(replace, toId);
    if (next === text) continue;
    writeFileSync(file, next, { mode: statSync(file).mode & 0o777 });
    rewritten += 1;
  }
  entries.sort((a, b) => b.full.length - a.full.length);
  for (const entry of entries) {
    if (!inName.test(entry.name)) continue;
    const nextName = entry.name.replace(idPattern(fromId, 'g'), toId);
    if (nextName === entry.name) continue;
    renameSync(entry.full, join(dirname(entry.full), nextName));
  }
  return rewritten;
}

/** Files where the model id survived — a leftover id is a silent bug (fileReference of 102046). */
export function remainingModelIds(dir, modelId = MODEL_ID) {
  const left = [];
  const pattern = idPattern(modelId); // no /g — .test() lastIndex would skip files
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (isMacMetadata(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        if (pattern.test(entry.name)) left.push(relative(dir, full));
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (pattern.test(entry.name)) { left.push(relative(dir, full)); continue; }
      const body = readFileSync(full);
      if (!body.includes(0) && pattern.test(body.toString('utf8'))) left.push(relative(dir, full));
    }
  };
  walk(dir);
  return left.sort();
}

function networkFailMessage(url, detail) {
  return (
    `cannot reach the model at ${url}:\n${detail}\n` +
    'There is no offline fallback — the model lives on GitHub (the static template was deleted).'
  );
}

function abortCreate(dir, message) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  fail(message);
}

function cloneModel(url, destDir) {
  const probe = spawnSync('git', ['ls-remote', url, 'HEAD'], { encoding: 'utf8', env: gitEnv() });
  if ((probe.status ?? 1) !== 0) {
    fail(networkFailMessage(url, `${probe.stderr ?? ''}${probe.stdout ?? ''}`.trim() || `git ls-remote exit ${probe.status ?? 1}`));
  }
  const cloned = spawnSync('git', ['clone', '--depth', '1', url, destDir], { encoding: 'utf8', env: gitEnv() });
  if ((cloned.status ?? 1) !== 0) {
    abortCreate(
      destDir,
      networkFailMessage(url, `${cloned.stderr ?? ''}${cloned.stdout ?? ''}`.trim() || `git clone exit ${cloned.status ?? 1}`),
    );
  }
  const sha = git(destDir, ['rev-parse', 'HEAD']);
  const commit = sha.code === 0 ? sha.out : '';
  if (!commit) abortCreate(destDir, `cloned ${url} but could not read HEAD`);
  log(`model ${url} @ ${commit}`);
  rmSync(join(destDir, '.git'), { recursive: true, force: true });
  for (const extra of ['.github', 'obj']) {
    const path = join(destDir, extra);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
  stripMacMetadata(destDir);
  return commit;
}

function runGitReposSetup(root, id) {
  const result = spawnSync('node', ['scripts/runtime/gitReposSetup.mjs', '--root', root], {
    cwd: root,
    encoding: 'utf8',
  });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if ((result.status ?? 1) !== 0) fail(`gitReposSetup failed:\n${out.trim()}`);
  const line = out.split(/\n/u).find((row) => row.includes(`mls-${id}`)) || '';
  log(`gitReposSetup: ${line.trim() || 'ok'}`);
}

function readConfig(dir) {
  const configPath = join(dir, 'l5', 'config.json');
  return existsSync(configPath) ? readFileSync(configPath, 'utf8').trim() : '';
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) fail(parsed.usage);
  const { id, root, force, modelUrl } = parsed;

  const setup = join(root, 'scripts', 'runtime', 'gitReposSetup.mjs');
  if (!existsSync(setup)) fail(`incomplete platform: ${setup} is missing`);

  const state = projectState(root, id);
  if (state.exists && !force) {
    log(`mls-${id}: already exists — files untouched (idempotent)`);
    // Mas o REPO é conferido mesmo assim: uma pasta de projeto sem `.git` não tem para onde
    // receber push, e era o estado de toda VM criada antes da correção do `isRepo` (03/09). O
    // `gitReposSetup` é idempotente — quando já está pronto, ele não faz nada.
    runGitReposSetup(root, id);
    process.stdout.write('unchanged\n');
    return;
  }
  if (state.exists && force) {
    const verdict = mayRecreate(state);
    if (!verdict.ok) fail(`--force refused: ${verdict.reason}`);
    log(`mls-${id}: --force, main == vm-baseline → recreating`);
    rmSync(state.dir, { recursive: true, force: true });
  }

  const commit = cloneModel(modelUrl, state.dir);
  const rewritten = renumberModel(state.dir, MODEL_ID, id);
  // Keep the model's modules. Empty l5.modules skips composers (build.mjs:211) and
  // the app dies on an empty persistence registry — gb56, measured on 102043.
  writeFileSync(join(state.dir, GIT_MANAGED_MARKER), `${gitManagedMarkerBody(id, commit)}\n`);

  const left = remainingModelIds(state.dir);
  if (left.length) abortCreate(state.dir, `model id ${MODEL_ID} left over in:\n  ${left.join('\n  ')}`);

  const configText = readConfig(state.dir);
  const depsProblem = missingWorkspaceDependencies(configText);
  if (depsProblem) {
    abortCreate(
      state.dir,
      `mls-${id} will not be able to load an agent: ${depsProblem}.\n` +
        'The host resolves the agent through l5/config.json.workspaceDependencies. Fix the model ' +
        `(${MODEL_REPO_URL}) and run again.`,
    );
  }
  const shellProblem = missingShellTemplates(configText);
  if (shellProblem) {
    abortCreate(
      state.dir,
      `mls-${id} will not boot: ${shellProblem}.\n` +
        'The runtime reads config.shellTemplates[shellMode] at listen time; missing spa is a 502 with pm2 green. ' +
        `Fix the model (${MODEL_REPO_URL}) and run again.`,
    );
  }

  log(`mls-${id}: cloned model @ ${commit.slice(0, 7)}, ${rewritten} file(s) renumbered, ${GIT_MANAGED_MARKER} written`);

  runGitReposSetup(root, id);

  const after = projectState(root, id);
  if (!after.mainSha) fail(`mls-${id} has no main branch after gitReposSetup.`);

  log(`mls-${id}: declares dependencies and shellTemplates — agents will load, app will listen`);
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
