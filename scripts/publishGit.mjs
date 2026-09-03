#!/usr/bin/env node
// scripts/publishGit.mjs — publish ONE mls-* project to the VM via git push.
//
// Day-to-day path: change a project locally, commit, push over the same SSH
// the full publish already uses. The VM hook (gitPostReceive) compiles and
// either cuts a release or prints the tsc error. Exit code follows the BUILD
// (A1: a red build can still accept the push).
//
// Host / ssh-config / remote base: same keys as publishMlsBase.py
// (PUBLISH_LOCAL_* in mls-base/.env for `local`; CLI flags or
// servers/<profile>.conf for `remote`). No new config surface.
//
// Local obj/ is disposable: the VM hook (and the GitHub Action) rebuild it.
// Each run deletes obj/ from disk and git and commits that, then pushes.
//
// --autocommit (opt-in): if the worktree is still dirty after that, git add -A
// (honouring .gitignore) and commit `publish: <area> (n arquivos), …`.
// Without the flag a dirty worktree is refused — the script does not commit.
//
// Usage (any cwd; ROOT is this file's mls-base):
//   node scripts/publishGit.mjs <projetoId|mls-<id>> <local|remote> [--align] [--autocommit]
//   node scripts/publishGit.mjs <projetoId|mls-<id>> clone <local|remote>
//   pnpm publishGit 102044 local

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { depsSummary, dependencyOrder, declaredDepsOf, planSnapshot, readDepIds, sendSnapshot } from './publishGitDeps.mjs';
import { homedir } from 'node:os';
import {
  AUTH_EXIT, httpsUrl, isAuthFailure, readSession, tokenState, withCredentialHelper, writeToken,
  credentialHelperValue, resolvePushToken,
} from './publishGitAuth.mjs';
import { runRedirectLogin } from './publishGitLogin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REMOTE_BASE = '/data/mls-base';
const VM_REMOTE = 'vm';
const LOCAL_ENV_TO_CONF = {
  PUBLISH_LOCAL_SSH_HOST: 'SSH_HOST',
  PUBLISH_LOCAL_SSH_CONFIG: 'SSH_CONFIG',
  PUBLISH_LOCAL_REMOTE_BASE: 'REMOTE_BASE',
  PUBLISH_LOCAL_CERT: 'CERT',
  PUBLISH_LOCAL_MULTIPASS_INSTANCE: 'MULTIPASS_INSTANCE',
};
const CLI_FLAG_TO_CONF = {
  '--ssh-host': 'SSH_HOST',
  '--ssh-config': 'SSH_CONFIG',
  '--remote-base': 'REMOTE_BASE',
  '--ssh-cert': 'CERT',
  // gb50: publicar por smart HTTP em vez de ssh. Presente ⇒ o remote `vm` é https e a identidade é o
  // JWT do collab-auth (publishGit login), não a chave ssh.
  '--git-url': 'GIT_URL',
};

const MARKER_OK = /##gitBackend build=ok release=(\d{14}) project=mls-\d+##/;
const MARKER_ERR = /##gitBackend build=error\b/;
const DIRTY_VM_RE =
  /working directory has unstaged changes|uncommitted changes|denyCurrentBranch|refusing to update/i;
const OBJ_IGNORE = '/obj/';
const OBJ_COMMIT_MSG = 'chore: remove obj/ (build é da VM)';
const BOOKKEEPING_IGNORES = ['.collab-fs.json', '.collab-fs-trash/'];
const PUBLISH_SKILL = 'mls-base/skills/publishGitBackend.md';
export const DIRTY_LOCAL_MSG =
  'worktree local suja: commit antes de publicar (o script não commita por conta própria). ' +
  `Use --autocommit para um commit determinístico, ou commite com mensagem coerente — ver ${PUBLISH_SKILL}.`;

function usage() {
  return [
    'usage: node scripts/publishGit.mjs <projetoId|mls-<id>> <local|remote> [--align] [--autocommit]',
    '       node scripts/publishGit.mjs login [--paste] [--install-helper]',
    '       node scripts/publishGit.mjs <projetoId|mls-<id>> clone <local|remote>',
    '       [--ssh-host=…] [--ssh-config=…] [--remote-base=…] [--ssh-cert=…] [--git-url=…]',
    '  login  — abre o browser, autentica no collab-auth e grava a sessão em ~/.collab/publishGit.json',
    '           --paste: cola o token na mão (fallback); --install-helper: registra o credential',
    '           helper no git config global (para `git clone` cru). O access renova sozinho no push',
    '  --git-url=https://<vm> — publica por https (JWT) em vez de ssh; sem isto nada muda',
    '  local  — PUBLISH_LOCAL_* from mls-base/.env (same as publishMlsBase.py)',
    '  remote — CLI flags, else servers/remote.conf (copy from servers/remote.conf.example)',
    '  clone  — git clone from the VM; existing folder: connect remote `vm` and report state, never force',
    '  --align — first-time unrelated histories: --force-with-lease after a diff + confirm',
    '  --autocommit — dirty worktree: git add -A and commit `publish: <área> (n arquivos), …` before push',
    '  obj/ is disposable locally (the VM hook rebuilds it); publishGit deletes it from disk and git before push',
  ].join('\n');
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function expandConfValue(value) {
  const home = homedir();
  if (value.startsWith('~')) value = home + value.slice(1);
  return value.replaceAll('${HOME}', home).replaceAll('$HOME', home);
}

function parseKeyValueFile(path) {
  const conf = {};
  if (!existsSync(path)) return conf;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    conf[m[1]] = expandConfValue(value);
  }
  return conf;
}

