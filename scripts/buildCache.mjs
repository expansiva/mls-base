// Cache of a clean lib's typeCheck report and pre-rewrite emit tree.
// Keyed by that lib's commit, the commits of the other libs in the chain,
// the TypeScript version, the compiler options, the base tsconfig and the
// typeCheck policy. The release app and a dirty tree never hit or fill it.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readTypeCheckPolicy } from './typeCheckPolicy.mjs';

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

/**
 * @param {{ head: string, dirty?: string, typescriptVersion: string, compilerOptionsHash: string, baseTsconfigHash: string, depHeads: { id: string, head: string }[], policyStatus: string }} parts
 */
export function cacheKey(parts) {
  const deps = [...parts.depHeads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const material = JSON.stringify({
    head: parts.head,
    dirty: parts.dirty ?? '',
    typescriptVersion: parts.typescriptVersion,
    compilerOptionsHash: parts.compilerOptionsHash,
    baseTsconfigHash: parts.baseTsconfigHash,
    deps,
    policyStatus: parts.policyStatus,
  });
  const full = sha256Text(material);
  return { full, short: full.slice(0, 12) };
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
 * Every chain lib except the release app must be a clean HEAD.
 * s0: typeCheck opens imported projects, with cycles, so the key uses the
 * whole chain rather than the declared deps.
 *
 * @param {{ id: string, dir: string }[]} libs
 * @returns {{ ok: true, heads: { id: string, head: string }[] } | { ok: false, reason: string }}
 */
export function chainHeads(libs) {
  /** @type {{ id: string, head: string }[]} */
  const heads = [];
  for (const lib of libs) {
    const head = gitHead(lib.dir);
    if (!head) return { ok: false, reason: `mls-${lib.id} has no HEAD` };
    const porcelain = gitPorcelain(lib.dir);
    if (porcelain == null) return { ok: false, reason: `mls-${lib.id} git status failed` };
    if (porcelain !== '') return { ok: false, reason: `mls-${lib.id} is dirty` };
    heads.push({ id: lib.id, head });
  }
  return { ok: true, heads };
}

/**
 * @param {{ projectId: string, clientId: string, head: string | null, porcelain: string | null, chainOk: boolean }} args
 */
export function shouldUseCache(args) {
  if (args.projectId === args.clientId) return false;
  if (!args.head || args.porcelain == null || args.porcelain !== '') return false;
  return args.chainOk;
}

/**
 * @param {string} cacheRoot
 * @param {string} key
 * @returns {Promise<{ hit: true, report: Record<string, unknown>, tree: string } | { hit: false, reason?: string }>}
 */
export async function loadCacheEntry(cacheRoot, key) {
  const dir = join(cacheRoot, key);
  if (!existsSync(dir)) return { hit: false };
  try {
    const reportPath = join(dir, 'report.json');
    const tree = join(dir, 'tree');
    if (!existsSync(join(dir, 'ok'))) return { hit: false, reason: 'incomplete: missing ok' };
    if (!existsSync(reportPath)) return { hit: false, reason: 'incomplete: missing report' };
    if (!existsSync(tree)) return { hit: false, reason: 'incomplete: missing tree' };
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    if (
      report == null
      || typeof report.reportLine !== 'string'
      || typeof report.marker !== 'string'
      || !Array.isArray(report.excerpt)
    ) {
      return { hit: false, reason: 'incomplete: report fields' };
    }
    return { hit: true, report, tree };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { hit: false, reason: `unreadable: ${message}` };
  }
}

export async function saveCacheEntry(cacheRoot, key, treeSource, report) {
  await mkdir(cacheRoot, { recursive: true });
  const tmp = join(cacheRoot, `.tmp-${key.slice(0, 12)}-${process.pid}-${Date.now()}`);
  await mkdir(join(tmp, 'tree'), { recursive: true });
  await cp(treeSource, join(tmp, 'tree'), { recursive: true });
  await writeFile(join(tmp, 'report.json'), `${JSON.stringify(report)}\n`, 'utf8');
  await writeFile(join(tmp, 'ok'), 'ok\n', 'utf8');
  const dest = join(cacheRoot, key);
  if (existsSync(dest)) await rm(dest, { recursive: true, force: true });
  await rename(tmp, dest);
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
  const libs = ids
    .filter((id) => String(id) !== client)
    .map((id) => ({ id: String(id), dir: dirs[id] }));
  const chain = chainHeads(libs);
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
      chainOk: chain.ok,
    });
    const policyStatus = dir ? readTypeCheckPolicy(dir).status : 'permissive';
    const key = cacheKey({
      head: head ?? '',
      dirty: porcelain == null ? 'nogit' : porcelain,
      typescriptVersion: tsVersion,
      compilerOptionsHash,
      baseTsconfigHash: baseHash,
      depHeads: chain.ok ? chain.heads : [],
      policyStatus,
    });
    return { id: sid, eligible, key: key.full };
  });
}

export async function loadCache(cacheRoot, id, key) {
  const loaded = await loadCacheEntry(cacheRoot, key);
  if (!loaded.hit) return { ok: false, reason: loaded.reason ?? 'miss' };
  return {
    ok: true,
    report: { ...loaded.report, projectId: loaded.report.projectId ?? String(id) },
    treePath: loaded.tree,
  };
}

export async function writeCacheEntry({ cacheRoot, key, report, treeSource }) {
  if (report?.block) return;
  await saveCacheEntry(cacheRoot, key, treeSource, report);
}
