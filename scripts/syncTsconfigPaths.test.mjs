import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addMissingTsconfigPaths,
  discoverConfiguredProjectIds,
  formatMissingTsconfigPathsMessage,
  insertPathEntries,
  missingTsconfigPathIds,
  pathIdsOf,
  parseSyncArgs,
} from './syncTsconfigPaths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MLS_BASE = resolve(HERE, '..');
const SCRIPT = join(HERE, 'syncTsconfigPaths.mjs');

const SAMPLE = `{
    "compilerOptions": {
        "strict": true,
        "paths": {
            "/_100554_/*": ["./mls-100554/*"], // collab_workspace
            "/_102033_/*": ["./mls-102033/*"], // collabMasterFrontendAuraClient
            "/_102039_/*": ["./mls-102039/*"]
        }
    }
}
`;

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'tsconfig-paths-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), SAMPLE);
    mkdirSync(join(root, 'mls-102039', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102039', 'l5', 'config.json'), '{}\n');
    mkdirSync(join(root, 'mls-102033'));
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('discoverConfiguredProjectIds exige l5/config.json; ignora pasta vazia e variante -temp', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'mls-102099'));
    mkdirSync(join(root, 'mls-102039-temp', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102039-temp', 'l5', 'config.json'), '{}\n');
    assert.deepEqual(discoverConfiguredProjectIds(root), ['102039']);
  });
});

test('missingTsconfigPathIds: projeto com config fora de paths', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'mls-102077', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102077', 'l5', 'config.json'), '{}\n');
    assert.deepEqual(missingTsconfigPathIds(root), ['102077']);
  });
});

test('mensagem diz que é erro de setup, não do agente, e nomeia o mapeamento', () => {
  const msg = formatMissingTsconfigPathsMessage(['102077']);
  assert.match(msg, /setup error, not an agent error/);
  assert.match(msg, /TS2307/);
  assert.match(msg, /mls-102077/);
  assert.match(msg, /"\/_102077_\/\*"/);
  assert.match(msg, /syncTsconfigPaths\.mjs/);
  assert.doesNotMatch(msg, /todo\//);
});

test('insertPathEntries acrescenta no fim, preserva labels, vírgula no anterior', () => {
  const next = insertPathEntries(SAMPLE, ['102077']);
  assert.deepEqual(pathIdsOf(next), ['100554', '102033', '102039', '102077']);
  assert.match(next, /\/\/ collab_workspace/);
  assert.match(next, /\/\/ collabMasterFrontendAuraClient/);
  assert.match(next, /"\/_102039_\/\*": \["\.\/mls-102039\/\*"\],/);
  assert.match(next, /"\/_102077_\/\*": \["\.\/mls-102077\/\*"\]\n/);
  assert.equal(insertPathEntries(SAMPLE, []), SAMPLE);
});

test('insertPathEntries recusa tsconfig sem bloco paths', () => {
  assert.throws(
    () => insertPathEntries('{ "compilerOptions": { "strict": true } }', ['102077']),
    /Could not find a "paths" block in tsconfig\.json/,
  );
});

test('addMissingTsconfigPaths escreve só o que falta e é idempotente', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'mls-102077', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102077', 'l5', 'config.json'), '{}\n');
    assert.deepEqual(addMissingTsconfigPaths(root), ['102077']);
    const text = readFileSync(join(root, 'tsconfig.json'), 'utf8');
    assert.match(text, /"\/_102077_\/\*"/);
    assert.match(text, /\/\/ collab_workspace/);
    assert.deepEqual(addMissingTsconfigPaths(root), []);
    assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), text);
  });
});

test('--check no CLI sai 1 com a mensagem de setup; default escreve', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'mls-102077', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102077', 'l5', 'config.json'), '{}\n');
    const checked = spawnSync(process.execPath, [SCRIPT, '--check', '--root', root], { encoding: 'utf8' });
    assert.equal(checked.status, 1);
    assert.match(`${checked.stderr}${checked.stdout}`, /setup error, not an agent error/);
    assert.equal(pathIdsOf(readFileSync(join(root, 'tsconfig.json'), 'utf8')).includes('102077'), false);

    const written = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
    assert.equal(written.status, 0);
    assert.match(`${written.stderr}${written.stdout}`, /"\/_102077_\/\*"/);
    assert.ok(pathIdsOf(readFileSync(join(root, 'tsconfig.json'), 'utf8')).includes('102077'));

    const ok = spawnSync(process.execPath, [SCRIPT, '--check', '--root', root], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
  });
});

test('cabeçalho: typeCheck do gate herda o tsconfig versionado; a VM precisa do paths', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(src, /This script is the Mac side/);
  assert.doesNotMatch(src, /VM compile does not use this file/);
  assert.match(src, /typeCheckRun\.mjs:67/);
  assert.match(src, /tsconfig\.backend\.json/);
  assert.match(src, /tsconfig\.json/);
});

test('parseSyncArgs: --check e --root', () => {
  assert.deepEqual(parseSyncArgs(['--check'], '/base'), { root: resolve('/base'), check: true });
  assert.equal(parseSyncArgs(['--root', '/tmp/x']).root, resolve('/tmp/x'));
});

test('workspace mls-base: nenhum mls-* com l5/config.json está fora de paths', () => {
  const missing = missingTsconfigPathIds(MLS_BASE);
  assert.deepEqual(
    missing,
    [],
    formatMissingTsconfigPathsMessage(missing),
  );
});
