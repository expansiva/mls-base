// downloadTypes.mjs — baixa as definições globais (mls.d.ts, monaco.d.ts)
// para types/ na raiz do mls-base. A versão vem de resolveLibsVersion
// (freio ou latest.json), a mesma fonte do runInstallLibs.js.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { resolveLibsVersion, typeFiles } = require('../install/libsPin.js');

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
  return response;
}

export async function downloadTypes({ root, log }) {
  const typesDir = join(root, 'types');
  await mkdir(typesDir, { recursive: true });

  const pin = await resolveLibsVersion();
  log('types', `libs=${pin.libs} monaco=${pin.monaco} source=${pin.source}`);

  for (const { dest, url } of typeFiles(pin)) {
    const name = dest.split('/').pop();
    const content = await (await fetchOk(url)).text();
    await writeFile(join(typesDir, name), content, 'utf8');
    log('types', `${name} updated (${content.length} bytes)`);
  }
}
