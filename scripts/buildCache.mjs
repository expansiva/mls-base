// Cache of a clean lib's typeCheck report and pre-rewrite emit tree.
// Emit key: that lib's HEAD, the TypeScript version, the compiler options
// and the base tsconfig. Check key: the same plus the policy; a hit also
// requires every project that check loaded to be clean at the recorded HEAD.
// The release app and a dirty tree never hit or fill the cache.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readTypeCheckPolicy } from './typeCheckPolicy.mjs';

let writeSeq = 0;

export function cacheDisabled(env = process.env) {
  return env.COLLAB_BUILD_CACHE === '0';
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}

/** Hash of compilerOptions without `paths` and `outDir` (those vary per run). */
export function hashCompilerOptions(compilerOptions) {
  const copy = { ...compilerOptions };
  delete copy.paths;
  delete copy.outDir;
  return sha256Text(JSON.stringify(sortValue(copy)));
}

function materialHash(parts) {
  const full = sha256Text(JSON.stringify(parts));
  return { full, short: full.slice(0, 12) };
}

/**
 * @param {{ head: string, typescriptVersion: string, compilerOptionsHash: string, baseTsconfigHash: string }} parts
 */
export function emitCacheKey(parts) {
  return materialHash({
    head: parts.head,
    typescriptVersion: parts.typescriptVersion,
    compilerOptionsHash: parts.compilerOptionsHash,
    baseTsconfigHash: parts.baseTsconfigHash,
  });
}

/**
 * @param {{ head: string, typescriptVersion: string, compilerOptionsHash: string, baseTsconfigHash: string, policyStatus: string }} parts
 */
export function checkBaseKey(parts) {
  return materialHash({
    head: parts.head,
    typescriptVersion: parts.typescriptVersion,
    compilerOptionsHash: parts.compilerOptionsHash,
    baseTsconfigHash: parts.baseTsconfigHash,
    policyStatus: parts.policyStatus,
  });
}

function git(dir, args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** `null` when the directory is not a git checkout with HEAD. */
export function gitHead(dir) {
  const result = git(dir, ['rev-parse', '--verify', 'HEAD']);
  if (result.status !== 0) return null;
  const head = (result.stdout ?? '').trim();
  return head || null;
}

/** Porcelain of this directory. `null` when git cannot answer. */
export function gitPorcelain(dir) {
  const result = git(dir, ['status', '--porcelain', '--', '.']);
  if (result.status !== 0) return null;
  return (result.stdout ?? '').trim();
}

/**
 * @param {{ projectId: string, clientId: string, head: string | null, porcelain: string | null }} args
 */
export function shouldUseCache(args) {
  if (args.projectId === args.clientId) return false;
  if (!args.head || args.porcelain == null || args.porcelain !== '') return false;
  return true;
}

function emitDir(cacheRoot, id, key) {
  return join(cacheRoot, 'emit', String(id), key);
}

function checkLibDir(cacheRoot, id) {
  return join(cacheRoot, 'check', String(id));
}

/** s1 stored one folder per key at the cache root. Those entries are not read. */
export function legacyCacheReason(cacheRoot) {
  if (!existsSync(cacheRoot)) return null;
  let names = [];
  try {
    names = readdirSync(cacheRoot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `legacy layout unreadable: ${message}`;
  }
  const legacy = names.filter((name) => /^[a-f0-9]{64}$/u.test(name));
  if (legacy.length === 0) return null;
  return `legacy layout (${legacy.length} entr${legacy.length === 1 ? 'y' : 'ies'})`;
}

/**
 * @param {string} dir
 * @returns {Promise<{ ok: true, report: Record<string, unknown>, deps: { id: string, head: string }[] } | { ok: false, reason: string }>}
 */
async function readCheckEntry(dir) {
  if (!existsSync(join(dir, 'ok'))) return { ok: false, reason: 'incomplete: missing ok' };
  const reportPath = join(dir, 'report.json');
  const depsPath = join(dir, 'deps.json');
  if (!existsSync(reportPath)) return { ok: false, reason: 'incomplete: missing report' };
  if (!existsSync(depsPath)) return { ok: false, reason: 'incomplete: missing deps' };
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const deps = JSON.parse(await readFile(depsPath, 'utf8'));
    if (
      report == null
      || typeof report.reportLine !== 'string'
      || typeof report.marker !== 'string'
      || !Array.isArray(report.excerpt)
    ) {
      return { ok: false, reason: 'incomplete: report fields' };
    }
    if (!Array.isArray(deps) || deps.some((dep) => typeof dep?.id !== 'string' || typeof dep?.head !== 'string')) {
      return { ok: false, reason: 'incomplete: deps fields' };
    }
    return { ok: true, report, deps };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `unreadable: ${message}` };
  }
}

