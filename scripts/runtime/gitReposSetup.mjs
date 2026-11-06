#!/usr/bin/env node
// scripts/runtime/gitReposSetup.mjs
// Turn every mls-<id> folder at the mls-base root into a normal (non-bare) git
// repo, on the VM. Idempotent: a re-run completes missing config and reports
// status; it does not recreate vm-baseline or add commits when already set up.
//
// receive.denyCurrentBranch=updateInstead so a push against a dirty worktree
// (Studio/DriverVm save) is refused instead of silently overwriting.
// vm-baseline is an immutable snapshot of the bootstrap commit.
// post-receive (gitPostReceive.sh) compiles on push to main and cuts a release.
//
// A dep cloned from GitHub keeps `origin` (the VM of a customer pulls the lib
// from there) and gets `vm-baseline` so this script will arm it. `--reset-from-origin`
// only fast-forwards those libs (`git fetch` + `merge --ff-only`). A lib that is
// ahead, diverged or dirty is refused, with the local commits or `git status --short`;
// nothing is discarded. It is NOT run by the build. Who fires it (button / schedule,
// N VMs) is collab-sites / gb62. The flag name stays.
//
// A CLIENT PROJECT has no `origin`: its copy here is the one the developer pushes
// with `publish:remote`. Without `origin` the project is skipped (`skipped-no-origin`).
//
// Usage (on the VM):
//   node scripts/runtime/gitReposSetup.mjs
//   node scripts/runtime/gitReposSetup.mjs --root /data/mls-base
//   node scripts/runtime/gitReposSetup.mjs --root /data/mls-base --reset-from-origin
//   node scripts/runtime/gitReposSetup.mjs --root /data/mls-base --reset-from-origin 100554 100555

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newReleaseId, openRelease, readVmId, recordsDir, requestedByFor } from './releaseRecord.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const VM_ROOT = '/data/mls-base';

function isProjectTree(root) {
  return /(?:^|\/)app\d+\/mls-base\/?$/u.test(String(root).replaceAll('\\', '/'));
}

// Raiz: --root, senão MLS_BASE_DIR/COLLAB_MLS_BASE, senão o mls-base que contém este script
// (na árvore nova é /data/app<id>/mls-base; nunca outro caminho por padrão).
const SCRIPT_ROOT = resolve(SCRIPT_DIR, '..', '..');
function resolveMlsBaseRoot({ rootFlag, env = process.env } = {}) {
  const raw = String(rootFlag || env.MLS_BASE_DIR || env.COLLAB_MLS_BASE || SCRIPT_ROOT).trim();
  return raw.replace(/\/+$/u, '') || SCRIPT_ROOT;
}
const GIT_USER_NAME = 'collab-vm';
const GIT_USER_EMAIL = 'vm@collab.codes';
const INITIAL_COMMIT_MSG = 'vm-baseline: initial snapshot';
const COMPLETION_COMMIT_MSG = 'gitReposSetup: complete ignore list';
const SOURCE_INCLUDE_COMMIT_MSG =
  'gitReposSetup: include source .mjs/.js excluded by inherited ignore';

const BOOKKEEPING_COMMIT_MSGS = new Set([COMPLETION_COMMIT_MSG, SOURCE_INCLUDE_COMMIT_MSG]);

const IGNORE_BLOCK_HEADER = '# --- collab-vm (gitReposSetup) ---';
const REQUIRED_IGNORES = [
  '/obj/',
  '/node_modules/',
  '/dist/',
  '/.env',
  '.collab-fs.json',
  '.collab-fs-trash/',
  '.DS_Store',
];
// Inherited Mac .gitignore often has `*.js` / `*.mjs`, which swallows source.
// Negate them after that block; build output stays ignored by directory.
const SOURCE_UNIGNORES = [
  '!*.js',
  '!*.mjs',
];

const UPDATE_HOOK = `#!/bin/sh
# collab-vm gitReposSetup: vm-baseline is a snapshot, never updated by push
ref="$1"
if [ "$ref" = "refs/heads/vm-baseline" ]; then
  echo "refusing update to vm-baseline (immutable snapshot created by gitReposSetup)" >&2
  exit 1
fi
exit 0
`;

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf('--root');
const rootFromFlag = rootFlag >= 0 ? argv[rootFlag + 1] : '';
const ROOT = resolve(resolveMlsBaseRoot({ rootFlag: rootFromFlag }));
const RESET_FROM_ORIGIN = argv.includes('--reset-from-origin');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function git(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: (stdout ?? '').trim(), stderr: '' };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? '').trim(),
      status: typeof error.status === 'number' ? error.status : 1,
    };
  }
}

