// zipSourceTree.mjs — which source tree a locally built obj/compiled.zip came from (rt194).
//
// The activation guard used to compare the zip's mtime with the HEAD commit time. A local snapshot
// commit (gitReposSetup) moves HEAD's time without changing a single source file, so every lib looked
// stale and was rebuilt (10 libs, 265 s). The question is "did the l1..l7 sources change since this zip
// was built?", so the answer is the git tree of those levels, recorded when the zip is built.
//
// The stamp lives INSIDE the repo's git dir (never in the worktree: no dirty status, no snapshot
// commit) and names the zip it belongs to by size and mtime; a zip replaced by anything else (a pull
// of the Action's zip, a manual rebuild) makes the stamp not apply.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const ZIP_SOURCE_LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];

function gitText(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** Hash of the l1..l7 trees at HEAD; null when it cannot be judged (not a git repo, no commit). */
export function sourceTreeHash(repo) {
  const lines = [];
  try {
    for (const level of ZIP_SOURCE_LEVELS) {
      const oid = gitText(repo, ['ls-tree', 'HEAD', '--', level]).split(/\s+/u)[2];
      if (oid) lines.push(`${level} ${oid}`);
    }
  } catch {
    return null;
  }
  return createHash('sha1').update(lines.join('\n')).digest('hex');
}

function stampFile(repo) {
  const path = gitText(repo, ['rev-parse', '--git-path', 'collab-zip-source-tree.json']);
  return isAbsolute(path) ? path : join(repo, path);
}

function zipIdentity(zip) {
  const { size, mtimeMs } = statSync(zip);
  return { size, mtimeMs };
}

/** Record the tree the zip was built from. Only when the levels have no uncommitted change (else the tree is not what was built). */
export function writeZipStamp(repo, zip) {
  try {
    if (!existsSync(zip)) return false;
    if (gitText(repo, ['status', '--porcelain', '--', ...ZIP_SOURCE_LEVELS]) !== '') return false;
    const tree = sourceTreeHash(repo);
    if (!tree) return false;
    writeFileSync(stampFile(repo), `${JSON.stringify({ tree, ...zipIdentity(zip) })}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** The recorded tree hash if it belongs to this very zip; null otherwise (no stamp, other zip, unreadable). */
export function readZipStamp(repo, zip) {
  try {
    const stamp = JSON.parse(readFileSync(stampFile(repo), 'utf8'));
    const now = zipIdentity(zip);
    if (typeof stamp?.tree !== 'string' || stamp.size !== now.size || stamp.mtimeMs !== now.mtimeMs) return null;
    return stamp.tree;
  } catch {
    return null;
  }
}
