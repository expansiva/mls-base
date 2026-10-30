'use strict';
// The mls lib version is resolved at install/release time, never stored in a
// source file. Order: COLLAB_LIBS_PIN, then the pin file outside the repo
// (COLLAB_LIBS_PIN_FILE or /data/etc/libs-pin), then latest.json
// (CBE_LATEST_URL or the public S3 URL). A failed fetch does not fall back.
const fs = require('fs');
const path = require('path');

const VERSION_RE = /^\d{14}$/u;
// First published mls lib without Firebase (not03b). A pin below this is the
// Firebase bundle; the guard refuses it wherever the version was resolved.
const FIRST_LIBS_WITHOUT_FIREBASE = '20260910003715';
const DEFAULT_PIN_FILE = '/data/etc/libs-pin';
const DEFAULT_LATEST_URL = 'https://s3.amazonaws.com/www.collab.codes/latest.json';

function assertLibsPinWithoutFirebase(libs) {
  if (String(libs) < FIRST_LIBS_WITHOUT_FIREBASE) {
    throw new Error(
      `libs pin ${libs} points at a lib that still bundles Firebase; bump it to ${FIRST_LIBS_WITHOUT_FIREBASE} or newer`,
    );
  }
}

function parseLibsPin(text, label) {
  const raw = String(text || '').trim();
  const parts = raw.split(':');
  const libs = (parts[0] || '').trim();
  const monaco = (parts[1] || '').trim();
  if (parts.length !== 2 || !VERSION_RE.test(libs) || !VERSION_RE.test(monaco)) {
    throw new Error(
      `libs pin ${label} must be <libs>:<monaco> with 14-digit versions, got ${JSON.stringify(raw)}`,
    );
  }
  return { libs, monaco };
}

function acceptResolved(pin, source) {
  assertLibsPinWithoutFirebase(pin.libs);
  return { libs: pin.libs, monaco: pin.monaco, source };
}

async function resolveLibsVersion({
  env = process.env,
  fetchImpl = fetch,
  readFile = fs.readFileSync,
} = {}) {
  const fromEnv = String(env.COLLAB_LIBS_PIN || '').trim();
  if (fromEnv) {
    return acceptResolved(parseLibsPin(fromEnv, 'COLLAB_LIBS_PIN'), 'pin-env');
  }

  const pinFile = env.COLLAB_LIBS_PIN_FILE || DEFAULT_PIN_FILE;
  let fileText = null;
  try {
    fileText = readFile(pinFile, 'utf8');
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      const message = error && error.message ? error.message : String(error);
      throw new Error(`failed to read libs pin file ${pinFile}: ${message}`);
    }
  }
  if (fileText !== null) {
    return acceptResolved(parseLibsPin(String(fileText), pinFile), 'pin-file');
  }

  const url = env.CBE_LATEST_URL || DEFAULT_LATEST_URL;
  let payload;
  try {
    const response = await fetchImpl(url);
    if (response && response.ok === false) {
      throw new Error(`HTTP ${response.status}`);
    }
    payload = typeof response.json === 'function'
      ? await response.json()
      : JSON.parse(await response.text());
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    throw new Error(`failed to read latest.json at ${url}: ${message}`);
  }
  const libs = payload && typeof payload.libs === 'string' ? payload.libs.trim() : '';
  const monaco = payload && typeof payload.monaco === 'string' ? payload.monaco.trim() : '';
  if (!VERSION_RE.test(libs) || !VERSION_RE.test(monaco)) {
    throw new Error(
      `latest.json at ${url} is missing 14-digit libs/monaco (got libs=${JSON.stringify(libs)} monaco=${JSON.stringify(monaco)})`,
    );
  }
  return acceptResolved({ libs, monaco }, 'latest');
}

function readInstalledLibs(root) {
  const file = path.join(root, 'types', '.libs-pin');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    const message = error && error.message ? error.message : String(error);
    throw new Error(`cannot read installed libs stamp at ${file}: ${message}`);
  }
  return parseLibsPin(text, file);
}

function libFileUrls(pin) {
  const libsBase = `https://collab.codes/libs/${pin.libs}`;
  return {
    monacoDts: `https://collab.codes/monaco/${pin.monaco}/monaco.d.ts`,
    mlsDts: `${libsBase}/mls.d.ts`,
    mlsJs: `${libsBase}/mls.js`,
    mlsJsMap: `${libsBase}/mls.js.map`,
    globalDts: `${libsBase}/global.d.ts`,
  };
}

function installFiles(pin) {
  const urls = libFileUrls(pin);
  return [
    { dest: 'types/monaco.d.ts', url: urls.monacoDts, label: 'monaco definition' },
    { dest: 'types/mls.d.ts', url: urls.mlsDts, label: 'lib definition' },
    { dest: 'static/libs/mls.js', url: urls.mlsJs, label: 'runtime lib' },
    { dest: 'static/libs/mls.js.map', url: urls.mlsJsMap, label: 'runtime lib' },
    { dest: 'static/libs/mls.d.ts', url: urls.mlsDts, label: 'runtime lib' },
    { dest: 'static/libs/global.d.ts', url: urls.globalDts, label: 'runtime lib' },
  ];
}

function typeFiles(pin) {
  const urls = libFileUrls(pin);
  return [
    { dest: 'types/monaco.d.ts', url: urls.monacoDts },
    { dest: 'types/mls.d.ts', url: urls.mlsDts },
  ];
}

function correctionMessage(dest, pin) {
  return `corrected ${dest} to pin libs=${pin.libs} (did not match the pinned version)`;
}

function buildReleaseStamp({ releaseId, pin, clientId, versionRef, modelCommit, platformCommit }) {
  return {
    id: String(releaseId || ''),
    libs: pin.libs,
    monaco: pin.monaco,
    client: clientId || null,
    versionRef: versionRef || null,
    modelCommit: modelCommit || null,
    platformCommit: platformCommit || 'unknown',
  };
}

module.exports = {
  VERSION_RE,
  FIRST_LIBS_WITHOUT_FIREBASE,
  DEFAULT_PIN_FILE,
  DEFAULT_LATEST_URL,
  resolveLibsVersion,
  readInstalledLibs,
  assertLibsPinWithoutFirebase,
  libFileUrls,
  installFiles,
  typeFiles,
  correctionMessage,
  buildReleaseStamp,
};