function gitOrThrow(cwd, args) {
  const result = git(cwd, args);
  if (!result.ok) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${detail}`);
  }
  return result.stdout;
}

function isMlsDir(name, parent) {
  if (!/^mls-\d+$/u.test(name)) return false;
  try {
    return statSync(join(parent, name)).isDirectory();
  } catch {
    return false;
  }
}

function discoverProjects(root) {
  return readdirSync(root)
    .filter((name) => isMlsDir(name, root))
    .sort();
}

/**
 * A PASTA é um repo — não "está dentro de um repo".
 *
 * `git rev-parse --git-dir` sobe a árvore: dentro de um checkout do mls-base ele responde OK para
 * qualquer subpasta, devolvendo o .git do PAI. Com isso todo projeto era classificado como repo
 * alheio (`skipped-external-remote`, porque os remotes lidos eram os do mls-base) e nunca ganhava
 * repositório próprio. Medido em 03/09: na VM o `/data/mls-base` é um clone do GitHub, então
 * NENHUM projeto criado lá tinha `.git` — sem main, sem vm-baseline, e sem para onde empurrar.
 * Na lima passava despercebido porque lá o mls-base chegou por cópia, não por clone.
 */
function isRepo(dir) {
  return existsSync(join(dir, '.git'));
}

function hasHead(dir) {
  return git(dir, ['rev-parse', '--verify', 'HEAD']).ok;
}

function localConfig(dir, key) {
  const result = git(dir, ['config', '--local', '--get', key]);
  return result.ok ? result.stdout : '';
}

function ensureLocalConfig(dir, key, value) {
  if (localConfig(dir, key) === value) return false;
  gitOrThrow(dir, ['config', '--local', key, value]);
  return true;
}

function currentBranch(dir) {
  const result = git(dir, ['symbolic-ref', '--short', 'HEAD']);
  return result.ok ? result.stdout : '';
}

function branchExists(dir, name) {
  return git(dir, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]).ok;
}

function remotes(dir) {
  const result = git(dir, ['remote']);
  if (!result.ok || !result.stdout) return [];
  return result.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

function ignoreLineCovers(line, required) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  if (trimmed === required) return true;
  const bare = required.replace(/^\/+/u, '').replace(/\/+$/u, '');
  const candidates = new Set([
    required,
    bare,
    `/${bare}`,
    `/${bare}/`,
    `${bare}/`,
    `**/${bare}`,
    `**/${bare}/`,
  ]);
  return candidates.has(trimmed);
}

function missingPatterns(text, patterns) {
  const lines = text.split(/\r?\n/u);
  return patterns.filter((pattern) => !lines.some((line) => ignoreLineCovers(line, pattern)));
}

function ensureGitignore(dir) {
  const file = join(dir, '.gitignore');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const missingIgnores = missingPatterns(existing, REQUIRED_IGNORES);
  const missingUnignores = missingPatterns(existing, SOURCE_UNIGNORES);
  if (missingIgnores.length === 0 && missingUnignores.length === 0) {
    return { changed: false, addedUnignores: false };
  }
  const parts = [];
  if (existing && !existing.endsWith('\n')) parts.push('\n');
  if (!existing.includes(IGNORE_BLOCK_HEADER)) {
    if (existing) parts.push('\n');
    parts.push(`${IGNORE_BLOCK_HEADER}\n`);
  } else if (existing) {
    parts.push('\n');
  }
  const missing = [...missingIgnores, ...missingUnignores];
  parts.push(missing.join('\n'), '\n');
  writeFileSync(file, existing + parts.join(''));
  return { changed: true, addedUnignores: missingUnignores.length > 0 };
}

function ensureUpdateHook(dir) {
  const hookPath = join(dir, '.git', 'hooks', 'update');
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current === UPDATE_HOOK) return false;
    if (!current.includes('collab-vm gitReposSetup')) {
      return 'foreign';
    }
  }
  writeFileSync(hookPath, UPDATE_HOOK);
  chmodSync(hookPath, 0o755);
  return true;
}

function postReceiveHookBody() {
  const script = join(SCRIPT_DIR, 'gitPostReceive.sh');
  return `#!/bin/sh
# collab-vm gitReposSetup: post-receive -> build + release
export COLLAB_MLS_BASE="${ROOT}"
exec "${script}"
`;
}

function ensurePostReceiveHook(dir) {
  const scriptPath = join(SCRIPT_DIR, 'gitPostReceive.sh');
  if (existsSync(scriptPath)) chmodSync(scriptPath, 0o755);
  const hookPath = join(dir, '.git', 'hooks', 'post-receive');
  const body = postReceiveHookBody();
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current === body) return false;
    if (!current.includes('collab-vm gitReposSetup')) {
      return 'foreign';
    }
  }
  writeFileSync(hookPath, body);
  chmodSync(hookPath, 0o755);
  return true;
}

function untrackIgnored(dir) {
  const tracked = gitOrThrow(dir, ['ls-files', '-z', '--', 'obj', 'node_modules', 'dist', '.collab-fs.json']);
  if (!tracked) return false;
  gitOrThrow(dir, ['rm', '-r', '--cached', '--ignore-unmatch', '--', 'obj', 'node_modules', 'dist', '.collab-fs.json']);
  return true;
}

function hasStaged(dir) {
  // exit 0 = no diff, 1 = diff
  const result = git(dir, ['diff', '--cached', '--quiet']);
  return !result.ok;
}

function worktreeDirty(dir) {
  const porcelain = gitOrThrow(dir, ['status', '--porcelain']);
  return porcelain.length > 0;
}

function ensureMainBranch(dir) {
  if (branchExists(dir, 'main')) {
    const cur = currentBranch(dir);
    if (cur && cur !== 'main') {
      gitOrThrow(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    }
    return;
  }
  const cur = currentBranch(dir);
  if (cur && cur !== 'main' && hasHead(dir)) {
    gitOrThrow(dir, ['branch', '-m', cur, 'main']);
    return;
  }
  gitOrThrow(dir, ['checkout', '-B', 'main']);
}

function initialCommit(dir) {
  ensureMainBranch(dir);
  gitOrThrow(dir, ['add', '-A']);
  if (!hasStaged(dir)) {
    gitOrThrow(dir, ['commit', '--allow-empty', '-m', INITIAL_COMMIT_MSG]);
  } else {
    gitOrThrow(dir, ['commit', '-m', INITIAL_COMMIT_MSG]);
  }
}

function completionCommit(dir, message) {
  gitOrThrow(dir, ['add', '-A']);
  if (!hasStaged(dir)) return false;
  gitOrThrow(dir, ['commit', '-m', message]);
  return true;
}

export function setupRepo(dir, { root } = {}) {
  const actions = [];

  if (!isRepo(dir)) {
    gitOrThrow(dir, ['init', '-b', 'main']);
    actions.push('init');
  } else if (remotes(dir).length > 0 && !branchExists(dir, 'vm-baseline')) {
    // Fora do VM_ROOT isto é checkout de desenvolvedor e o guard protege a história.
    // Em /data/mls-base não há clone de desenvolvedor; um repo com origin ali só
    // pode ter vindo do resolveDeps (clone antigo, pré-gb77) — arma e conserva origin.
    const armedRoot = resolve(root ?? dirname(dir));
    const inVmRoot = armedRoot === resolve(VM_ROOT) || isProjectTree(armedRoot);
    if (inVmRoot) return armClonedDep(dir);
    return { status: 'skipped-external-remote', actions };
  }

  if (ensureLocalConfig(dir, 'user.name', GIT_USER_NAME)) actions.push('user.name');
  if (ensureLocalConfig(dir, 'user.email', GIT_USER_EMAIL)) actions.push('user.email');
  if (ensureLocalConfig(dir, 'receive.denyCurrentBranch', 'updateInstead')) actions.push('updateInstead');
  if (ensureLocalConfig(dir, 'receive.denyDeletes', 'true')) actions.push('denyDeletes');
  // gb13: sem isto o git NEGOCIA sem opções de push e o `-o skip-build` /
  // `-o deps=…` some em silêncio — o hook compilaria tudo, ou nada, sem avisar.
  if (ensureLocalConfig(dir, 'receive.advertisePushOptions', 'true')) actions.push('advertisePushOptions');

  const hook = ensureUpdateHook(dir);
  if (hook === 'foreign') {
    actions.push('hook-foreign-left-untouched');
  } else if (hook === true) {
    actions.push('update-hook');
  }

  const postReceive = ensurePostReceiveHook(dir);
  if (postReceive === 'foreign') {
    actions.push('post-receive-foreign-left-untouched');
  } else if (postReceive === true) {
    actions.push('post-receive-hook');
  }

  const gitignore = ensureGitignore(dir);
  if (gitignore.changed) actions.push('gitignore');

  const existedHead = hasHead(dir);
  if (!existedHead) {
    initialCommit(dir);
    actions.push('initial-commit');
  } else {
    untrackIgnored(dir);
    const commitMsg = gitignore.addedUnignores
      ? SOURCE_INCLUDE_COMMIT_MSG
      : COMPLETION_COMMIT_MSG;
    if (completionCommit(dir, commitMsg)) actions.push('completion-commit');
  }

  if (!branchExists(dir, 'main')) {
    ensureMainBranch(dir);
    actions.push('main');
  }
  if (!branchExists(dir, 'vm-baseline')) {
    const tip = gitOrThrow(dir, ['rev-parse', 'HEAD']);
    gitOrThrow(dir, ['branch', 'vm-baseline', tip]);
    actions.push('vm-baseline');
  }

  const dirty = worktreeDirty(dir);
  const branches = gitOrThrow(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
  const log = gitOrThrow(dir, ['log', '-1', '--oneline']);
  const status = actions.length === 0 ? 'already configured' : (actions.includes('init') ? 'initialized' : 'completed');
  return {
    status,
    actions,
    dirty,
    branches: branches.split('\n').filter(Boolean),
    head: log,
  };
}

/**
 * Depois de um `git clone` de dep faltante na VM: cria `vm-baseline` e arma
 * com `setupRepo`. O `origin` fica — o caminho normal da VM de cliente é
 * puxar a lib do GitHub; o retrato do `publishGit` é o override de
 * desenvolvimento. O guard `skipped-external-remote` não dispara porque o
 * `vm-baseline` já existe — o guard em si não é afrouxado.
 */
export function armClonedDep(dir) {
  ensureVmBaseline(dir);
  return setupRepo(dir);
}

/** Snapshot imutável do clone. Sem isto o guard recusa repo com remote. */
function ensureVmBaseline(dir) {
  if (!isRepo(dir) || branchExists(dir, 'vm-baseline')) return false;
  if (!hasHead(dir)) {
    throw new Error(`armClonedDep: ${dir} has no HEAD to snapshot as vm-baseline`);
  }
  gitOrThrow(dir, ['branch', 'vm-baseline', gitOrThrow(dir, ['rev-parse', 'HEAD'])]);
  return true;
}

function originDefaultBranch(dir) {
  const sym = git(dir, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (sym.ok) {
    const prefix = 'refs/remotes/origin/';
    if (sym.stdout.startsWith(prefix)) return sym.stdout.slice(prefix.length);
  }
  for (const name of ['main', 'master']) {
    if (git(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`]).ok) {
      return name;
    }
  }
  throw new Error(`resetFromOrigin: origin has no default branch in ${dir}`);
}

