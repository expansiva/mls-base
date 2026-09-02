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
// Usage (any cwd; ROOT is this file's mls-base):
//   node scripts/publishGit.mjs <projetoId|mls-<id>> <local|remote> [--align]
//   pnpm publishGit 102044 local

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

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
};

const MARKER_OK = /##gitBackend build=ok release=(\d{14}) project=mls-\d+##/;
const MARKER_ERR = /##gitBackend build=error\b/;
const DIRTY_VM_RE =
  /working directory has unstaged changes|uncommitted changes|denyCurrentBranch|refusing to update/i;
const OBJ_IGNORE = '/obj/';
const OBJ_COMMIT_MSG = 'chore: remove obj/ (build é da VM)';

function usage() {
  return [
    'usage: node scripts/publishGit.mjs <projetoId|mls-<id>> <local|remote> [--align]',
    '       [--ssh-host=…] [--ssh-config=…] [--remote-base=…] [--ssh-cert=…]',
    '  local  — PUBLISH_LOCAL_* from mls-base/.env (same as publishMlsBase.py)',
    '  remote — CLI flags, else servers/remote.conf (same chain as the full publish)',
    '  --align — first-time unrelated histories: --force-with-lease after a diff + confirm',
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

function loadRemoteConf(projectDir, flagConf) {
  const conf = { ...flagConf };
  if (conf.SSH_HOST) return conf;
  const confPath = resolveConfPath('remote', projectDir);
  if (!confPath) {
    fail(
      `Server config not found for profile 'remote'. Pass --ssh-host=… or create mls-base/servers/remote.conf ` +
        `(same keys as publishMlsBase.py: SSH_HOST, SSH_CONFIG, REMOTE_BASE).`,
    );
  }
  return { ...parseKeyValueFile(confPath), ...conf };
}

function parseArgs(argv) {
  const positional = [];
  const flagConf = {};
  let align = false;
  for (const arg of argv) {
    if (arg === '--align') {
      align = true;
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
  const projectRaw = positional[0] || '';
  const profile = positional[1] || '';
  const idMatch = /^(?:mls-)?(\d+)$/u.exec(projectRaw.trim());
  if (!idMatch || (profile !== 'local' && profile !== 'remote')) {
    fail(usage());
  }
  if (positional.length > 2) fail(usage());
  return { id: idMatch[1], profile, align, flagConf };
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

function isDirty(repo) {
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

async function main() {
  const { id, profile, align, flagConf } = parseArgs(process.argv.slice(2));
  const projectName = `mls-${id}`;
  const repo = join(ROOT, projectName);
  if (!existsSync(join(repo, '.git'))) {
    fail(`projeto não encontrado ou sem git: ${repo}`);
  }

  const conf = profile === 'local' ? loadLocalConf() : loadRemoteConf(repo, flagConf);
  if (conf.MULTIPASS_INSTANCE && !conf.SSH_HOST) {
    fail('git publish precisa de SSH_HOST; Multipass sozinho não serve de remote git.');
  }
  const url = sshUrl(conf, projectName);
  const env = gitEnv(conf);

  const branch = gitOut(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    fail(`publique a partir de main (branch atual: ${branch}).`);
  }
  removeLocalObj(repo);
  if (isDirty(repo)) {
    fail('worktree local suja: commit antes de publicar (o script não commita por conta própria).');
  }

  ensureVmRemote(repo, url);

  process.stderr.write(`[publishGit] ${projectName} → ${url} (${profile})\n`);
  const fetch = gitSync(repo, ['fetch', VM_REMOTE, '+refs/heads/main:refs/remotes/vm/main'], env);
  if (fetch.code !== 0) {
    fail(`não consegui ler a main da VM:\n${fetch.out.trim()}`);
  }

  const localSha = gitOut(repo, ['rev-parse', 'HEAD']);
  const remoteRef = gitSync(repo, ['rev-parse', 'refs/remotes/vm/main']);
  if (remoteRef.code !== 0) {
    fail('a VM não tem branch main; rode gitReposSetup na VM antes.');
  }
  const remoteSha = remoteRef.stdout.trim();
  const rel = relation(repo, localSha, remoteSha);

  if (rel === 'same') {
    process.stderr.write('[publishGit] já está na VM (HEAD = main remota). Nada a publicar.\n');
    process.exit(0);
  }
  if (rel === 'behind' || rel === 'diverged') {
    fail('a VM tem commits que você não tem — faça pull/rebase.');
  }

  let pushArgs = ['push', VM_REMOTE, 'main'];
  if (rel === 'unrelated') {
    printDiffSummary(repo, localSha, remoteSha);
    if (!align) {
      fail(
        '\n[publishGit] recusando force automático. Reexecute com --align e confirme o resumo acima.',
      );
    }
    const ok = await confirmAlign();
    if (!ok) fail('[publishGit] alinhamento cancelado.');
    pushArgs = ['push', `--force-with-lease=refs/heads/main:${remoteSha}`, VM_REMOTE, 'main'];
    process.stderr.write('[publishGit] alinhando com --force-with-lease…\n');
  }

  const pushed = await runGitLive(repo, pushArgs, env);
  const text = pushed.out;

  if (pushed.code !== 0) {
    if (DIRTY_VM_RE.test(text)) {
      explainDirtyVm(text);
      process.exit(1);
    }
    if (/non-fast-forward|failed to push some refs/i.test(text)) {
      fail('a VM tem commits que você não tem — faça pull/rebase.');
    }
    fail(`[publishGit] git push falhou (exit ${pushed.code}).`);
  }

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

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
