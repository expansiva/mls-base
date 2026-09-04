// Guard: a platform project that imports `/_<id>_/` must declare that id.
// Same specifier scan as buildCI/resolveDeps — comments, JSDoc and runtime
// URL strings are not imports. Generated apps are not in the list: their
// mlsDep.json is produced by buildMlsDepWorkspaceIds and they come and go.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifestDeps, scanImportRefs } from './buildCI/resolveDeps.mjs';

export const MLS_BASE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Hand-maintained platform projects that join a client app's closure.
// Not "every mls-*": generated apps have a generated manifest.
export const PLATFORM_PROJECT_IDS = [
  '100554',
  '100555',
  '102020',
  '102021',
  '102025',
  '102027',
  '102029',
  '102033',
  '102034',
  '102036',
  '102041',
];

// Same levels resolveDeps walks when buildCI compiles a project.
const COMPILE_LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];

const SKIP_DIR_NAMES = ['fixtures', 'trace', 'node_modules'];

function defaultRepo(id) {
  return `https://github.com/expansiva/mls-${id}.git`;
}

export function formatFindings(findings) {
  return findings
    .map((row) => `${row.projectId} | ${row.missingId} | ${row.file}`)
    .join('\n');
}

export async function findUndeclaredPlatformImports(
  root = MLS_BASE_ROOT,
  projectIds = PLATFORM_PROJECT_IDS,
) {
  const findings = [];
  for (const id of projectIds) {
    const dir = join(root, `mls-${id}`);
    if (!existsSync(dir)) continue;
    const { deps } = await readManifestDeps(dir, defaultRepo);
    const declared = new Set(deps.keys());
    const hits = await scanImportRefs(dir, COMPILE_LEVELS, { skipDirNames: SKIP_DIR_NAMES });
    for (const [depId, file] of hits) {
      if (depId === id) continue;
      if (!existsSync(join(root, `mls-${depId}`))) continue;
      if (declared.has(depId)) continue;
      findings.push({ projectId: id, missingId: depId, file });
    }
  }
  return findings;
}
