// resolveDeps.mjs — transitive closure of a mls-* project's dependencies.
//
// ONLY downloads what's DECLARED in each project's manifest (decision #4),
// in the first of these sources that exists:
//   1. mlsDep.json -> workspaceDependencies   (new/preferred name; same
//      format as config.json — decision #15 of taskNewBuildCI.md)
//   2. config.json -> workspaceDependencies   (the `commit` field is IGNORED:
//      we always download the latest main — decision #5 of taskNewBuildCI.md)
//   3. package.json -> dependencies "mls-\d+" with a git+https URL (fallback,
//      decision #26 of taskNewBuildCI.md)
//   4. packagelib.json -> same format as package.json (fallback)
//
// No fixed/implicit project is ever downloaded. The target's
// `/// <mls ... enhancement="_<id>_..."` headers are only VALIDATED at the
// end: an enhancement pointing to a project outside the declared closure
// fails the build with an error (the fix is to declare the dependency in
// the manifest).
//
// Clones whatever is missing at the mls-base root (git clone --depth 1,
// default branch), skipping existing folders, and walks the clones'
// manifests until the graph is closed (a visited-set guards against cycles).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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

// dependencies declared "mls-\d+" -> repoUrl, filtered from a
// dependencies-style manifest (package.json / packagelib.json)
function readGitDeps(manifest, defaultRepo) {
  const deps = new Map();
  for (const [name, spec] of Object.entries(manifest?.dependencies ?? {})) {
    const m = /^mls-(\d+)$/.exec(name);
    if (!m) continue;
    const url = /^git\+(https:\/\/.+?)(?:#.*)?$/.exec(spec)?.[1] ?? defaultRepo(m[1]);
    deps.set(m[1], url);
  }
  return deps;
}

// deps declared in the project's manifest: Map<id, repoUrl>
// Order: mlsDep.json (new/preferred) -> config.json -> package.json ->
// packagelib.json (fallback, decision #26 of taskNewBuildCI.md)
async function readManifestDeps(projectDir, defaultRepo) {
  for (const manifestName of ['mlsDep.json', 'config.json']) {
    const manifest = await readJsonIfExists(join(projectDir, manifestName));
    if (manifest?.workspaceDependencies) {
      const deps = new Map();
      for (const [id, dep] of Object.entries(manifest.workspaceDependencies)) {
        deps.set(id, dep.repo ?? defaultRepo(id)); // `dep.commit` intentionally ignored
      }
      return { deps, source: manifestName };
    }
  }

  for (const manifestName of ['package.json', 'packagelib.json']) {
    const manifest = await readJsonIfExists(join(projectDir, manifestName));
    if (manifest?.dependencies) {
      const deps = readGitDeps(manifest, defaultRepo);
      if (deps.size > 0) return { deps, source: manifestName };
    }
  }

  return { deps: new Map(), source: undefined };
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
export async function resolveDeps({ root, targetId, orgName, levels, log }) {
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

  // Validate the TARGET's enhancements: a project referenced outside the
  // declared closure is an error — nothing is downloaded implicitly.
  const enhancementIds = await scanEnhancementRefs(resolve(root, `mls-${targetId}`), levels);
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