/**
 * Avança a cópia da VM até a ponta do GitHub, só com `fetch` + `merge --ff-only`.
 * Igual: não muda. Atrás: fast-forward. À frente, divergente ou árvore suja: recusa
 * e não apaga nada — a mensagem traz `git log --oneline origin/<branch>..HEAD` ou
 * `git status --short`. Sem `origin`, ou com remote e sem `vm-baseline`, pula
 * (checkout de desenvolvedor: o mesmo critério do guard).
 *
 * O nome da opção `--reset-from-origin` fica: quem chama é o collab-sites.
 * Não é chamado pelo build.
 */
const REGENERATED_OBJ_PATHS = ['obj/compiled.zip', 'obj/source.zip'];

export function resetFromOrigin(dir) {
  if (!isRepo(dir)) return { status: 'skipped-not-a-repo' };
  if (!remotes(dir).includes('origin')) return { status: 'skipped-no-origin' };
  if (!branchExists(dir, 'vm-baseline')) return { status: 'skipped-no-vm-baseline' };

  gitOrThrow(dir, ['fetch', 'origin']);
  const branch = originDefaultBranch(dir);
  // The obj zips the release regenerates on this machine (addNewVersion.ensureFechoCompiledZips) are not
  // someone's work: they only count as dirt when the project also has other changes.
  const porcelainLines = gitOrThrow(dir, ['status', '--short']).split('\n').filter(Boolean);
  const regeneratedObj = porcelainLines.filter((line) => REGENERATED_OBJ_PATHS.includes(line.replace(/^\s*\S+\s+/u, '')));
  const porcelain = porcelainLines.filter((line) => !regeneratedObj.includes(line)).join('\n');
  if (porcelain) {
    throw new Error(`resetFromOrigin: dirty worktree in ${dir}\n${porcelain}`);
  }
  const current = currentBranch(dir);
  if (current && current !== branch) {
    gitOrThrow(dir, ['checkout', '-q', branch]);
  }
  const localOnly = gitOrThrow(dir, ['log', '--oneline', `origin/${branch}..HEAD`]);
  if (localOnly) {
    // The commits this script itself makes when it arms a lib (ignore list) are bookkeeping, regenerated by
    // `setupRepo`; they are the only thing a lib may carry that GitHub lacks without it being someone's work.
    const subjects = gitOrThrow(dir, ['log', '--format=%s', `origin/${branch}..HEAD`]).split('\n');
    if (!subjects.every((subject) => BOOKKEEPING_COMMIT_MSGS.has(subject))) {
      throw new Error(
        `resetFromOrigin: ${dir} has commits not in origin/${branch}; refusing\n${localOnly}`,
      );
    }
    gitOrThrow(dir, ['reset', '--hard', `origin/${branch}`]);
    return {
      status: 'dropped-bookkeeping',
      branch,
      head: gitOrThrow(dir, ['rev-parse', 'HEAD']),
      originHead: gitOrThrow(dir, ['rev-parse', `origin/${branch}`]),
    };
  }
  const head = gitOrThrow(dir, ['rev-parse', 'HEAD']);
  const originHead = gitOrThrow(dir, ['rev-parse', `origin/${branch}`]);
  if (head === originHead) return { status: 'unchanged', branch, head, originHead };
  // Going to a newer commit: the origin's zips (the Action's) replace the ones generated here.
  if (regeneratedObj.length) gitOrThrow(dir, ['checkout', '-q', '--', ...regeneratedObj.map((line) => line.replace(/^\s*\S+\s+/u, ''))]);
  gitOrThrow(dir, ['merge', '--ff-only', `origin/${branch}`]);
  return {
    status: 'fast-forward',
    branch,
    head: gitOrThrow(dir, ['rev-parse', 'HEAD']),
    originHead,
  };
}

