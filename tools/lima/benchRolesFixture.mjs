// Test helpers: a git source copy with `l4/<module>/access.defs.ts` files, shaped like the real ones.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ACCESS_SCHEMA_VERSION } from './benchRoles.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/** The shape of a real `access.defs.ts`: a type import, `as const satisfies`, a default export. */
export function accessDefs(entities, schemaVersion = ACCESS_SCHEMA_VERSION) {
  const actors = entities.map((personEntity, index) => ({ actorId: `actor${index}`, kind: 'internal', personEntity }));
  return `import type { Ns5AccessArtifact, Ns5Readonly } from '/_102035_/l2/solution/types.js';\n\n`
    + `export const moduleAccess = ${JSON.stringify({ schemaVersion, moduleName: 'm', actors }, null, 2)} as const satisfies Ns5Readonly<Ns5AccessArtifact>;\n\n`
    + `export type ModuleAccessType = typeof moduleAccess;\n\nexport default moduleAccess;\n`;
}

/** A source copy with one commit per `steps` entry; returns the repo and the sha of each commit. */
export function sourceCopy(steps) {
  const root = mkdtempSync(path.join(tmpdir(), 'bench-roles-'));
  git(root, ['init', '-q']);
  const shas = [];
  for (const files of steps) {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'step']);
    shas.push(git(root, ['rev-parse', 'HEAD']));
  }
  return { root, shas };
}
