// resolveDeps.mjs — transitive closure of a mls-* project's dependencies.
//
// ONLY downloads what's DECLARED in each project's manifest (decision #4),
// in the first of these sources that exists:
//   1. mlsDep.json -> workspaceDependencies   (new/preferred name; same
//      format as config.json — decision #15 of taskNewBuildCI.md)
//   2. config.json -> workspaceDependencies   (the `commit` field is IGNORED:
//      we always download the latest main — decision #5 of taskNewBuildCI.md)
//   3. package.json -> actionDependencies (if present, REPLACES dependencies —
//      decision #28) or dependencies, filtered to "mls-\d+" with a git+https
//      URL (fallback, decision #26 of taskNewBuildCI.md)
//   4. packagelib.json -> same format as package.json (fallback)
//
// No fixed/implicit project is ever downloaded. After the closure is built,
// the target's `/_<id>_/` imports and `/// <mls ... enhancement="_<id>_..."`
// headers are VALIDATED: a reference outside the declared closure fails the
// build (the fix is to declare the dependency in mlsDep.json).
//
// Clones whatever is missing at the mls-base root (git clone --depth 1,
// default branch), skipping existing folders, and walks the clones'
// manifests until the graph is closed (a visited-set guards against cycles).
//
// On the VM (`root === /data/mls-base`, or `armCloned: true`), a freshly
// cloned dep keeps `origin` (the customer VM pulls the lib from GitHub) and
// is armed (`vm-baseline` then setupRepo) so the next publishGit snapshot
// can land. A clone on the Mac is not armed — it is a GitHub checkout.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { armClonedDep, VM_ROOT } from '../runtime/gitReposSetup.mjs';

