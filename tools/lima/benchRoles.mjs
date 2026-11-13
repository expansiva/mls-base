// Person roles of the bench logins, taken from the project's own L4 (no module name lives in this tool).
// Each module declares its person types in `l4/<moduleId>/access.defs.ts` → `actors[].personEntity`
// (`""` = an actor that is not a person). The source copy is read at the release's `versionRef`, so the roles
// are the ones the release was built from, whatever the working tree holds now.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Platform schema of `access.defs.ts` (`NS5_ACCESS_SCHEMA_VERSION`). A change must be seen here, not skipped. */
export const ACCESS_SCHEMA_VERSION = '2026-09-12-ns5-access-v3';

const MODULE_ID = /^[A-Za-z][A-Za-z0-9]*$/;
const PERSON_TYPE = /^[A-Z][A-Za-z0-9]*$/;
const ACTOR_ID = /^[A-Za-z][A-Za-z0-9]*$/;

function git(appRoot, args) {
  return spawnSync('git', ['-C', appRoot, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

/** Module ids of the project, in the order of the release config, without repeats. */
export function projectModuleIds(config, projectId) {
  const modules = config?.projects?.[projectId]?.modules;
  const ids = [];
  for (const entry of Array.isArray(modules) ? modules : []) {
    const id = entry?.moduleId;
    if (typeof id === 'string' && MODULE_ID.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function importDefs(source, label) {
  const dir = mkdtempSync(path.join(tmpdir(), 'bench-access-'));
  try {
    const file = path.join(dir, 'access.defs.mts');
    writeFileSync(file, source);
    const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);
    return mod;
  } catch (error) {
    throw new Error(`${label} does not import: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `actorId` of every actor, person or not, in the order the module declares them. */
function actorIdsOf(defs, label) {
  const ids = [];
  for (const actor of defs.actors) {
    const id = actor?.actorId;
    if (typeof id !== 'string' || !ACTOR_ID.test(id)) {
      throw new Error(`${label} has an actor with an invalid actorId ${JSON.stringify(id)}`);
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** `actorId`s whose `personEntity` is filled (checked by `personTypesOf`, which runs first). */
function personActorIdsOf(defs) {
  const ids = new Set();
  for (const actor of defs.actors) {
    if (typeof actor?.personEntity === 'string' && actor.personEntity !== '') ids.add(actor.actorId);
  }
  return ids;
}

function personTypesOf(defs, label) {
  if (defs == null || typeof defs !== 'object') throw new Error(`${label} has no default export object`);
  if (defs.schemaVersion !== ACCESS_SCHEMA_VERSION) {
    throw new Error(`${label} schemaVersion is ${JSON.stringify(defs.schemaVersion)}, expected ${ACCESS_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(defs.actors)) throw new Error(`${label} has no actors list`);
  const types = [];
  for (const actor of defs.actors) {
    const entity = actor?.personEntity;
    if (entity === undefined || entity === null || entity === '') continue;
    if (typeof entity !== 'string' || !PERSON_TYPE.test(entity)) {
      throw new Error(`${label} actor ${JSON.stringify(actor?.actorId)} has an invalid personEntity ${JSON.stringify(entity)}`);
    }
    if (!types.includes(entity)) types.push(entity);
  }
  return types;
}

/**
 * `<moduleId>.<personEntity>` for every person actor of every module of the project, read at `versionRef`.
 * Order: modules as the release config lists them, then the actors as the module declares them; no repeats.
 * A module without `access.defs.ts` at that ref is skipped and listed; a file that exists and does not import
 * is an error. No source copy, no `versionRef` or a ref the copy does not have → no roles, with the reason.
 * `authorities` is `<moduleId>:<actorId>` of every actor of every module (person or not), same reading and order.
 * `personAuthorities` is the same form for the actors that have a `personEntity` only, in the same order.
 * @returns {Promise<{ roles: string[], authorities: string[], personAuthorities: string[], modulesWithoutAccess: string[], skipped: string | null }>}
 */
export async function deriveMemberRoles({ config, projectId, appRoot, versionRef, run = git }) {
  const none = (skipped) => ({ roles: [], authorities: [], personAuthorities: [], modulesWithoutAccess: [], skipped });
  const modules = projectModuleIds(config, projectId);
  if (modules.length === 0) return none('the release config lists no module for the project');
  if (typeof versionRef !== 'string' || !/^[0-9a-f]{7,40}$/i.test(versionRef)) return none('release.json has no versionRef');
  if (!appRoot) return none('no source copy of the project');
  const known = run(appRoot, ['cat-file', '-e', `${versionRef}^{commit}`]);
  if (known.status !== 0) return none(`versionRef ${versionRef.slice(0, 7)} is not in the source copy`);

  const roles = [];
  const authorities = [];
  const personAuthorities = [];
  const modulesWithoutAccess = [];
  for (const moduleId of modules) {
    const rel = `l4/${moduleId}/access.defs.ts`;
    const present = run(appRoot, ['cat-file', '-e', `${versionRef}:${rel}`]);
    if (present.status !== 0) {
      modulesWithoutAccess.push(moduleId);
      continue;
    }
    const shown = run(appRoot, ['show', `${versionRef}:${rel}`]);
    if (shown.status !== 0) throw new Error(`${rel} could not be read at ${versionRef.slice(0, 7)}: ${String(shown.stderr).trim()}`);
    const mod = await importDefs(shown.stdout, rel);
    const types = personTypesOf(mod.default, rel); // also checks the default export, schemaVersion and actors
    const personActors = personActorIdsOf(mod.default);
    for (const actorId of actorIdsOf(mod.default, rel)) {
      authorities.push(`${moduleId}:${actorId}`);
      if (personActors.has(actorId)) personAuthorities.push(`${moduleId}:${actorId}`);
    }
    for (const type of types) {
      const role = `${moduleId}.${type}`;
      if (!roles.includes(role)) roles.push(role);
    }
  }
  return { roles, authorities, personAuthorities, modulesWithoutAccess, skipped: null };
}
