import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { deriveMemberRoles, projectModuleIds } from './benchRoles.mjs';
import { accessDefs, sourceCopy } from './benchRolesFixture.mjs';

const config = (...ids) => ({ projects: { 102047: { type: 'client', modules: ids.map((moduleId) => ({ moduleId })) } } });

test('modules come from the release config, in order, without repeats or bad ids', () => {
  assert.deepEqual(projectModuleIds(config('b', 'a', 'b', '9x', ''), '102047'), ['b', 'a']);
  assert.deepEqual(projectModuleIds({}, '102047'), []);
  assert.deepEqual(projectModuleIds({ projects: { 102047: { modules: 'x' } } }, '102047'), []);
});

test('roles are the person types of every module, in config order then actor order, once each', async () => {
  const { root, shas } = sourceCopy([{
    'l4/modA/access.defs.ts': accessDefs(['', 'Alpha', 'Alpha', 'Beta']),
    'l4/modB/access.defs.ts': accessDefs(['Gamma', '']),
  }]);
  const derived = await deriveMemberRoles({ config: config('modB', 'modA'), projectId: '102047', appRoot: root, versionRef: shas[0] });
  assert.deepEqual(derived, {
    roles: ['modB.Gamma', 'modA.Alpha', 'modA.Beta'],
    authorities: ['modB:actor0', 'modB:actor1', 'modA:actor0', 'modA:actor1', 'modA:actor2', 'modA:actor3'],
    modulesWithoutAccess: [],
    skipped: null,
  });
});

test('a module without access.defs.ts is skipped and listed; a module with no person actor adds nothing', async () => {
  const { root, shas } = sourceCopy([{ 'l4/modA/access.defs.ts': accessDefs(['', '']), 'l4/modC/access.defs.ts': accessDefs(['Delta']) }]);
  const derived = await deriveMemberRoles({ config: config('modA', 'modB', 'modC'), projectId: '102047', appRoot: root, versionRef: shas[0] });
  assert.deepEqual(derived, {
    roles: ['modC.Delta'],
    authorities: ['modA:actor0', 'modA:actor1', 'modC:actor0'],
    modulesWithoutAccess: ['modB'],
    skipped: null,
  });
});

test('the file is read at versionRef, not at the working tree or HEAD', async () => {
  const { root, shas } = sourceCopy([
    { 'l4/modA/access.defs.ts': accessDefs(['Old']) },
    { 'l4/modA/access.defs.ts': accessDefs(['New']) },
  ]);
  writeFileSync(path.join(root, 'l4/modA/access.defs.ts'), accessDefs(['Dirty']));
  const atFirst = await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: shas[0] });
  const atHead = await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: shas[1] });
  assert.deepEqual(atFirst.roles, ['modA.Old']);
  assert.deepEqual(atHead.roles, ['modA.New']);
});

test('a file that exists and does not import is an error, never a silent skip', async () => {
  const { root, shas } = sourceCopy([{ 'l4/modA/access.defs.ts': 'export default {{ not typescript' }]);
  await assert.rejects(
    deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: shas[0] }),
    /l4\/modA\/access\.defs\.ts does not import/,
  );
});

test('another schemaVersion, a missing default export or a bad personEntity is an error', async () => {
  const cases = [
    [accessDefs(['Alpha'], 'other-version'), /schemaVersion is "other-version"/],
    ['export const x = { schemaVersion: "2026-09-12-ns5-access-v3", actors: [] };\n', /no default export object/],
    [accessDefs(['lower']), /invalid personEntity "lower"/],
  ];
  for (const [text, message] of cases) {
    const { root, shas } = sourceCopy([{ 'l4/modA/access.defs.ts': text }]);
    await assert.rejects(deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: shas[0] }), message);
  }
});

test('no source copy, no versionRef, an unknown ref or no module give no roles and say why', async () => {
  const { root, shas } = sourceCopy([{ 'l4/modA/access.defs.ts': accessDefs(['Alpha']) }]);
  const reasons = [];
  reasons.push((await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: path.join(root, 'missing'), versionRef: shas[0] })).skipped);
  reasons.push((await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: undefined })).skipped);
  reasons.push((await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: root, versionRef: 'abcdef1' })).skipped);
  reasons.push((await deriveMemberRoles({ config: config(), projectId: '102047', appRoot: root, versionRef: shas[0] })).skipped);
  reasons.push((await deriveMemberRoles({ config: config('modA'), projectId: '102047', appRoot: undefined, versionRef: shas[0] })).skipped);
  assert.deepEqual(reasons, [
    'versionRef ' + shas[0].slice(0, 7) + ' is not in the source copy',
    'release.json has no versionRef',
    'versionRef abcdef1 is not in the source copy',
    'the release config lists no module for the project',
    'no source copy of the project',
  ]);
});
