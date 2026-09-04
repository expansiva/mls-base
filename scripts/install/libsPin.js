'use strict';
// The mls lib (types + runtime js) is pinned in package.json "collabLibs".
// latest.json is not consulted: bumping the lib is a reviewed commit.
const fs = require('fs');
const path = require('path');

const VERSION_RE = /^\d{14}$/u;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readLibsPin(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath} — cannot read collabLibs pin`);
  }
  let pkg;
  try {
    pkg = readJson(pkgPath);
  } catch (error) {
    throw new Error(`package.json at ${pkgPath} is not JSON: ${error.message}`);
  }
  const pin = pkg && pkg.collabLibs;
  const libs = pin && typeof pin.libs === 'string' ? pin.libs.trim() : '';
  const monaco = pin && typeof pin.monaco === 'string' ? pin.monaco.trim() : '';
  if (!VERSION_RE.test(libs) || !VERSION_RE.test(monaco)) {
    throw new Error(
      'collabLibs.libs / collabLibs.monaco missing from package.json — the lib is pinned, not floating. ' +
        'Set both to 14-digit CDN timestamps and commit.',
    );
  }
  return { libs, monaco };
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

function buildReleaseStamp({ releaseId, pin, clientId, versionRef, modelCommit }) {
  return {
    id: String(releaseId || ''),
    libs: pin.libs,
    monaco: pin.monaco,
    client: clientId || null,
    versionRef: versionRef || null,
    modelCommit: modelCommit || null,
  };
}

module.exports = {
  VERSION_RE,
  readLibsPin,
  libFileUrls,
  installFiles,
  typeFiles,
  correctionMessage,
  buildReleaseStamp,
};
