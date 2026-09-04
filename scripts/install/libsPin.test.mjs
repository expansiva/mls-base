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
  libFileUrls,
  installFiles,
  typeFiles,
  correctionMessage,
  buildReleaseStamp,
} = require('./libsPin.js');

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
  const pin = { libs: '20260904142119', monaco: '20240313204233' };
  withRoot({ name: 'x', collabLibs: pin }, (root) => {
    assert.deepEqual(readLibsPin(root), pin);
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
  const pin = { libs: '20260904142119', monaco: '20240313204233' };
  const urls = libFileUrls(pin);
  assert.equal(urls.mlsDts, 'https://collab.codes/libs/20260904142119/mls.d.ts');
  assert.equal(urls.mlsJs, 'https://collab.codes/libs/20260904142119/mls.js');
  assert.equal(urls.monacoDts, 'https://collab.codes/monaco/20240313204233/monaco.d.ts');
  const listed = [
    ...Object.values(urls),
    ...installFiles(pin).map((f) => f.url),
    ...typeFiles(pin).map((f) => f.url),
  ];
  for (const url of listed) {
    assert.doesNotMatch(url, /latest\.json/u);
    assert.match(url, /20260904142119|20240313204233/u);
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
  const msg = correctionMessage('types/mls.d.ts', { libs: '20260904142119', monaco: '20240313204233' });
  assert.match(msg, /corrected types\/mls\.d\.ts/u);
  assert.match(msg, /libs=20260904142119/u);
});

test('buildReleaseStamp sela libs, monaco, versionRef e o commit do modelo', () => {
  const stamp = buildReleaseStamp({
    releaseId: '20260904153000',
    pin: { libs: '20260904142119', monaco: '20240313204233' },
    clientId: '102043',
    versionRef: 'abc123',
    modelCommit: 'def456',
  });
  assert.equal(stamp.id, '20260904153000');
  assert.equal(stamp.libs, '20260904142119');
  assert.equal(stamp.monaco, '20240313204233');
  assert.equal(stamp.client, '102043');
  assert.equal(stamp.versionRef, 'abc123');
  assert.equal(stamp.modelCommit, 'def456');
});

test('package.json do mls-base declara o pin no formato 14 dígitos', () => {
  const pin = readLibsPin(join(HERE, '..', '..'));
  assert.match(pin.libs, /^\d{14}$/u);
  assert.match(pin.monaco, /^\d{14}$/u);
});