function loadLocalConf() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    fail(
      `Missing PUBLISH_LOCAL_SSH_HOST in ${envPath}: file not found. ` +
        'Add PUBLISH_LOCAL_SSH_HOST, PUBLISH_LOCAL_SSH_CONFIG and PUBLISH_LOCAL_REMOTE_BASE.',
    );
  }
  const raw = parseKeyValueFile(envPath);
  const conf = {};
  for (const [envKey, confKey] of Object.entries(LOCAL_ENV_TO_CONF)) {
    const value = (raw[envKey] || '').trim();
    if (value) conf[confKey] = expandConfValue(value);
  }
  if (!conf.SSH_HOST) {
    fail(
      `Missing PUBLISH_LOCAL_SSH_HOST in ${envPath}. ` +
        'git publish needs SSH (not Multipass); same keys as the full local publish.',
    );
  }
  return conf;
}

function resolveConfPath(profile, clientRoot) {
  const candidates = [
    join(clientRoot, `publish${profile.slice(0, 1).toUpperCase()}${profile.slice(1)}.conf`),
    join(clientRoot, `publish.${profile}.conf`),
    join(clientRoot, `${profile}.conf`),
    join(ROOT, 'servers', `${profile}.conf`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export function remoteConfMissingMessage(root = ROOT) {
  const confPath = join(root, 'servers', 'remote.conf');
  const examplePath = join(root, 'servers', 'remote.conf.example');
  return (
    `Server config not found for profile 'remote'. ` +
    `Create ${confPath} (copy from ${examplePath}; keys: SSH_HOST, SSH_CONFIG, REMOTE_BASE). ` +
    `Or pass --ssh-host=… [--ssh-config=…] [--remote-base=…], or --git-url=https://<vm> (gb50: JWT, no ssh).`
  );
}

function loadRemoteConf(projectDir, flagConf) {
  const conf = { ...flagConf };
  // gb50: com `--git-url` o transporte é https e a identidade é o JWT — não existe host ssh para
  // exigir. Cobrar SSH_HOST aqui bloqueava justamente o caminho que dispensa ssh.
  if (conf.SSH_HOST || conf.GIT_URL) return conf;
  const confPath = resolveConfPath('remote', projectDir);
  if (!confPath) {
    fail(remoteConfMissingMessage());
  }
  return { ...parseKeyValueFile(confPath), ...conf };
}

// Same conf chain the publish uses, exported so vmInit.mjs does not duplicate it.
export function resolveProfileConf(profile, projectDir = ROOT, flagConf = {}) {
  const conf = profile === 'local' ? loadLocalConf() : loadRemoteConf(projectDir, flagConf);
  if (conf.GIT_URL) return conf;
  if (conf.MULTIPASS_INSTANCE && !conf.SSH_HOST) {
    fail('git publish precisa de SSH_HOST; Multipass sozinho não serve de remote git.');
  }
  return conf;
}

export function parseArgs(argv) {
  const positional = [];
  const flagConf = {};
  let align = false;
  let autocommit = false;
  let noDeps = false;
  let installHelper = false;
  let paste = false;
  for (const arg of argv) {
    if (arg === '--align') {
      align = true;
    } else if (arg === '--no-deps') {
      noDeps = true;
    } else if (arg === '--autocommit') {
      autocommit = true;
    } else if (arg === '--install-helper') {
      installHelper = true;
    } else if (arg === '--paste') {
      paste = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      const name = arg.slice(0, eq);
      const confKey = CLI_FLAG_TO_CONF[name];
      if (!confKey) fail(`unknown flag ${name}\n${usage()}`);
      flagConf[confKey] = expandConfValue(arg.slice(eq + 1));
    } else if (arg.startsWith('-')) {
      fail(`unknown flag ${arg}\n${usage()}`);
    } else {
      positional.push(arg);
    }
  }
  // `login` não tem projeto nem perfil: é a identidade da PESSOA, e vale para todas as VMs.
  if (positional[0] === 'login') {
    if (positional.length !== 1) fail(usage());
    return { command: 'login', installHelper, paste, id: '', profile: '', align, autocommit, noDeps, flagConf };
  }
  const projectRaw = positional[0] || '';
  const second = positional[1] || '';
  let command = 'publish';
  let profile = second;
  if (second === 'clone') {
    command = 'clone';
    profile = positional[2] || '';
    if (positional.length !== 3) fail(usage());
  } else if (positional.length !== 2) {
    fail(usage());
  }
  const idMatch = /^(?:mls-)?(\d+)$/u.exec(projectRaw.trim());
  if (!idMatch || (profile !== 'local' && profile !== 'remote')) {
    fail(usage());
  }
  return { id: idMatch[1], profile, command, align, autocommit, noDeps, installHelper, paste, flagConf };
}

function gitSync(cwd, args, env = process.env) {
  const result = spawnSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.error) {
    return { code: 1, stdout, stderr, out: `${stdout}${stderr}${result.error.message}` };
  }
  return { code: result.status ?? 1, stdout, stderr, out: `${stdout}${stderr}` };
}

function gitOut(cwd, args, env) {
  const result = gitSync(cwd, args, env);
  if (result.code !== 0) {
    fail(`git ${args.join(' ')} failed:\n${result.out.trim()}`);
  }
  return result.stdout.trim();
}

function gitEnv(conf) {
  const env = { ...process.env };
  const parts = ['ssh'];
  if (conf.SSH_CONFIG) parts.push('-F', conf.SSH_CONFIG);
  if (conf.CERT) parts.push('-i', conf.CERT);
  if (parts.length > 1) env.GIT_SSH_COMMAND = parts.join(' ');
  return env;
}

function sshUrl(conf, projectName) {
  // Sem SSH_HOST a interpolação produzia `ssh://undefined/data/mls-base/…` — uma URL que o git
  // aceita montar e falha só na conexão, com uma mensagem que não diz o que faltou. Falhar aqui é o
  // guard: qualquer caminho novo que esqueça o perfil https é pego na hora.
  if (!conf.SSH_HOST) {
    fail('perfil sem SSH_HOST: use --git-url=https://<vm> (publish por JWT) ou informe --ssh-host.');
  }
  const base = (conf.REMOTE_BASE || DEFAULT_REMOTE_BASE).replace(/\/+$/u, '');
  return `ssh://${conf.SSH_HOST}${base}/${projectName}`;
}

function ensureVmRemote(repo, url) {
  const remotes = gitOut(repo, ['remote']);
  const names = remotes ? remotes.split(/\n/u) : [];
  if (!names.includes(VM_REMOTE)) {
    gitOut(repo, ['remote', 'add', VM_REMOTE, url]);
    process.stderr.write(`[publishGit] remote ${VM_REMOTE} → ${url}\n`);
    return;
  }
  const current = gitOut(repo, ['remote', 'get-url', VM_REMOTE]);
  if (current !== url) {
    gitOut(repo, ['remote', 'set-url', VM_REMOTE, url]);
    process.stderr.write(`[publishGit] remote ${VM_REMOTE} atualizado → ${url}\n`);
  }
}

export function isDirty(repo) {
  const porcelain = gitOut(repo, ['status', '--porcelain']);
  return porcelain.length > 0;
}

function gitignoreCoversObj(text) {
  const candidates = new Set(['/obj/', 'obj', '/obj', 'obj/', '**/obj', '**/obj/']);
  return text.split(/\r?\n/u).some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && candidates.has(trimmed);
  });
}