/**
 * @param {(id: string) => { head: string | null, porcelain: string | null }} lookup
 * @param {{ id: string, head: string }[]} deps
 */
export function checkDepsReason(deps, lookup) {
  for (const dep of deps) {
    let now;
    try {
      now = lookup(dep.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `dependency mls-${dep.id} unreadable: ${message}`;
    }
    if (!now || now.porcelain == null || !now.head) return `dependency mls-${dep.id} has no HEAD`;
    if (now.porcelain !== '') return `dependency mls-${dep.id} is dirty`;
    if (now.head !== dep.head) return `dependency mls-${dep.id} head changed`;
  }
  return null;
}

/**
 * @param {string} cacheRoot
 * @param {string} id
 * @param {string} key
 */
export async function loadEmit(cacheRoot, id, key) {
  const dir = emitDir(cacheRoot, id, key);
  if (!existsSync(dir)) return { hit: false, reason: 'miss' };
  try {
    if (!existsSync(join(dir, 'ok'))) return { hit: false, reason: 'incomplete: missing ok' };
    const tree = join(dir, 'tree');
    if (!existsSync(tree)) return { hit: false, reason: 'incomplete: missing tree' };
    return { hit: true, tree };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { hit: false, reason: `unreadable: ${message}` };
  }
}

/**
 * @param {string} cacheRoot
 * @param {string} id
 * @param {string} baseKey
 * @param {(id: string) => { head: string | null, porcelain: string | null }} lookup
 */
export async function loadCheck(cacheRoot, id, baseKey, lookup) {
  const baseDir = join(checkLibDir(cacheRoot, id), baseKey);
  if (!existsSync(baseDir)) return { hit: false, reason: 'miss' };
  let names;
  try {
    names = await readdir(baseDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { hit: false, reason: `unreadable: ${message}` };
  }
  /** @type {string | null} */
  let failure = null;
  for (const name of names) {
    const entry = await readCheckEntry(join(baseDir, name));
    if (!entry.ok) {
      failure ??= entry.reason;
      continue;
    }
    const reason = checkDepsReason(entry.deps, lookup);
    if (reason) {
      failure = reason;
      continue;
    }
    return { hit: true, report: entry.report, deps: entry.deps };
  }
  if (failure) return { hit: false, reason: failure };
  return { hit: false, reason: 'miss' };
}

async function stamp() {
  writeSeq += 1;
  return `${Date.now()}-${String(writeSeq).padStart(6, '0')}-${process.pid}`;
}

/**
 * @param {string} libDir
 * @param {string} kept
 */
async function pruneLib(libDir, kept) {
  if (!existsSync(libDir)) return;
  /** @type {{ path: string, at: string }[]} */
  const entries = [];
  const top = await readdir(libDir);
  for (const name of top) {
    const path = join(libDir, name);
    let nested = [];
    try {
      nested = statSync(path).isDirectory() ? readdirSync(path) : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`cannot list ${path}: ${message}`);
    }
    const looksLikeCheckBase = nested.some((child) => existsSync(join(path, child, 'deps.json')) || existsSync(join(path, child, 'ok')));
    if (looksLikeCheckBase && !existsSync(join(path, 'tree')) && !existsSync(join(path, 'ok'))) {
      for (const child of nested) {
        const childPath = join(path, child);
        let at = child;
        try {
          const atPath = join(childPath, 'at');
          if (existsSync(atPath)) at = readFileSync(atPath, 'utf8').trim() || child;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`cannot read ${childPath}: ${message}`);
        }
        entries.push({ path: childPath, at });
      }
    } else {
      let at = name;
      try {
        const atPath = join(path, 'at');
        if (existsSync(atPath)) at = readFileSync(atPath, 'utf8').trim() || name;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`cannot read ${path}: ${message}`);
      }
      entries.push({ path, at });
    }
  }
  if (entries.length <= 3) return;
  const ranked = [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const keep = new Set([kept]);
  for (let i = ranked.length - 1; i >= 0 && keep.size < 3; i -= 1) keep.add(ranked[i].path);
  if (!keep.has(kept)) keep.add(kept);
  while (keep.size > 3) {
    const oldestKept = ranked.find((entry) => keep.has(entry.path) && entry.path !== kept);
    if (!oldestKept) break;
    keep.delete(oldestKept.path);
  }
  for (const entry of entries) {
    if (keep.has(entry.path)) continue;
    await rm(entry.path, { recursive: true, force: true });
  }
  const bases = await readdir(libDir);
  for (const name of bases) {
    const path = join(libDir, name);
    let children = [];
    try {
      children = await readdir(path);
    } catch {
      continue;
    }
    if (children.length === 0) await rm(path, { recursive: true, force: true });
  }
}

