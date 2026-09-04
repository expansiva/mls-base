'use strict';
const fs = require('fs');
const path = require('path');
const {
  readLibsPin,
  installFiles,
  correctionMessage,
} = require('./libsPin.js');

async function downloadBuffer(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} at ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function readExisting(dest) {
  try {
    return fs.readFileSync(dest);
  } catch {
    return null;
  }
}

async function runDownload({
  root = process.cwd(),
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available');
  }
  const pin = readLibsPin(root);
  fs.mkdirSync(path.join(root, 'types'), { recursive: true });
  fs.mkdirSync(path.join(root, 'static', 'libs'), { recursive: true });

  log(`Get version files (pin libs=${pin.libs} monaco=${pin.monaco})`);

  let lastLabel = '';
  for (const file of installFiles(pin)) {
    const dest = path.join(root, file.dest);
    const previous = readExisting(dest);
    const next = await downloadBuffer(file.url, fetchImpl);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, next);
    if (previous && !previous.equals(next)) {
      log(correctionMessage(file.dest, pin));
    }
    if (file.label !== lastLabel) {
      log(`Get ${file.label}`);
      lastLabel = file.label;
    }
  }
}

module.exports = { runDownload };

// Run the download when invoked directly (postInstall and the publish refresh),
// while still allowing `require()` to only import runDownload.
if (require.main === module) {
  runDownload().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