// Default URL when the manifest doesn't carry a `repo` (or the dep came from
// an enhancement header): built from the target's l5/project.json orgName.
function makeDefaultRepo(orgName) {
  return (id) => {
    if (!orgName) {
      throw new Error(`no repo URL for mls-${id} and no orgName in the target's l5/project.json to build the default`);
    }
    return `https://github.com/${orgName}/mls-${id}.git`;
  };
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON at ${path}: ${error.message}`);
  }
}

// dependencies declared "mls-\d+" -> repoUrl, filtered from a plain
// { name: gitSpec } dependencies-style object (package.json / packagelib.json)
function readGitDeps(depsObject, defaultRepo) {
  const deps = new Map();
  for (const [name, spec] of Object.entries(depsObject ?? {})) {
    const m = /^mls-(\d+)$/.exec(name);
    if (!m) continue;
    const url = /^git\+(https:\/\/.+?)(?:#.*)?$/.exec(spec)?.[1] ?? defaultRepo(m[1]);
    deps.set(m[1], url);
  }
  return deps;
}

// workspaceDependencies is either:
//   - string[] of project ids (l5/config.json and mlsDep.json)
//   - { [id]: { repo?, commit? } } (the original buildCI object form; `commit` is ignored)
function depsFromWorkspaceDependencies(workspaceDependencies, defaultRepo) {
  const deps = new Map();
  if (Array.isArray(workspaceDependencies)) {
    for (const item of workspaceDependencies) {
      const id = String(item ?? '').trim();
      if (/^\d+$/.test(id)) deps.set(id, defaultRepo(id));
    }
    return deps;
  }
  if (workspaceDependencies && typeof workspaceDependencies === 'object') {
    for (const [id, dep] of Object.entries(workspaceDependencies)) {
      if (!/^\d+$/.test(id)) continue;
      const repo = dep && typeof dep === 'object' ? (dep.repo ?? defaultRepo(id)) : defaultRepo(id);
      deps.set(id, repo);
    }
  }
  return deps;
}

// deps declared in the project's manifest: Map<id, repoUrl>
// Order: mlsDep.json (new/preferred) -> config.json -> package.json ->
// packagelib.json (fallback, decision #26 of taskNewBuildCI.md)
export async function readManifestDeps(projectDir, defaultRepo) {
  for (const manifestName of ['mlsDep.json', 'config.json']) {
    const manifest = await readJsonIfExists(join(projectDir, manifestName));
    if (manifest?.workspaceDependencies) {
      return { deps: depsFromWorkspaceDependencies(manifest.workspaceDependencies, defaultRepo), source: manifestName };
    }
  }

  for (const manifestName of ['package.json', 'packagelib.json']) {
    const manifest = await readJsonIfExists(join(projectDir, manifestName));
    if (!manifest) continue;
    // actionDependencies (decision #28) REPLACES dependencies when present —
    // a CI-only override so `npm install` (which ignores unknown fields)
    // keeps using `dependencies` for whatever it normally installs, while
    // buildCI's closure comes from actionDependencies instead.
    if (manifest.actionDependencies) {
      const deps = readGitDeps(manifest.actionDependencies, defaultRepo);
      if (deps.size > 0) return { deps, source: `${manifestName} (actionDependencies)` };
    }
    if (manifest.dependencies) {
      const deps = readGitDeps(manifest.dependencies, defaultRepo);
      if (deps.size > 0) return { deps, source: manifestName };
    }
  }

  return { deps: new Map(), source: undefined };
}

// `/_(\d+)_/` specifiers in the target's sources (imports, fileReference, …).
// First hit per id is kept so the finding names one file instead of 300 tsc errors.
// O guard varre exatamente o que o passe de compilação varre. Um `.test.ts` ou
// um `nodejs*` NÃO é compilado (createTsconfig.COMPILE_EXCLUDES), então uma
// dependência que só aparece lá não pode reprovar nada. Medido em 03/09 na
// lima: o mls-102020 abortava com 9 achados, 8 deles vindos de `.test.ts` e
// fixtures — inclusive um projeto de id "1".
// Um import DENTRO de um template literal não é um import — é texto. As skills
// dos agentes são template literals cheios de exemplos de código
// (`import "/_100111_/l2/user/userProfileOrganism.js";` no overview do aura, de
// um projeto que nem existe), e eles abortavam o build do mls-102020.
//
// Errar por FALTA aqui é seguro: quem manda é o tsc, e uma dependência de
// verdade que escape ao scan reaparece como erro de compilação. Errar por SOBRA
// não é: aborta antes de o tsc rodar.
export function stripTemplateLiterals(source) {
  let out = '';
  let inTemplate = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '\\') {
      if (!inTemplate) out += source.slice(i, i + 2);
      i += 1;
      continue;
    }
    if (char === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (!inTemplate) out += char;
  }
  return out;
}

function isExcludedFromCompile(relPath, skipDirNames = []) {
  const name = relPath.split('/').pop() ?? '';
  const segments = relPath.split('/');
  return name.endsWith('.test.ts')
    || name.endsWith('.spec.ts')
    || segments.some((segment) => segment.startsWith('nodejs'))
    || (skipDirNames.length > 0 && segments.some((segment) => skipDirNames.includes(segment)));
}

// `/_<id>_/` só conta quando é ESPECIFICADOR DE MÓDULO — o que o tsc de facto
// resolve. Antes bastava a sequência aparecer no texto, e um comentário
// ("e.g. `/_102048_/l2/designSystem.js`") ou uma URL montada em runtime
// (`/_100554_/l2/enhancementStyle.js` no libModel) viravam "dependência não
// declarada". Efeito medido em 03/09: o mls-102029 não compilava sozinho por
// dois achados que não existiam — e o publish tradicional engolia isso em
// silêncio ("previous obj stays"), então ninguém via.
//
// Este scan só ALIMENTA a checagem de dep não declarada; o fecho que se clona e
// se compila vem do manifesto. Estreitá-lo remove falso positivo sem encolher
// nada.
const IMPORT_SPECIFIER_RES = [
  /\bfrom\s*['"`]\/_(\d+)_\//gu,          // import x from '/_102020_/…'
  /\bimport\s*\(\s*['"`]\/_(\d+)_\//gu,   // import('/_102020_/…')
  /\bimport\s+['"`]\/_(\d+)_\//gu,        // import '/_102020_/…'  (efeito colateral)
  /\brequire\s*\(\s*['"`]\/_(\d+)_\//gu,
];

export async function scanImportRefs(projectDir, levels, { skipDirNames = [] } = {}) {
  const firstHit = new Map();
  for (const level of levels) {
    const dir = join(projectDir, level);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const abs = join(entry.parentPath ?? entry.path, entry.name);
      const rel = abs.slice(projectDir.length + 1).split('\\').join('/');
      if (isExcludedFromCompile(rel, skipDirNames)) continue;
      const content = stripTemplateLiterals(await readFile(abs, 'utf8'));
      for (const re of IMPORT_SPECIFIER_RES) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content))) {
          if (!firstHit.has(match[1])) firstHit.set(match[1], rel);
        }
      }
    }
  }
  return firstHit;
}

// enhancement refs in the .ts /// <mls headers: Set<id>
// Accepted forms: enhancement="_102027_/l2/enhancementLit" | "_100554_enhancementLit"
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