function ensureObjGitignore(repo) {
  const file = join(repo, '.gitignore');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (gitignoreCoversObj(existing)) return false;
  const glue = !existing ? '' : existing.endsWith('\n') ? '' : '\n';
  writeFileSync(file, `${existing}${glue}${OBJ_IGNORE}\n`);
  return true;
}

function gitignoreCoversExact(text, pattern) {
  const aliases = new Set([pattern, pattern.replace(/\/$/u, ''), `${String(pattern).replace(/\/$/u, '')}/`]);
  return text.split(/\r?\n/u).some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && aliases.has(trimmed);
  });
}

export function ensureBookkeepingGitignore(repo) {
  const file = join(repo, '.gitignore');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const missing = BOOKKEEPING_IGNORES.filter((pattern) => !gitignoreCoversExact(existing, pattern));
  if (missing.length === 0) return false;
  const glue = !existing ? '' : existing.endsWith('\n') ? '' : '\n';
  writeFileSync(file, `${existing}${glue}${missing.join('\n')}\n`);
  return true;
}

function untrackBookkeeping(repo) {
  const tracked = gitSync(repo, ['ls-files', '-z', '--', '.collab-fs.json', '.collab-fs-trash']).stdout;
  if (!tracked) return false;
  gitOut(repo, ['rm', '-r', '--cached', '--ignore-unmatch', '--', '.collab-fs.json', '.collab-fs-trash']);
  return true;
}

