// downloadTypes.mjs — baixa as definições globais (mls.d.ts, monaco.d.ts)
// para types/ na raiz do mls-base, na versão pinada em package.json collabLibs
// (mesma fonte do runInstallLibs.js). latest.json não é consultado.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { readLibsPin, typeFiles } = require('../install/libsPin.js');

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
  return response;
}

export async function downloadTypes({ root, log }) {
  const typesDir = join(root, 'types');
  await mkdir(typesDir, { recursive: true });

  const pin = readLibsPin(root);
  log('types', `pin: monaco=${pin.monaco} libs=${pin.libs}`);

  for (const { dest, url } of typeFiles(pin)) {
    const name = dest.split('/').pop();
    const content = await (await fetchOk(url)).text();
    await writeFile(join(typesDir, name), content, 'utf8');
    log('types', `${name} updated (${content.length} bytes)`);
  }
}