// On-demand authentication (decision #16): tries an anonymous clone first
// (most mls-* are public); only uses GH_PAT as a fallback if the repo is
// private. Avoids depending on a `git config --global insteadOf` that would
// force a token on EVERY clone, even public ones.
function withToken(repoUrl, token) {
  return repoUrl.replace(/^https:\/\//, `https://x-access-token:${token}@`);
}

// NEVER use publicError.message / privateError.message or .cmd — Node embeds
// the full argv (with the token in the URL) in those fields. Only git's own
// stderr reaches here, and git already redacts the URL in its own messages
// (e.g. "fatal: Authentication failed for 'https://github.com/...'", without
// the token) — we still apply a defensive redact of the token value anyway.
function redact(text, token) {
  return token ? text.split(token).join('***') : text;
}

// A clone that fails partway through can leave destDir partially created
// (e.g. an empty .git) — without cleaning it up, the next call would see
// existsSync(destDir) === true and silently skip the clone.
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
        `anonymous clone failed for ${repoUrl} (repo might be private) and GH_PAT isn't set: ` +
        `${redact(publicError.stderr?.toString().trim() ?? '(no stderr)', token)}`,
      );
    }
    log?.('deps', `anonymous clone failed for ${repoUrl} — retrying with GH_PAT (private repo)`);
    try {
      await cloneAttempt(['clone', '--depth', '1', withToken(repoUrl, token), destDir], destDir);
    } catch (privateError) {
      throw new Error(
        `clone with GH_PAT failed for ${repoUrl}: ` +
        `${redact(privateError.stderr?.toString().trim() ?? '(no stderr)', token)}`,
      );
    }
  }
}

// Resolves and materializes the target's dependency closure.
// Returns Map<id, {dir, repo, requestedBy, cloned}> including the target itself.
export async function resolveDeps({ root, targetId, orgName, levels, log, armCloned }) {
  const defaultRepo = makeDefaultRepo(orgName);
  const projects = new Map();
  const queue = [{ id: targetId, repo: undefined, requestedBy: '(target)' }];
  let targetManifestSource;

  while (queue.length > 0) {
    const { id, repo, requestedBy } = queue.shift();
    if (projects.has(id)) continue;

    const dir = resolve(root, `mls-${id}`);
    let cloned = false;
    if (!existsSync(dir)) {
      const url = repo ?? defaultRepo(id);
      log('deps', `cloning mls-${id} (requested by ${requestedBy}) from ${url}`);
      await clone(url, dir, log);
      cloned = true;
      // Só na VM: cria vm-baseline e arma, conservando origin. Sem o
      // baseline o guard recusaria (`skipped-external-remote`) — o guard
      // não é afrouxado. No Mac o clone continua checkout do GitHub.
      const shouldArm = armCloned === true || (armCloned !== false && root === VM_ROOT);
      if (shouldArm) {
        try {
          const armed = armClonedDep(dir);
          if (armed.status === 'skipped-external-remote') {
            throw new Error(`mls-${id}: gitReposSetup recusou armar (remote sem vm-baseline)`);
          }
          log('deps', `mls-${id}: armed for retrato (origin kept, receive.advertisePushOptions)`);
        } catch (error) {
          await rm(dir, { recursive: true, force: true });
          throw error;
        }
      }
    }
    projects.set(id, { dir, repo, requestedBy, cloned });

    const { deps, source } = await readManifestDeps(dir, defaultRepo);
    if (id === targetId) targetManifestSource = source;
    const declared = [...deps.keys()].join(' ') || '(none)';
    log('deps', `mls-${id}: manifest=${source ?? '(none)'} deps=${declared}`);

    for (const [depId, depRepo] of deps) {
      if (depId !== id) queue.push({ id: depId, repo: depRepo, requestedBy: `mls-${id}` });
    }
  }

  const targetDir = resolve(root, `mls-${targetId}`);

  // Imports `/_<id>_/` outside the declared closure fail here, with the file
  // that referenced them — not 300 tsc errors later.
  const importHits = await scanImportRefs(targetDir, levels);
  const undeclared = [...importHits.entries()].filter(([depId]) => !projects.has(depId));
  if (undeclared.length > 0) {
    throw new Error(
      undeclared
        .map(([depId, rel]) => `dependência não declarada: ${depId} (importada por ${rel}) — declare em mlsDep.json`)
        .join('\n'),
    );
  }

  // Validate the TARGET's enhancements: a project referenced outside the
  // declared closure is an error — nothing is downloaded implicitly.
  const enhancementIds = await scanEnhancementRefs(targetDir, levels);
  const missing = [...enhancementIds].filter((depId) => !projects.has(depId));
  if (missing.length > 0) {
    // Point at whichever manifest the target actually uses — not a generic
    // "config.json or package.json" that may not match reality for this
    // project (e.g. it only has package.json, no config.json at all).
    const manifestHint = targetManifestSource
      ? `mls-${targetId}'s ${targetManifestSource}`
      : `mls-${targetId}'s mlsDep.json, config.json, package.json, or packagelib.json`;
    throw new Error(
      `mls-${targetId}'s enhancement references project(s) outside the declared dependencies: ` +
      missing.map((d) => `mls-${d}`).join(', ') +
      ` — declare it in ${manifestHint}`,
    );
  }

  return projects;
}