function areaOf(path) {
  const normalized = String(path).replace(/\\/g, '/').replace(/^\.\//u, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts[0] === 'l2' && parts[1]) return `l2/${parts[1]}`;
  if (parts[0] && /^l\d+$/u.test(parts[0])) return parts[0];
  return parts[0] || normalized;
}

function compareAreas(a, b) {
  const rank = (s) => {
    const m = /^l(\d+)/u.exec(s);
    return m ? Number(m[1]) : 100;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

export function commitMessageFromNames(names) {
  const counts = new Map();
  for (const name of names) {
    if (!name) continue;
    const area = areaOf(name);
    counts.set(area, (counts.get(area) || 0) + 1);
  }
  const keys = [...counts.keys()].sort(compareAreas);
  if (keys.length === 0) return 'publish: local';
  const parts = keys.map((key) => {
    const n = counts.get(key);
    const word = n === 1 ? 'arquivo' : 'arquivos';
    return `${key} (${n} ${word})`;
  });
  return `publish: ${parts.join(', ')}`;
}

/** git add -A (honours .gitignore) + one `publish: …` commit. No empty commit. */
export function autocommitDirty(repo) {
  ensureBookkeepingGitignore(repo);
  untrackBookkeeping(repo);
  gitOut(repo, ['add', '-A']);
  const namesRaw = gitOut(repo, ['diff', '--cached', '--name-only']);
  const names = namesRaw ? namesRaw.split(/\n/u).filter(Boolean) : [];
  if (names.length === 0) return false;
  const message = commitMessageFromNames(names);
  gitOut(repo, ['commit', '-m', message]);
  process.stderr.write(`[publishGit] ${message}\n`);
  return true;
}

/** Local obj/ is never the build the VM consumes. Drop it from disk + git and commit. */
function removeLocalObj(repo) {
  const tracked = gitSync(repo, ['ls-files', '--', 'obj']).stdout.trim();
  const onDisk = existsSync(join(repo, 'obj'));
  if (!tracked && !onDisk) return false;

  process.stderr.write('[publishGit] removendo obj/ local (descartável; o build é da VM).\n');
  const gitignoreChanged = ensureObjGitignore(repo);
  if (tracked) {
    const rm = gitSync(repo, ['rm', '-r', '--cached', '--ignore-unmatch', '--', 'obj']);
    if (rm.code !== 0) fail(`git rm -r --cached obj failed:\n${rm.out.trim()}`);
  }
  if (onDisk) rmSync(join(repo, 'obj'), { recursive: true, force: true });
  if (gitignoreChanged) gitOut(repo, ['add', '--', '.gitignore']);

  const pending = gitOut(repo, ['status', '--porcelain', '--', 'obj', '.gitignore']);
  if (!pending) return false;

  gitOut(repo, ['commit', '-m', OBJ_COMMIT_MSG, '--', 'obj', '.gitignore']);
  process.stderr.write(`[publishGit] ${OBJ_COMMIT_MSG}\n`);
  return true;
}

function runGitLive(cwd, args, env) {
  return new Promise((resolvePromise) => {
    const child = spawn('git', args, {
      cwd,
      env,
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
      const message = `failed to start git: ${error.message}\n`;
      process.stderr.write(message);
      resolvePromise({ code: 1, out: out + message });
    });
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, out });
    });
  });
}

function stripRemotePrefix(text) {
  return String(text)
    .split(/\r?\n/u)
    .map((line) => line.replace(/^remote:\s?/u, ''))
    .join('\n');
}

function tscExcerpt(text, n = 40) {
  const lines = stripRemotePrefix(text)
    .split(/\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => /\berror TS\d+/u.test(line));
  const unique = [...new Set(lines)];
  if (unique.length > 0) return unique.slice(0, n).join('\n');
  return '';
}

function printDiffSummary(repo, localSha, remoteSha) {
  const localLog = gitOut(repo, ['log', '-1', '--oneline', localSha]);
  const remoteLog = gitOut(repo, ['log', '-1', '--oneline', remoteSha]);
  const excludeObj = ['--', '.', ':!obj', ':!obj/**'];
  const stat = gitSync(repo, ['diff', '--stat', remoteSha, localSha, ...excludeObj]).stdout.trim();
  const names = gitOut(repo, ['diff', '--name-only', remoteSha, localSha, ...excludeObj]);
  const count = names ? names.split(/\n/u).filter(Boolean).length : 0;
  process.stderr.write('\n[publishGit] histórias ainda não alinhadas (HEAD local × main da VM)\n');
  process.stderr.write(`  HEAD local: ${localLog}\n`);
  process.stderr.write(`  main na VM: ${remoteLog}\n`);
  process.stderr.write(`  arquivos diferentes: ${count}\n`);
  if (stat) process.stderr.write(`${stat}\n`);
}

async function confirmAlign() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolveAnswer) => {
    rl.question(
      'Isto substitui a main da VM pelo HEAD local (--force-with-lease). Continuar? [y/N] ',
      resolveAnswer,
    );
  });
  rl.close();
  return /^(y|yes|s|sim)$/iu.test(String(answer).trim());
}

/**
 * `publishGit login` — a identidade da pessoa.
 *
 * Por REDIRECT (gb53): sobe um servidor em `127.0.0.1:<porta aleatória>`, abre o browser no
 * collab-auth e recebe o par access+refresh de volta sem ninguém copiar nada. `--paste` mantém a
 * colagem do gb50 como fallback — para uma máquina sem browser, ou se o collab-auth ainda não
 * estiver publicado com o `loopback` na allowlist.
 *
 * O access vale 1h e o refresh 30 dias: quem faz login hoje só refaz em 30 dias, porque a renovação
 * acontece dentro do `git push` (credential helper), não aqui.
 */
