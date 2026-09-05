import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_EXIT,
  DEPS_UPDATE_IDS_MSG,
  commandUrl,
  findServerByProjectId,
  parseArgs,
  sitesBaseUrl,
} from './vm.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(MLS_BASE, 'scripts', 'vm.mjs');

function runCli(args, { env = {}, home } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      COLLAB_API_KEY: '',
      COLLAB_PUBLISH_TOKEN: '',
      HOME: home ?? mkdtempSync(join(tmpdir(), 'vm-cli-')),
      ...env,
    },
  });
}

test('deps-update sem ids recusa, mesmo que a rota aceite vazio', () => {
  assert.throws(() => parseArgs(['102043', 'deps-update']), (err) => {
    assert.equal(err.message, DEPS_UPDATE_IDS_MSG);
    return true;
  });
  const spawned = runCli(['102043', 'deps-update']);
  assert.notEqual(spawned.status, 0);
  assert.notEqual(spawned.status, AUTH_EXIT);
  assert.match(spawned.stderr, /deps-update requires ids/u);
  assert.match(spawned.stderr, /reset --hard/u);
});

test('token ausente sai com AUTH_EXIT e a mesma mensagem do publishGit', () => {
  const spawned = runCli(['102043', 'status']);
  assert.equal(spawned.status, AUTH_EXIT);
  assert.match(spawned.stderr, /Rode: pnpm publishGit login/u);
  assert.match(spawned.stderr, /\[publishGit\]/u);
});

test('a URL é montada a partir do projectId via inventário, não instanceId', () => {
  assert.equal(sitesBaseUrl({ COLLAB_SITES_BASE_URL: 'https://sites.collab.codes/' }), 'https://sites.collab.codes');
  assert.equal(sitesBaseUrl({}), 'https://sites.collab.codes');

  const hosted = {
    id: 'srv_abc',
    projectId: '102051',
    instanceId: 'i-deadbeef',
    hostedProjects: [{ projectId: '102043' }, { projectId: '102051' }],
  };
  const server = findServerByProjectId([hosted], 'mls-102043');
  assert.equal(server.id, 'srv_abc');
  assert.equal(
    commandUrl('https://sites.collab.codes/', server.id, 'platform-update'),
    'https://sites.collab.codes/api/v1/servers/srv_abc/platform/update',
  );
  assert.equal(
    commandUrl('https://sites.collab.codes', server.id, 'deps-update'),
    'https://sites.collab.codes/api/v1/servers/srv_abc/platform-deps/update',
  );
  assert.equal(findServerByProjectId([hosted], '102099'), null);
});

test('parseArgs: hold on|off e ids do deps-update', () => {
  assert.deepEqual(parseArgs(['mls-102043', 'platform-update']), { projectId: '102043', command: 'platform-update' });
  assert.deepEqual(parseArgs(['102043', 'hold', 'on']), { projectId: '102043', command: 'hold', hold: true });
  assert.deepEqual(parseArgs(['102043', 'deps-update', '100554', 'mls-102021']), {
    projectId: '102043', command: 'deps-update', ids: ['100554', '102021'],
  });
});
