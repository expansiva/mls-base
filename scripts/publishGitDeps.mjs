// publishGitDeps.mjs — gb13: o publish leva o desktop inteiro (cliente + plataforma).
//
// Caso de uso do Wagner: alterar um agente no 102020 ou uma tela, e testar na VM
// SEM commit, sem GitHub, sem Action.
//
// Duas classes, dois mecanismos:
//   • app cliente  = autocommit (gb7) — a história da VM é a história real do projeto;
//   • plataforma   = RETRATO do disco — um commit técnico do worktree, sem obj/,
//     num ref local `refs/heads/vm-snapshot`, empurrado para a `main` da VM.
//     A branch local, o índice e a história do GitHub ficam INTOCADOS.
//
// O retrato é parentado no commit que a VM tem AGORA (lido pelo fetch), então o
// push é sempre fast-forward — nunca precisa de `--align`, nunca força. É isso
// que permite chamar a plataforma de "retrato": a VM recebe o disco do Wagner,
// não a história dele.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SNAPSHOT_REF = 'refs/heads/vm-snapshot';

/**
 * Ids de que o cliente depende, sem o próprio cliente, na ordem declarada.
 * A fonte é o mlsDep.json (o mesmo fecho que o host usa para carregar agentes).
 */
export function readDepIds(clientRepo, clientId) {
  const path = join(clientRepo, 'mlsDep.json');
  if (!existsSync(path)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.workspaceDependencies) ? parsed.workspaceDependencies : [];
  return [...new Set(list.map(String).filter((id) => /^\d+$/u.test(id) && id !== String(clientId)))];
}