async function runLogin({ installHelper, paste }) {
  const current = readSession();
  if (current.access) {
    process.stderr.write(
      `[publishGit] sessão atual: ${current.email || '(sem e-mail)'} — ${current.state}`
      + `${current.expiresAt ? ` (access até ${current.expiresAt})` : ''}`
      + `${current.refresh ? '' : ' — sem refresh (login antigo)'}\n`,
    );
  }

  if (!paste) {
    try {
      const saved = await runRedirectLogin({});
      process.stderr.write(
        `[publishGit] sessão guardada em ${saved.path} (modo 600): ${saved.email || '(sem e-mail)'}\n`,
      );
      if (saved.hasRefresh) {
        process.stderr.write('[publishGit] o access renova sozinho no push; o refresh vale 30 dias.\n');
      } else {
        // Sem refresh o "login uma vez" não existe: melhor dizer agora que descobrir no push.
        process.stderr.write('[publishGit] atenção: o collab-auth não devolveu refresh — vai pedir login de novo em 1h.\n');
      }
      reportHelperSetup(installHelper);
      return 0;
    } catch (error) {
      process.stderr.write(`[publishGit] login por browser falhou: ${error.message}\n`);
      process.stderr.write('[publishGit] tentando a colagem (mesmo resultado, um passo manual): use --paste para ir direto.\n');
    }
  }

  process.stderr.write(
    '\nCole o access token do collab-auth (o mesmo do cookie `cauth` de uma sessão do runtime).\n'
    + 'Como obter: abra o app publicado, faça login e copie o token de `GET /session/info`\n'
    + '(ou do cookie cauth). Ele vale 1 hora — sem refresh, o login por browser é melhor.\n',
  );
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolveAnswer) => rl.question('token: ', resolveAnswer));
  rl.close();
  const token = String(answer).trim();
  if (!token) fail('[publishGit] nenhum token informado — nada gravado.', AUTH_EXIT);

  const { state, email, expiresAt } = tokenState(token);
  if (state === 'invalid') {
    fail('[publishGit] isto não parece um JWT do collab-auth (esperado header.payload.signature com exp).', AUTH_EXIT);
  }
  if (state === 'expired') {
    fail(`[publishGit] este token já expirou${expiresAt ? ` em ${expiresAt}` : ''} — pegue um novo.`, AUTH_EXIT);
  }
  const saved = writeToken(token);
  process.stderr.write(`[publishGit] token guardado em ${saved.path} (modo 600): ${email || '(sem e-mail)'} até ${expiresAt}\n`);
  reportHelperSetup(installHelper);
  return 0;
}

function reportHelperSetup(installHelper) {
  const helperScript = join(ROOT, 'scripts', 'publishGitCredential.mjs');
  if (installHelper) {
    // Mexe no git config GLOBAL do usuário — por isso só com a flag explícita.
    const set = gitSync(ROOT, ['config', '--global', 'credential.helper', credentialHelperValue(helperScript)]);
    if (set.code !== 0) fail(`[publishGit] não consegui registrar o credential helper:\n${set.out.trim()}`);
    process.stderr.write('[publishGit] credential helper registrado no git config global (`git clone` cru já funciona).\n');
    return;
  }
  process.stderr.write(
    '[publishGit] o publish por --git-url já usa a sessão sem mais nada.\n'
    + '            Para um `git clone` cru funcionar sem digitar token, rode uma vez:\n'
    + `            git config --global credential.helper '${credentialHelperValue(helperScript)}'\n`
    + '            (ou repita este login com --install-helper)\n',
  );
}

/**
 * A URL do remote `vm`: https quando o perfil declara `GIT_URL` (gb50), ssh como sempre.
 *
 * Um perfil sem `GIT_URL` não muda de comportamento em nada — é o que mantém a lima e o publish
 * tradicional funcionando enquanto a VM remota migra.
 */
export function remoteUrlFor(conf, projectName) {
  return httpsUrl(conf.GIT_URL, projectName) || sshUrl(conf, projectName);
}

/** O ambiente do git: para https, o credential helper entra por env (nada escrito no config do usuário). */
export function gitEnvFor(conf, root = ROOT) {
  const env = gitEnv(conf);
  if (!conf.GIT_URL) return env;
  return withCredentialHelper(env, join(root, 'scripts', 'publishGitCredential.mjs'));
}

function failAuth(text) {
  const { state, email, refresh } = readSession();
  const diagnosis = state === 'ok'
    ? `o token de ${email || 'você'} foi recusado pela VM`
    : state === 'expired'
      ? (refresh ? 'sua sessão expirou e o refresh também foi recusado' : 'seu token expirou')
      : 'você não tem sessão guardada';
  fail(
    `\n[publishGit] ${diagnosis}. Rode: pnpm publishGit login\n`
    + `${String(text ?? '').trim().split('\n').slice(-3).join('\n')}`,
    AUTH_EXIT,
  );
}

function relation(repo, localSha, remoteSha) {
  if (localSha === remoteSha) return 'same';
  const localHasRemote = gitSync(repo, ['merge-base', '--is-ancestor', remoteSha, localSha]);
  if (localHasRemote.code === 0) return 'ahead';
  const remoteHasLocal = gitSync(repo, ['merge-base', '--is-ancestor', localSha, remoteSha]);
  if (remoteHasLocal.code === 0) return 'behind';
  const base = gitSync(repo, ['merge-base', localSha, remoteSha]);
  if (base.code !== 0) return 'unrelated';
  return 'diverged';
}