function parseResetIds(args) {
  const ids = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root') { i += 1; continue; }
    if (arg === '--reset-from-origin' || arg.startsWith('-')) continue;
    const match = /^(?:mls-)?(\d+)$/u.exec(arg);
    if (match) ids.push(match[1]);
  }
  return ids;
}

/**
 * `fetch` + `merge --ff-only` em cada `mls-*` armado que ainda tem `origin`. `ids` (sem o
 * prefixo `mls-`) restringe o conjunto; vazio = todos. Não clona o que falta.
 */
export function resetArmedDepsFromOrigin(root, { ids, log } = {}) {
  const wanted = Array.isArray(ids) && ids.length > 0
    ? new Set(ids.map((id) => String(id).replace(/^mls-/u, '')))
    : null;
  const results = [];
  for (const name of discoverProjects(root)) {
    const id = name.slice('mls-'.length);
    if (wanted && !wanted.has(id)) continue;
    const dir = join(root, name);
    try {
      const result = resetFromOrigin(dir);
      log?.(`${name} | ${result.status}${result.branch ? ` origin/${result.branch}` : ''}`);
      results.push({ name, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.(`${name} | error | ${message}`);
      results.push({ name, status: 'error', error: message });
    }
  }
  return results;
}

function main() {
  if (!gitAvailable()) {
    fail(
      'git is not installed on this machine.\n'
      + 'Install it (Ubuntu: sudo apt-get install -y git) and re-run this script.\n'
      + 'Installing git is a manual operator action; this script will not do it.',
    );
  }

  if (!rootFromFlag && ROOT !== VM_ROOT && !isProjectTree(ROOT)) {
    fail(
      `Refusing to run at ${ROOT}.\n`
      + `This script initializes git inside every mls-* folder and is meant for the VM (${VM_ROOT} or /data/app<id>/mls-base).\n`
      + 'On the VM: node scripts/runtime/gitReposSetup.mjs\n'
      + 'To override: node scripts/runtime/gitReposSetup.mjs --root <path>',
    );
  }

  if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) {
    fail(`root does not exist or is not a directory: ${ROOT}`);
  }

  const projects = discoverProjects(ROOT);
  if (projects.length === 0) {
    fail(`no mls-<id> folders found under ${ROOT}`);
  }

  if (RESET_FROM_ORIGIN) {
    const ids = parseResetIds(argv);
    console.log(
      `gitReposSetup --reset-from-origin root=${ROOT}`
      + (ids.length ? ` ids=${ids.join(',')}` : ` projects=${projects.length}`),
    );
    // ONE request = ONE record (rt190). This step opens the record only when a release follows it in the same command
    // (COLLAB_RELEASE_FOLLOWS=1, set by the sites in the chains that end with a release): the release then CONTINUES
    // this record (same request id), so `deps` is one step of it and a failure here is not lost. Without the variable
    // the reset stands alone and leaves no record: before, it left an open `app` record with no project that nothing
    // closed on success and that the sweeper turned into a false `falhou` two hours later. A failure of a lone reset
    // comes back as the exit code of the command (the sites reads it when the command ends).
    const requestId = String(process.env.COLLAB_RELEASE_REQUEST_ID ?? '').trim();
    const releaseFollows = String(process.env.COLLAB_RELEASE_FOLLOWS ?? '').trim() === '1';
    const requestedQueue = String(process.env.COLLAB_RELEASE_QUEUE ?? '').trim();
    const requestedProject = String(process.env.COLLAB_RELEASE_PROJECT_ID ?? '').trim();
    const rec = requestId && releaseFollows
      ? openRelease({
        root: ROOT,
        dir: recordsDir(ROOT, 'app'),
        releaseId: newReleaseId(),
        queue: ['base', 'libs', 'shared', 'app'].includes(requestedQueue) ? requestedQueue : 'app',
        projectId: /^\d+$/u.test(requestedProject) ? requestedProject : null,
        vmId: readVmId(),
        requestId,
        requestedBy: requestedByFor(),
      })
      : null;
    let rows;
    try {
      rows = rec
        ? rec.step('deps', () => resetArmedDepsFromOrigin(ROOT, { ids, log: (line) => console.log(line) }))
        : resetArmedDepsFromOrigin(ROOT, { ids, log: (line) => console.log(line) });
    } catch (error) {
      if (rec) rec.close({ error });
      throw error;
    }
    const failed = rows.filter((row) => row.status === 'error').length;
    if (rec && failed) {
      const error = new Error(`${failed} dependency repo(s) could not be updated from origin`);
      rec.markFailed('deps', error);
      rec.close({ error });
    }
    const counts = new Map();
    for (const row of rows) counts.set(row.status, (counts.get(row.status) || 0) + 1);
    console.log('---');
    for (const [status, n] of [...counts.entries()].sort()) {
      console.log(`${n} ${status}`);
    }
    if (failed) process.exit(1);
    return;
  }

  console.log(`gitReposSetup root=${ROOT} projects=${projects.length}`);
  const rows = [];
  let failed = 0;
  for (const name of projects) {
    const dir = join(ROOT, name);
    try {
      const result = setupRepo(dir, { root: ROOT });
      const extra = result.actions.length ? ` [${result.actions.join(', ')}]` : '';
      const dirty = result.dirty ? ' dirty' : '';
      console.log(`${name} | ${result.status}${extra}${dirty} | ${dir}`);
      if (result.head) console.log(`  HEAD ${result.head}  branches: ${result.branches.join(', ')}`);
      rows.push({ name, ...result });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${name} | error | ${dir}`);
      console.error(`  ${message}`);
      rows.push({ name, status: 'error', actions: [message] });
    }
  }

  const counts = new Map();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) || 0) + 1);
  console.log('---');
  for (const [status, n] of [...counts.entries()].sort()) {
    console.log(`${n} ${status}`);
  }
  if (failed) process.exit(1);
}

// realpath on BOTH sides: import.meta.url is already resolved, process.argv[1]
// is whatever the caller typed. Comparing them raw makes the script a silent
// no-op through a symlink (temp dir on macOS, /data on a VM).
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
