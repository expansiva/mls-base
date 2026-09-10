import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  readLibsPin,
  assertLibsPinWithoutFirebase,
  FIRST_LIBS_WITHOUT_FIREBASE,
  libFileUrls,
  installFiles,
  typeFiles,
  correctionMessage,
  buildReleaseStamp,
} = require('./libsPin.js');

const FIXTURE = { libs: '20991231235959', monaco: '20240313204233' };
const PIN_WITH_FIREBASE = '20260904142119';
const PIN_CLEAN = '20260910124210';

const HERE = dirname(fileURLToPath(import.meta.url));
const PINNED_SCRIPTS = [
  'libsPin.js',
  'runInstallLibs.js',
  'runInstallDevs.js',
  join('..', 'buildCI', 'downloadTypes.mjs'),
];

function withRoot(pkg, fn) {
  const root = mkdtempSync(join(tmpdir(), 'libspin-'));
  try {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('readLibsPin lê collabLibs do package.json e recusa latest.json', () => {
  withRoot({ name: 'x', collabLibs: FIXTURE }, (root) => {
    assert.deepEqual(readLibsPin(root), FIXTURE);
  });
});

test('readLibsPin falha fechado sem o pin — não há fallback para latest.json', () => {
  withRoot({ name: 'x' }, (root) => {
    assert.throws(() => readLibsPin(root), /pinned, not floating/);
  });
  withRoot({ name: 'x', collabLibs: { libs: 'latest', monaco: '20240313204233' } }, (root) => {
    assert.throws(() => readLibsPin(root), /14-digit/);
  });
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

test('o instalador e o downloadTypes não consultam o latest.json do S3', () => {
  for (const rel of PINNED_SCRIPTS) {
    const src = readFileSync(join(HERE, rel), 'utf8');
    assert.doesNotMatch(
      src,
      /s3\.amazonaws\.com\/www\.collab\.codes\/latest\.json/u,
      rel,
    );
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

test('package.json do mls-base declara o pin no formato 14 dígitos', () => {
  const pin = readLibsPin(join(HERE, '..', '..'));
  assert.match(pin.libs, /^\d{14}$/u);
  assert.match(pin.monaco, /^\d{14}$/u);
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

test('o pin do package.json não aponta para uma lib com Firebase', () => {
  const pin = readLibsPin(join(HERE, '..', '..'));
  assertLibsPinWithoutFirebase(pin.libs);
});

test('libFileUrls monta as URLs do pin sem Firebase', () => {
  const pin = { libs: PIN_CLEAN, monaco: FIXTURE.monaco };
  const urls = libFileUrls(pin);
  assert.equal(urls.mlsJs, `https://collab.codes/libs/${PIN_CLEAN}/mls.js`);
  assert.equal(urls.mlsDts, `https://collab.codes/libs/${PIN_CLEAN}/mls.d.ts`);
  assert.equal(urls.mlsJsMap, `https://collab.codes/libs/${PIN_CLEAN}/mls.js.map`);
  assert.equal(urls.globalDts, `https://collab.codes/libs/${PIN_CLEAN}/global.d.ts`);
});