function describeCloneRelation(rel) {
  switch (rel) {
    case 'same':
      return 'igual à main da VM. Nada a alinhar.';
    case 'ahead':
      return 'à frente da VM. pnpm publish:git (lima) ou pnpm publish:remote publica.';
    case 'behind':
      return 'atrás da VM. A VM tem commits que você não tem — faça pull/rebase. Clone não sobrescreve.';
    case 'diverged':
      return 'divergente. Clone não sobrescreve. pull/rebase, ou --align (confirmação humana).';
    case 'unrelated':
      return (
        'histórias não relacionadas (caso normal depois de um publish tradicional). ' +
        'Para alinhar, rode publishGit com --align (confirmação humana; clone não executa force).'
      );
    default:
      return String(rel);
  }
}

function alignHint(id, profile) {
  return (
    `  node scripts/publishGit.mjs ${id} ${profile} --align\n` +
    '  (confirmação interativa; clone nunca faz force)\n'
  );
}

async function fetchVmHeads(repo, env) {
  const fetched = await runGitLive(repo, ['fetch', VM_REMOTE, '+refs/heads/*:refs/remotes/vm/*'], env);
  if (fetched.code !== 0) {
    fail(`não consegui ler a VM:\n${fetched.out.trim()}`);
  }
  return gitSync(repo, ['rev-parse', 'refs/remotes/vm/vm-baseline']).code === 0;
}

/**
 * Clone the VM project, or connect an existing local folder to remote `vm`.
 * Never force, never confirmAlign, never overwrite local work.
 */
export async function runClone({ dest, url, env = process.env, id, profile }) {
  if (existsSync(dest) && !statSync(dest).isDirectory()) {
    fail(`destino não é uma pasta: ${dest}`);
  }

  if (!existsSync(dest)) {
    process.stderr.write(`[publishGit] clone ${url} → ${dest}\n`);
    const cloned = await runGitLive(dirname(dest), ['clone', '-o', VM_REMOTE, url, dest], env);
    if (cloned.code !== 0) {
      if (isAuthFailure(cloned.out)) failAuth(cloned.out);
      fail(`git clone falhou (exit ${cloned.code}).`);
    }
    ensureVmRemote(dest, url);
    const hasBaseline = await fetchVmHeads(dest, env);
    process.stderr.write(`[publishGit] clone ok: ${dest}\n`);
    process.stderr.write(
      `  branches: main${hasBaseline ? ' + vm-baseline' : ' (vm-baseline ausente; gitReposSetup incompleto?)'}\n`,
    );
    return { action: 'cloned', relation: 'same', hasBaseline };
  }

  if (!existsSync(join(dest, '.git'))) {
    gitOut(dest, ['init', '-b', 'main']);
    ensureVmRemote(dest, url);
    const hasBaseline = await fetchVmHeads(dest, env);
    process.stderr.write(
      `[publishGit] ${`mls-${id}`} já existia sem git: repo inicializado, remote ${VM_REMOTE} → ${url}\n` +
        '  histórias não relacionadas com a VM (esperado). Para alinhar, rode:\n' +
        alignHint(id, profile),
    );
    return { action: 'inited', relation: 'unrelated', hasBaseline };
  }

  const localShaBefore = gitSync(dest, ['rev-parse', 'HEAD']).stdout.trim();
  ensureVmRemote(dest, url);
  const hasBaseline = await fetchVmHeads(dest, env);
  const localShaAfter = gitSync(dest, ['rev-parse', 'HEAD']).stdout.trim();
  if (localShaBefore && localShaAfter && localShaBefore !== localShaAfter) {
    fail('clone recusou continuar: HEAD local mudou durante o fetch (não deveria).');
  }

  const hasHead = Boolean(localShaAfter);
  const remoteRef = gitSync(dest, ['rev-parse', 'refs/remotes/vm/main']);
  let rel = 'unrelated';
  if (hasHead && remoteRef.code === 0) {
    rel = relation(dest, localShaAfter, remoteRef.stdout.trim());
  }

  process.stderr.write(`[publishGit] ${`mls-${id}`} já é um git. remote ${VM_REMOTE} → ${url}\n`);
  process.stderr.write(`  estado: ${describeCloneRelation(rel)}\n`);
  if (rel === 'unrelated') process.stderr.write(alignHint(id, profile));
  return { action: 'connected', relation: rel, hasBaseline };
}

function explainDirtyVm(out) {
  process.stderr.write(
    '\n[publishGit] a VM recusou o push (worktree suja — proteção updateInstead).\n' +
      'Não force e não tente contornar: faça commit ou desfaça a alteração na pasta do projeto na VM.\n',
  );
  const excerpt = stripRemotePrefix(out)
    .split(/\n/u)
    .filter((line) => DIRTY_VM_RE.test(line) || /error:/i.test(line))
    .slice(0, 8)
    .join('\n');
  if (excerpt) process.stderr.write(`${excerpt}\n`);
}

