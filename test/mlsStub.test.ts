import test from 'node:test';
import assert from 'node:assert/strict';
import { installMlsStub, mlsStubEvents } from './mlsStub.js';

type StubMls = {
  actualProject: number;
  stor: { files: Record<string, { folder?: string }> };
  events: { fireFileAction: (...args: unknown[]) => void };
  l5: { getProjectDependencies: (project: number, flag: boolean) => number[] };
};

const stub = (): StubMls => (globalThis as unknown as { mls: StubMls }).mls;

test('default host: no dependencies, fireFileAction has no effect and is recorded', () => {
  installMlsStub();
  assert.equal(stub().actualProject, 102020);
  assert.deepEqual(stub().l5.getProjectDependencies(102020, false), []);
  assert.equal(mlsStubEvents().length, 0);
  stub().events.fireFileAction('added', { shortPath: 'a.ts' });
  stub().events.fireFileAction('changed');
  assert.deepEqual(mlsStubEvents(), [['added', { shortPath: 'a.ts' }], ['changed']]);
});

test('options: project, folders, files, dependencies, l5 and events', () => {
  const seen: unknown[][] = [];
  installMlsStub({
    actualProject: 102035,
    existingFolders: ['x'],
    files: { custom: { folder: 'y' } },
    projectDependencies: [100554, 102029],
    l5: { extra: true },
    events: { fireFileAction: (...args: unknown[]) => { seen.push(args); } },
  });
  assert.equal(stub().actualProject, 102035);
  assert.deepEqual(Object.keys(stub().stor.files), ['stub-0', 'custom']);
  assert.deepEqual(stub().l5.getProjectDependencies(102035, false), [100554, 102029]);
  assert.equal((stub().l5 as unknown as { extra: boolean }).extra, true);
  stub().events.fireFileAction('z');
  assert.deepEqual(seen, [['z']]);
  assert.equal(mlsStubEvents().length, 0, 'an events override replaces the recording');
});

test('install resets the recorded calls', () => {
  installMlsStub();
  stub().events.fireFileAction('a');
  installMlsStub();
  assert.equal(mlsStubEvents().length, 0);
});
