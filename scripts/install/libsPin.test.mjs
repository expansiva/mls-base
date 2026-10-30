import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  resolveLibsVersion,
  readInstalledLibs,
  assertLibsPinWithoutFirebase,
  FIRST_LIBS_WITHOUT_FIREBASE,
  DEFAULT_LATEST_URL,
  libFileUrls,
  installFiles,
  typeFiles,
  correctionMessage,
  buildReleaseStamp,
} = require('./libsPin.js');

const FIXTURE = { libs: '20991231235959', monaco: '20240313204233' };
const PIN_WITH_FIREBASE = '20260904142119';
const PIN_CLEAN = '20260910124210';
const LATEST_URL = 'https://example.test/latest.json';

function pinText(pin = FIXTURE) {
  return `${pin.libs}:${pin.monaco}`;
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test('resolveLibsVersion usa COLLAB_LIBS_PIN e não chama a rede', async () => {
  let called = false;
  const resolved = await resolveLibsVersion({
    env: { COLLAB_LIBS_PIN: pinText() },
    fetchImpl: async () => {
      called = true;
      throw new Error('network');
    },
    readFile: () => {
      throw new Error('should not read pin file');
    },
  });
  assert.equal(called, false);
  assert.deepEqual(resolved, { ...FIXTURE, source: 'pin-env' });
});

test('resolveLibsVersion usa o arquivo de freio quando o env está vazio', async () => {
  const pinFile = '/tmp/libs-pin-test';
  let fetched = false;
  const resolved = await resolveLibsVersion({
    env: { COLLAB_LIBS_PIN_FILE: pinFile },
    fetchImpl: async () => {
      fetched = true;
      return jsonResponse(FIXTURE);
    },
    readFile: (file) => {
      assert.equal(file, pinFile);
      return `${pinText()}\n`;
    },
  });
  assert.equal(fetched, false);
  assert.deepEqual(resolved, { ...FIXTURE, source: 'pin-file' });
});

test('resolveLibsVersion lê libs e monaco do latest.json', async () => {
  const resolved = await resolveLibsVersion({
    env: { CBE_LATEST_URL: LATEST_URL },
    fetchImpl: async (url) => {
      assert.equal(url, LATEST_URL);
      return jsonResponse({ ...FIXTURE, www: '1' });
    },
    readFile: () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
  });
  assert.deepEqual(resolved, { ...FIXTURE, source: 'latest' });
});

test('resolveLibsVersion falha com a URL quando a rede quebra e não usa versão antiga', async () => {
  await assert.rejects(
    () => resolveLibsVersion({
      env: { CBE_LATEST_URL: LATEST_URL },
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
      readFile: () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
    }),
    new RegExp(`failed to read latest.json at ${LATEST_URL}: ECONNREFUSED`),
  );
});

test('resolveLibsVersion recusa versão com Firebase vinda do latest.json', async () => {
  await assert.rejects(
    () => resolveLibsVersion({
      env: {},
      fetchImpl: async (url) => {
        assert.equal(url, DEFAULT_LATEST_URL);
        return jsonResponse({ libs: PIN_WITH_FIREBASE, monaco: FIXTURE.monaco });
      },
      readFile: () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
    }),
    /still bundles Firebase/u,
  );
});

test('readInstalledLibs lê o carimbo e devolve null quando ele falta', () => {
  const root = mkdtempSync(join(tmpdir(), 'libspin-'));
  try {
    assert.equal(readInstalledLibs(root), null);
    mkdirSync(join(root, 'types'));
    writeFileSync(join(root, 'types', '.libs-pin'), `${pinText()}\n`);
    assert.deepEqual(readInstalledLibs(root), FIXTURE);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('libFileUrls aponta a versão pinada e nenhuma URL consulta latest.json', () => {
  const urls = libFileUrls(FIXTURE);
  assert.equal(urls.mlsDts, `https://collab.codes/libs/${FIXTURE.libs}/mls.d.ts`);
  assert.equal(urls.mlsJs, `https://collab.codes/libs/${FIXTURE.libs}/mls.js`);
  assert.equal(urls.monacoDts, `https://collab.codes/monaco/${FIXTURE.monaco}/monaco.d.ts`);
  const listed = [
    ...Object.values(urls),
    ...installFiles(FIXTURE).map((f) => f.url),
    ...typeFiles(FIXTURE).map((f) => f.url),
  ];
  for (const url of listed) {
    assert.doesNotMatch(url, /latest\.json/u);
    assert.match(url, new RegExp(`${FIXTURE.libs}|${FIXTURE.monaco}`, 'u'));
  }
});

test('correctionMessage nomeia o arquivo e o pin', () => {
  const msg = correctionMessage('types/mls.d.ts', FIXTURE);
  assert.match(msg, /corrected types\/mls\.d\.ts/u);
  assert.match(msg, new RegExp(`libs=${FIXTURE.libs}`, 'u'));
});

test('buildReleaseStamp sela libs, monaco, versionRef, o commit do modelo e o da plataforma', () => {
  const stamp = buildReleaseStamp({
    releaseId: '20260904153000',
    pin: FIXTURE,
    clientId: '102043',
    versionRef: 'abc123',
    modelCommit: 'def456',
    platformCommit: 'cafed00d',
  });
  assert.equal(stamp.id, '20260904153000');
  assert.equal(stamp.libs, FIXTURE.libs);
  assert.equal(stamp.monaco, FIXTURE.monaco);
  assert.equal(stamp.client, '102043');
  assert.equal(stamp.versionRef, 'abc123');
  assert.equal(stamp.modelCommit, 'def456');
  assert.equal(stamp.platformCommit, 'cafed00d');
});

test('buildReleaseStamp grava platformCommit unknown quando a raiz não é checkout', () => {
  const stamp = buildReleaseStamp({
    releaseId: '20260904153000',
    pin: FIXTURE,
    clientId: '102043',
    versionRef: 'abc123',
    modelCommit: 'def456',
  });
  assert.equal(stamp.platformCommit, 'unknown');
});

test('assertLibsPinWithoutFirebase recusa pin com Firebase e aceita a fronteira', () => {
  assert.throws(
    () => assertLibsPinWithoutFirebase(PIN_WITH_FIREBASE),
    new RegExp(
      `libs pin ${PIN_WITH_FIREBASE} points at a lib that still bundles Firebase; `
      + `bump it to ${FIRST_LIBS_WITHOUT_FIREBASE} or newer`,
    ),
  );
  assert.doesNotThrow(() => assertLibsPinWithoutFirebase(FIRST_LIBS_WITHOUT_FIREBASE));
  assert.doesNotThrow(() => assertLibsPinWithoutFirebase(PIN_CLEAN));
});

test('libFileUrls monta as URLs do pin sem Firebase', () => {
  const pin = { libs: PIN_CLEAN, monaco: FIXTURE.monaco };
  const urls = libFileUrls(pin);
  assert.equal(urls.mlsJs, `https://collab.codes/libs/${PIN_CLEAN}/mls.js`);
  assert.equal(urls.mlsDts, `https://collab.codes/libs/${PIN_CLEAN}/mls.d.ts`);
  assert.equal(urls.mlsJsMap, `https://collab.codes/libs/${PIN_CLEAN}/mls.js.map`);
  assert.equal(urls.globalDts, `https://collab.codes/libs/${PIN_CLEAN}/global.d.ts`);
});