/**
 * gb13 — a plataforma vai junto, como RETRATO do disco.
 *
 * Primeiro PLANEJA todos os deps (compara árvores, sem escrever nada), depois
 * envia. Planejar antes é o que permite saber qual é o ÚLTIMO dep alterado: se
 * o cliente não tem nada a empurrar (o caso do Wagner — mudei o agente, o app
 * está igual), é esse último push que tem de disparar a compilação, senão a
 * alteração chega à VM e ninguém constrói.
 *
 * Devolve `{ changed, buildTriggered }`.
 */
async function publishPlatformDeps({ root, clientRepo, clientId, conf, env, clientWillPush }) {
  const declared = readDepIds(clientRepo, clientId);
  const onDesktop = declared.filter((depId) => existsSync(join(root, `mls-${depId}`, '.git')));
  if (!onDesktop.length) return { changed: [], buildTriggered: false };

  const ordered = dependencyOrder(onDesktop, (depId) => declaredDepsOf(root, depId));
  const plans = [];
  for (const depId of ordered) {
    const depName = `mls-${depId}`;
    const plan = planSnapshot({
      repo: join(root, depName),
      remote: VM_REMOTE,
      // remoteUrlFor, não sshUrl: com um perfil `--git-url` não existe SSH_HOST, e o retrato do dep
      // sairia apontando para `ssh://undefined/...`. O dep alterado é o caso COMUM (gb13), então o
      // https quebraria justamente quando serve para algo.
      url: remoteUrlFor(conf, depName),
      env,
      gitSync,
      ensureRemote: ensureVmRemote,
    });
    if (plan.status === 'error') fail(`[publishGit] retrato de ${depName} falhou: ${plan.reason}`);
    plans.push({ depId, depName, plan });
  }

  const changed = plans.filter((entry) => entry.plan.status === 'changed');
  const unchanged = plans.length - changed.length;
  process.stderr.write(`[publishGit] ${depsSummary(changed.map((e) => e.depId), unchanged)}\n`);
  if (!changed.length) return { changed: [], buildTriggered: false };

  const changedIds = changed.map((entry) => entry.depId);
  let triggerOutput = '';
  for (const [index, entry] of changed.entries()) {
    // Regra: todo retrato entra com `skip-build` — quem compila é UM push só.
    // Esse push é o do cliente quando ele existe; senão, o último retrato.
    const triggers = !clientWillPush && index === changed.length - 1;
    const sent = sendSnapshot({
      plan: entry.plan,
      remote: VM_REMOTE,
      env,
      pushOptions: triggers ? [`deps=${changedIds.join(',')}`] : ['skip-build'],
      // O push que dispara a build vai AO VIVO: é dele que sai o marcador que o
      // dev precisa ver. Os outros são retratos silenciosos. O gitSync vai
      // sempre — o update-ref do retrato usa-o mesmo no caminho ao vivo.
      gitSync,
      runPush: triggers ? (repo, args) => runGitLive(repo, args, env) : undefined,
    });
    const settled = triggers ? await sent : sent;
    if (settled.status === 'error') fail(`[publishGit] retrato de ${entry.depName} falhou: ${settled.reason}`);
    process.stderr.write(`[publishGit] retrato ${entry.depName} → VM${triggers ? ' (dispara a build)' : ''}\n`);
    if (triggers) triggerOutput = settled.out ?? '';
  }
  return { changed: changedIds, buildTriggered: Boolean(triggerOutput), triggerOutput };
}

