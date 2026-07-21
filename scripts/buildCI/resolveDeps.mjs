// resolveDeps.mjs — fechamento transitivo das dependências de um projeto mls-*.
//
// SÓ baixa o que está DECLARADO no manifesto de cada projeto (decisão #4),
// na primeira destas fontes que existir:
//   1. mlsDep.json -> workspaceDependencies   (nome novo/preferido; mesmo
//      formato do config.json — decisão #15 do taskNewBuildCI.md)
//   2. config.json -> workspaceDependencies   (campo `commit` é IGNORADO:
//      baixamos sempre a última versão do main — decisão #5 do taskNewBuildCI.md)
//   3. packagelib.json -> dependencies "mls-\d+" com URL git+https (fallback)
//
// Nenhum projeto fixo/implícito é baixado. Os headers
// `/// <mls ... enhancement="_<id>_..."` do ALVO são apenas VALIDADOS ao
// final: enhancement que aponte para projeto fora do fechamento declarado
// derruba o build com erro (a correção é declarar a dependência no manifesto).
//
// Clona o que faltar na raiz do mls-base (git clone --depth 1, branch default),
// pulando pastas existentes, e caminha pelos manifestos dos clones até fechar
// o grafo (visited-set protege contra ciclos).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// URL default quando o manifesto não traz `repo` (ou a dep veio de um header
// de enhancement): montada com o orgName do l5/project.json do alvo.
function makeDefaultRepo(orgName) {
  return (id) => {
    if (!orgName) {
      throw new Error(`sem URL de repo para mls-${id} e sem orgName no l5/project.json do alvo para montar a default`);
    }
    return `https://github.com/${orgName}/mls-${id}.git`;
  };
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`JSON inválido em ${path}: ${error.message}`);
  }
}

// deps declaradas no manifesto do projeto: Map<id, repoUrl>
// Ordem: mlsDep.json (novo/preferido) -> config.json -> packagelib.json (fallback)
async function readManifestDeps(projectDir, defaultRepo) {
  const deps = new Map();

  for (const manifestName of ['mlsDep.json', 'config.json']) {
    const manifest = await readJsonIfExists(join(projectDir, manifestName));
    if (manifest?.workspaceDependencies) {
      for (const [id, dep] of Object.entries(manifest.workspaceDependencies)) {
        deps.set(id, dep.repo ?? defaultRepo(id)); // `dep.commit` ignorado de propósito
      }
      return { deps, source: manifestName };
    }
  }

  const packagelib = await readJsonIfExists(join(projectDir, 'packagelib.json'));
  if (packagelib?.dependencies) {
    for (const [name, spec] of Object.entries(packagelib.dependencies)) {
      const m = /^mls-(\d+)$/.exec(name);
      if (!m) continue;
      const url = /^git\+(https:\/\/.+?)(?:#.*)?$/.exec(spec)?.[1] ?? defaultRepo(m[1]);
      deps.set(m[1], url);
    }
    return { deps, source: 'packagelib.json' };
  }

  return { deps, source: undefined };
}

// refs de enhancement nos headers /// <mls dos .ts: Set<id>
// Formas aceitas: enhancement="_102027_/l2/enhancementLit" | "_100554_enhancementLit"
async function scanEnhancementRefs(projectDir, levels) {
  const ids = new Set();
  for (const level of levels) {
    const dir = join(projectDir, level);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const content = await readFile(join(entry.parentPath ?? entry.path, entry.name), 'utf8');
      const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? '';
      if (!firstLine.startsWith('/// <mls ')) continue;
      const ref = /enhancement="([^"]*)"/.exec(firstLine)?.[1];
      if (!ref || ref === '_blank') continue;
      const id = /^_(\d+)_/.exec(ref)?.[1];
      if (id) ids.add(id);
    }
  }
  return ids;
}