async function writeAtomic(dest, fill) {
  const tmp = join(dirname(dirname(dest)), `.tmp-${process.pid}-${Date.now()}-${writeSeq}`);
  await mkdir(tmp, { recursive: true });
  try {
    await fill(tmp);
    await writeFile(join(tmp, 'at'), await stamp(), 'utf8');
    await writeFile(join(tmp, 'ok'), 'ok\n', 'utf8');
    await mkdir(dirname(dest), { recursive: true });
    if (existsSync(dest)) await rm(dest, { recursive: true, force: true });
    await rename(tmp, dest);
  } catch (err) {
    await rm(tmp, { recursive: true, force: true });
    throw err;
  }
  return dest;
}

async function finishWrite(libDir, dest) {
  try {
    await pruneLib(libDir, dest);
    return { cleanupError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { cleanupError: message };
  }
}

export async function writeEmitEntry({ cacheRoot, id, key, treeSource }) {
  const dest = emitDir(cacheRoot, id, key);
  await mkdir(join(cacheRoot, 'emit', String(id)), { recursive: true });
  await writeAtomic(dest, async (tmp) => {
    await cp(treeSource, join(tmp, 'tree'), { recursive: true });
  });
  return finishWrite(join(cacheRoot, 'emit', String(id)), dest);
}

export async function writeCheckEntry({ cacheRoot, id, baseKey, report, deps }) {
  const libDir = checkLibDir(cacheRoot, id);
  await mkdir(join(libDir, baseKey), { recursive: true });
  const dest = join(libDir, baseKey, await stamp());
  await writeAtomic(dest, async (tmp) => {
    await writeFile(join(tmp, 'report.json'), `${JSON.stringify(report)}\n`, 'utf8');
    await writeFile(join(tmp, 'deps.json'), `${JSON.stringify(deps)}\n`, 'utf8');
  });
  return finishWrite(libDir, dest);
}

export async function restoreEmittedTree(treeDir, dest) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(treeDir, dest, { recursive: true });
}

export function typescriptVersion(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'node_modules', 'typescript', 'package.json'), 'utf8'));
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new Error('typescript package.json has no version');
  }
  return pkg.version;
}

export function hashFile(path) {
  return sha256Text(readFileSync(path));
}

export function snapshotTypeCheck(report) {
  return {
    projectId: String(report.projectId),
    policyStatus: report.policy?.status ?? '',
    overrideLog: report.overrideLog || '',
    reportLine: report.reportLine,
    toleratedLog: report.toleratedLog || '',
    excerpt: Array.isArray(report.excerpt) ? report.excerpt : [],
    marker: report.marker,
    block: Boolean(report.verdict?.block),
  };
}

export function planLibCache({ ids, clientId, dirs, compilerOptions, tsVersion, baseHash }) {
  const client = String(clientId);
  const compilerOptionsHash = hashCompilerOptions(compilerOptions);
  return ids.map((id) => {
    const sid = String(id);
    const dir = dirs[id];
    const head = dir ? gitHead(dir) : null;
    const porcelain = dir ? gitPorcelain(dir) : null;
    const eligible = shouldUseCache({
      projectId: sid,
      clientId: client,
      head,
      porcelain,
    });
    const policyStatus = dir ? readTypeCheckPolicy(dir).status : 'permissive';
    const common = {
      head: head ?? '',
      typescriptVersion: tsVersion,
      compilerOptionsHash,
      baseTsconfigHash: baseHash,
    };
    return {
      id: sid,
      eligible,
      emitKey: emitCacheKey(common).full,
      checkBase: checkBaseKey({ ...common, policyStatus }).full,
    };
  });
}

