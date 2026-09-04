// releaseStamp.mjs — what compiled this release (lib pin + source provenance).
// Written into releases/<id>/release.json by addNewVersion so a reader can
// answer "which mls.d.ts compiled this" without guessing the download time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readLibsPin, buildReleaseStamp } = require('../install/libsPin.js');

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

export function collectReleaseStamp({ root, releaseId, clientId }) {
  const pin = readLibsPin(root);
  const clientDir = clientId ? join(root, `mls-${clientId}`) : '';
  return buildReleaseStamp({
    releaseId,
    pin,
    clientId: clientId || null,
    versionRef: clientDir ? gitHead(clientDir) : '',
    modelCommit: clientDir ? readModelCommit(clientDir) : '',
    platformCommit: gitHead(root) || 'unknown',
  });
}

export function writeReleaseStamp(releaseDir, stamp) {
  writeFileSync(join(releaseDir, 'release.json'), `${JSON.stringify(stamp, null, 2)}\n`);
}