// Autenticação sob demanda (decisão #16): tenta clone anônimo primeiro (a
// maioria dos mls-* é pública); só usa GH_PAT como fallback se o repo for
// privado. Evita depender de um `git config --global insteadOf` que forçaria
// token em TODO clone, até nos públicos.
function withToken(repoUrl, token) {
  return repoUrl.replace(/^https:\/\//, `https://x-access-token:${token}@`);
}

// NUNCA usar publicError.message / privateError.message ou .cmd — o Node
// embute o argv completo (com o token na URL) nesses campos. Só stderr do
// próprio git chega aqui, e o git já redaciona a URL nas mensagens dele
// (ex.: "fatal: Authentication failed for 'https://github.com/...'", sem o
// token) — mesmo assim aplicamos um redact defensivo do valor do token.
function redact(text, token) {
  return token ? text.split(token).join('***') : text;
}

// Um clone que falha no meio do caminho pode deixar destDir parcialmente
// criado (ex.: .git vazio) — sem limpar, a próxima chamada veria
// existsSync(destDir) === true e pularia o clone silenciosamente.
async function cloneAttempt(args, destDir) {
  try {
    execFileSync('git', args, { stdio: 'pipe' });
  } catch (error) {
    await rm(destDir, { recursive: true, force: true });
    throw error;
  }
}

async function clone(repoUrl, destDir, log) {
  try {
    await cloneAttempt(['clone', '--depth', '1', repoUrl, destDir], destDir);
    return;
  } catch (publicError) {
    const token = process.env.GH_PAT;
    if (!token) {
      throw new Error(
        `clone anônimo falhou para ${repoUrl} (repo pode ser privado) e GH_PAT não está definido: ` +
        `${redact(publicError.stderr?.toString().trim() ?? '(sem stderr)', token)}`,
      );
    }
    log?.('deps', `clone anônimo falhou para ${repoUrl} — tentando com GH_PAT (repo privado)`);
    try {
      await cloneAttempt(['clone', '--depth', '1', withToken(repoUrl, token), destDir], destDir);
    } catch (privateError) {
      throw new Error(
        `clone com GH_PAT falhou para ${repoUrl}: ` +
        `${redact(privateError.stderr?.toString().trim() ?? '(sem stderr)', token)}`,
      );
    }
  }
}

// Resolve e materializa o fechamento de dependências do alvo.
// Retorna Map<id, {dir, repo, requestedBy, cloned}> incluindo o próprio alvo.
export async function resolveDeps({ root, targetId, orgName, levels, log }) {
  const defaultRepo = makeDefaultRepo(orgName);
  const projects = new Map();
  const queue = [{ id: targetId, repo: undefined, requestedBy: '(alvo)' }];

  while (queue.length > 0) {
    const { id, repo, requestedBy } = queue.shift();
    if (projects.has(id)) continue;

    const dir = resolve(root, `mls-${id}`);
    let cloned = false;
    if (!existsSync(dir)) {
      const url = repo ?? defaultRepo(id);
      log('deps', `clonando mls-${id} (pedido por ${requestedBy}) de ${url}`);
      await clone(url, dir, log);
      cloned = true;
    }
    projects.set(id, { dir, repo, requestedBy, cloned });

    const { deps, source } = await readManifestDeps(dir, defaultRepo);
    const declared = [...deps.keys()].join(' ') || '(nenhuma)';
    log('deps', `mls-${id}: manifesto=${source ?? '(ausente)'} deps=${declared}`);

    for (const [depId, depRepo] of deps) {
      if (depId !== id) queue.push({ id: depId, repo: depRepo, requestedBy: `mls-${id}` });
    }
  }

  // Validação dos enhancements do ALVO: projeto referenciado fora do
  // fechamento declarado é erro — nada é baixado implicitamente.
  const enhancementIds = await scanEnhancementRefs(resolve(root, `mls-${targetId}`), levels);
  const missing = [...enhancementIds].filter((depId) => !projects.has(depId));
  if (missing.length > 0) {
    throw new Error(
      `enhancement do mls-${targetId} referencia projeto(s) fora das dependências declaradas: ` +
      missing.map((d) => `mls-${d}`).join(', ') +
      ` — declare no config.json (workspaceDependencies) ou packagelib.json do mls-${targetId}`,
    );
  }

  return projects;
}