/** Dependências declaradas de um projeto de plataforma (package.json actionDependencies). */
export function declaredDepsOf(root, id) {
  const path = join(root, `mls-${id}`, 'package.json');
  if (!existsSync(path)) return [];
  try {
    const deps = JSON.parse(readFileSync(path, 'utf8'))?.actionDependencies ?? {};
    return Object.keys(deps)
      .map((name) => /^mls-(\d+)$/u.exec(name)?.[1])
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Ordem de compilação: dependência antes de dependente. Ciclo não trava — o que
 * sobra sai na ordem de entrada (o buildCI resolve o fecho de qualquer forma; a
 * ordem aqui só evita recompilar à toa).
 */
export function dependencyOrder(ids, depsOf) {
  const wanted = new Set(ids.map(String));
  const done = new Set();
  const out = [];
  const visit = (id, seen) => {
    if (done.has(id) || seen.has(id)) return;
    seen.add(id);
    for (const dep of depsOf(id)) if (wanted.has(String(dep))) visit(String(dep), seen);
    seen.delete(id);
    if (!done.has(id)) {
      done.add(id);
      out.push(id);
    }
  };
  for (const id of ids.map(String)) visit(id, new Set());
  return out;
}

function git(repo, args, env) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function gitOut(repo, args, env) {
  const result = git(repo, args, env);
  return result.code === 0 ? result.out : '';
}

/**
 * Árvore do worktree AGORA (inclusive não commitado), sem obj/, num índice
 * temporário — o índice real do Wagner não é tocado.
 *
 * `git add -A` respeita o .gitignore do repo (que já cobre /obj/ — ensureObjGitignore
 * do publishGit). O `rm --cached` a seguir é cinto e suspensórios: se um obj/ tiver
 * sido versionado alguma vez, ele NÃO vai para a VM.
 */
export function snapshotTree(repo, env = process.env) {
  const dir = mkdtempSync(join(tmpdir(), 'collab-snap-'));
  const indexFile = join(dir, 'index');
  const snapEnv = { ...env, GIT_INDEX_FILE: indexFile };
  try {
    const read = git(repo, ['read-tree', '--empty'], snapEnv);
    if (read.code !== 0) return { ok: false, tree: '', reason: read.out };
    const add = git(repo, ['add', '-A', '--', '.'], snapEnv);
    if (add.code !== 0) return { ok: false, tree: '', reason: add.out };
    git(repo, ['rm', '-r', '--cached', '--ignore-unmatch', '-q', '--', 'obj'], snapEnv);
    const write = git(repo, ['write-tree'], snapEnv);
    if (write.code !== 0) return { ok: false, tree: '', reason: write.out };
    return { ok: true, tree: write.out, reason: '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `snapshot <sha7 do HEAD local>[+dirty]: <assunto>` — proveniência do retrato. */
export function snapshotMessage(headSha, dirty, subject) {
  const short = String(headSha || '').slice(0, 7) || 'sem-head';
  const suffix = dirty ? '+dirty' : '';
  const text = String(subject || '').split('\n')[0].trim() || '(sem assunto)';
  return `snapshot ${short}${suffix}: ${text}`;
}

/**
 * Empurra o retrato de um projeto de plataforma. Devolve
 * `{ status: 'pushed' | 'unchanged' | 'error', reason }`.
 *
 * `unchanged` compara ÁRVORES, não commits: dois retratos do mesmo disco dão a
 * mesma árvore mesmo com mensagens diferentes, então rodar duas vezes seguidas
 * é no-op de verdade.
 */
export function planSnapshot({ repo, remote, url, env, gitSync, ensureRemote }) {
  ensureRemote(repo, url);
  const fetched = gitSync(repo, ['fetch', remote, `+refs/heads/main:refs/remotes/${remote}/main`], env);
  if (fetched.code !== 0) return { status: 'error', reason: `fetch falhou: ${fetched.out.trim()}` };

  const remoteSha = gitOut(repo, ['rev-parse', `refs/remotes/${remote}/main`], env);
  if (!remoteSha) return { status: 'error', reason: 'a VM não tem main (rode gitReposSetup)' };

  const snap = snapshotTree(repo, env);
  if (!snap.ok) return { status: 'error', reason: `write-tree falhou: ${snap.reason}` };

  // Compara ÁRVORES, não commits: dois retratos do mesmo disco dão a mesma
  // árvore mesmo com mensagens diferentes, então rodar duas vezes é no-op real.
  const remoteTree = gitOut(repo, ['rev-parse', `${remoteSha}^{tree}`], env);
  if (remoteTree && remoteTree === snap.tree) return { status: 'unchanged', reason: '', repo, remoteSha, tree: snap.tree };

  return { status: 'changed', reason: '', repo, remoteSha, tree: snap.tree };
}

/**
 * Escreve o commit do retrato e empurra. Com `runPush` (async) o push vai ao
 * vivo e o retorno é uma Promise que traz também `out` — é assim que o push que
 * dispara a build entrega o marcador do hook ao terminal do dev.
 */
export function sendSnapshot({ plan, remote, env, pushOptions = [], gitSync, runPush }) {
  const { repo, remoteSha, tree } = plan;
  const headSha = gitOut(repo, ['rev-parse', 'HEAD'], env);
  const subject = gitOut(repo, ['log', '-1', '--pretty=%s'], env);
  const dirty = git(repo, ['status', '--porcelain'], env).out.length > 0;
  const message = snapshotMessage(headSha, dirty, subject);

  // Parent = o que a VM tem agora ⇒ o push é fast-forward, sempre. É isto que
  // dispensa `--align` para a plataforma: a VM recebe o disco, não a história.
  const commit = gitOut(repo, ['commit-tree', tree, '-p', remoteSha, '-m', message], env);
  if (!commit) return { status: 'error', reason: 'commit-tree falhou' };

  const updated = gitSync(repo, ['update-ref', SNAPSHOT_REF, commit], env);
  if (updated.code !== 0) return { status: 'error', reason: `update-ref falhou: ${updated.out.trim()}` };

  const args = ['push'];
  for (const option of pushOptions) args.push('-o', option);
  args.push(remote, `${SNAPSHOT_REF}:refs/heads/main`);
  if (runPush) {
    return runPush(repo, args).then((pushed) => (pushed.code !== 0
      ? { status: 'error', reason: String(pushed.out ?? '').trim(), out: pushed.out ?? '' }
      : { status: 'pushed', reason: '', out: pushed.out ?? '' }));
  }
  const pushed = gitSync(repo, args, env);
  if (pushed.code !== 0) return { status: 'error', reason: pushed.out.trim() };
  return { status: 'pushed', reason: '', out: pushed.out ?? '' };
}

/** `deps alterados: 102020 102029 | inalterados: 5` */
export function depsSummary(changed, unchanged) {
  const left = changed.length ? `deps alterados: ${changed.join(' ')}` : 'deps alterados: nenhum';
  return `${left} | inalterados: ${unchanged}`;
}