async function main() {
  const { id, profile, command, align, autocommit, noDeps, installHelper, paste, flagConf } = parseArgs(process.argv.slice(2));
  if (command === 'login') {
    process.exit(await runLogin({ installHelper, paste }));
  }
  const projectName = `mls-${id}`;
  const repo = join(ROOT, projectName);

  if (command !== 'clone' && !existsSync(join(repo, '.git'))) {
    fail(`projeto não encontrado ou sem git: ${repo}`);
  }

  const conf = resolveProfileConf(profile, repo, flagConf);
  const url = remoteUrlFor(conf, projectName);
  const env = gitEnvFor(conf);
  if (conf.GIT_URL) {
    // Resolve (e renova) ANTES de começar: descobrir que a sessão morreu depois do fetch e do build
    // dos deps é gastar minutos para chegar num 401.
    const resolved = await resolvePushToken({});
    if (!resolved.ok) failAuth(resolved.reason);
    const { email, expiresAt } = tokenState(resolved.token);
    const origin = resolved.source === 'refreshed' ? ' (access renovado agora)'
      : resolved.source.startsWith('service') ? ' (token de serviço)' : '';
    process.stderr.write(`[publishGit] identidade: ${email || '(sem e-mail)'}${origin} — access até ${expiresAt}\n`);
  }

  if (command === 'clone') {
    await runClone({ dest: repo, url, env, id, profile });
    process.exit(0);
  }

  const branch = gitOut(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    fail(`publique a partir de main (branch atual: ${branch}).`);
  }
  removeLocalObj(repo);
  if (isDirty(repo)) {
    if (!autocommit) fail(DIRTY_LOCAL_MSG);
    autocommitDirty(repo);
    if (isDirty(repo)) fail('worktree local ainda suja após --autocommit.');
  }

  ensureVmRemote(repo, url);

  process.stderr.write(`[publishGit] ${projectName} → ${url} (${profile})\n`);
  const fetch = gitSync(repo, ['fetch', VM_REMOTE, '+refs/heads/main:refs/remotes/vm/main'], env);
  if (fetch.code !== 0) {
    // O 401 aparece aqui primeiro, não no push: o fetch é a primeira conversa com a VM.
    if (isAuthFailure(fetch.out)) failAuth(fetch.out);
    fail(`não consegui ler a main da VM:\n${fetch.out.trim()}`);
  }

  const localSha = gitOut(repo, ['rev-parse', 'HEAD']);
  const remoteRef = gitSync(repo, ['rev-parse', 'refs/remotes/vm/main']);
  if (remoteRef.code !== 0) {
    fail('a VM não tem branch main; rode gitReposSetup na VM antes.');
  }
  const remoteSha = remoteRef.stdout.trim();
  const rel = relation(repo, localSha, remoteSha);

  // gb13: a plataforma é avaliada ANTES da saída antecipada do cliente — o caso
  // de uso é justamente "mudei um agente no 102020 e o app não mudou".
  const { changed: changedDeps, buildTriggered, triggerOutput } = noDeps
    ? { changed: [], buildTriggered: false, triggerOutput: '' }
    : await publishPlatformDeps({
      root: ROOT, clientRepo: repo, clientId: id, conf, env, clientWillPush: rel !== 'same',
    });

  if (rel === 'same') {
    if (!buildTriggered) {
      process.stderr.write('[publishGit] já está na VM (HEAD = main remota) e nenhum dep mudou. Nada a publicar.\n');
      process.exit(0);
    }
    process.stderr.write('[publishGit] app inalterado; a build foi disparada pelo último retrato de plataforma.\n');
    reportBuildMarker(triggerOutput);
  }
  if (rel === 'behind' || rel === 'diverged') {
    fail('a VM tem commits que você não tem — faça pull/rebase.');
  }

  let forceLease = '';
  if (rel === 'unrelated') {
    printDiffSummary(repo, localSha, remoteSha);
    if (!align) {
      fail(
        '\n[publishGit] recusando force automático. Reexecute com --align e confirme o resumo acima.',
      );
    }
    const ok = await confirmAlign();
    if (!ok) fail('[publishGit] alinhamento cancelado.');
    forceLease = remoteSha;
    process.stderr.write('[publishGit] alinhando com --force-with-lease…\n');
  }
  const pushArgs = clientPushArgs({ remote: VM_REMOTE, changedDeps, forceLease });

  const pushed = await runGitLive(repo, pushArgs, env);
  const text = pushed.out;

  if (pushed.code !== 0) {
    // Autenticação antes de qualquer outro diagnóstico: um 401 lido como "VM suja" manda o
    // desenvolvedor mexer na worktree remota por um problema de token.
    if (isAuthFailure(text)) failAuth(text);
    if (DIRTY_VM_RE.test(text)) {
      explainDirtyVm(text);
      process.exit(1);
    }
    if (/non-fast-forward|failed to push some refs/i.test(text)) {
      fail('a VM tem commits que você não tem — faça pull/rebase.');
    }
    fail(`[publishGit] git push falhou (exit ${pushed.code}).`);
  }

  reportBuildMarker(text);
}

/**
 * Argumentos do push do cliente. O `-o deps=` e o `--force-with-lease` são
 * ORTOGONAIS: alinhar a história do app não pode apagar o recado que manda o
 * hook compilar a plataforma — era assim que um push com --align deixava a VM
 * com plataforma nova e sem compilar (o caso que o gb13 existe para evitar).
 */
export function clientPushArgs({ remote, changedDeps = [], forceLease = '' }) {
  const args = ['push'];
  if (changedDeps.length) args.push('-o', `deps=${changedDeps.join(',')}`);
  if (forceLease) args.push(`--force-with-lease=refs/heads/main:${forceLease}`);
  args.push(remote, 'main');
  return args;
}

/** Lê o marcador do hook no texto do push e sai com o código certo. */
function reportBuildMarker(text) {
  const okMatch = MARKER_OK.exec(text);
  if (okMatch) {
    process.stderr.write(`release ${okMatch[1]} ativa na VM\n`);
    process.exit(0);
  }
  if (MARKER_ERR.test(text)) {
    const excerpt = tscExcerpt(text);
    if (excerpt) process.stderr.write(`\n${excerpt}\n`);
    process.stderr.write('[publishGit] build vermelho na VM (push aceito; a release anterior segue no ar).\n');
    process.exit(1);
  }

  process.stderr.write(
    '[publishGit] push aceito, mas a VM não reportou build (hook gb2 ausente neste repo?).\n',
  );
  process.exit(1);
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
    fail(error instanceof Error ? error.stack || error.message : String(error));
  });
}
