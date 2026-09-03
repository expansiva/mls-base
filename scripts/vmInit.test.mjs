import test from 'node:test';
import assert from 'node:assert/strict';
import { limaInstanceOf, parseArgs, projectInitCommand } from './vmInit.mjs';

test('parseArgs: defaults are the local profile and the `project` template', () => {
  assert.deepEqual(parseArgs(['102043']), {
    id: '102043', template: 'project', profile: 'local', force: false,
  });
  assert.deepEqual(parseArgs(['mls-102043', '--profile', 'remote', '--template=project', '--force']), {
    id: '102043', template: 'project', profile: 'remote', force: true,
  });
});

test('limaInstanceOf: the instance is the folder of the ssh.config', () => {
  assert.equal(limaInstanceOf({ SSH_CONFIG: '/Users/x/.lima/ubuntu24/ssh.config' }, {}), 'ubuntu24');
  assert.equal(limaInstanceOf({ SSH_CONFIG: '/etc/ssh/config' }, {}), '');
  assert.equal(
    limaInstanceOf({ SSH_CONFIG: '/Users/x/.lima/ubuntu24/ssh.config' }, { PUBLISH_LOCAL_LIMA_INSTANCE: 'outra' }),
    'outra',
  );
});

// The Mac side does not know HOW a project is born any more — it only names the VM-side
// script. If this command drifts from what collab-runtime's step 12 runs, lima and a remote
// VM stop taking the same path, which is the whole point of the split.
test('projectInitCommand: names the VM script, the root and the template; --force only when asked', () => {
  const plain = projectInitCommand('/data/mls-base', '102044', 'project', false);
  assert.match(plain, /'node' '\/data\/mls-base\/scripts\/runtime\/projectInit\.mjs' '102044'/u);
  assert.match(plain, /'--root' '\/data\/mls-base'/u);
  assert.match(plain, /'--template' 'project'/u);
  assert.equal(plain.includes('--force'), false);
  assert.match(projectInitCommand('/data/mls-base', '102044', 'project', true), /'--force'/u);
});

test('projectInitCommand: nothing from the Mac reaches the VM unquoted', () => {
  // A base path with a space (or worse) must not split into two arguments.
  const command = projectInitCommand("/data/mls base", '102044', 'project', false);
  assert.match(command, /'\/data\/mls base'/u);
});
