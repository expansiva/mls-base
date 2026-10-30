// releaseStamp.mjs — what compiled this release (lib pin + source provenance).
// Written into releases/<id>/release.json by addNewVersion so a reader can
// answer "which mls.d.ts compiled this" without guessing the download time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readDepIds } from '../publishGitDeps.mjs';

const require = createRequire(import.meta.url);
const { readInstalledLibs, buildReleaseStamp } = require('../install/libsPin.js');

export function gitHead(repo) {
  if (!repo || !existsSync(join(repo, '.git'))) return '';
  const result = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

export function readModelCommit(projectDir) {
  if (!projectDir) return '';
  const marker = join(projectDir, '.collab-git');
  if (!existsSync(marker)) return '';
  const text = readFileSync(marker, 'utf8');
  const match = /model-commit:\s*([0-9a-f]{7,40})/iu.exec(text);
  return match ? match[1] : '';
}

// Trees of the client's dependency repos (same shape as prepareSources depTrees), read
// before the compile so a dependency moved during the build shows up as a mismatch.
// A repo whose tree cannot be read records '' (never equal to a real tree).
export function readDepTrees(root, clientId) {
  if (!clientId) return {};
  const trees = {};
  for (const id of readDepIds(join(root, `mls-${clientId}`), clientId)) {
    const repo = join(root, `mls-${id}`);
    if (!existsSync(join(repo, '.git'))) continue;
    const result = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' });
    trees[id] = result.status === 0 ? String(result.stdout || '').trim() : '';
  }
  return trees;
}

export function collectReleaseStamp({ root, releaseId, clientId, deps, source }) {
  const installed = readInstalledLibs(root);
  const pin = installed ?? { libs: 'unknown', monaco: 'unknown' };
  if (!installed) {
    process.stderr.write('releaseStamp: installed libs stamp is missing; recording libs=unknown\n');
  }
  const clientDir = clientId ? join(root, `mls-${clientId}`) : '';
  const stamp = buildReleaseStamp({
    releaseId,
    pin,
    clientId: clientId || null,
    versionRef: clientDir ? gitHead(clientDir) : '',
    modelCommit: clientDir ? readModelCommit(clientDir) : '',
    platformCommit: gitHead(root) || 'unknown',
  });
  return {
    ...stamp,
    ...(source ? { source } : {}),
    deps: deps ?? readDepTrees(root, clientId),
  };
}

export function writeReleaseStamp(releaseDir, stamp) {
  writeFileSync(join(releaseDir, 'release.json'), `${JSON.stringify(stamp, null, 2)}\n`);
}
