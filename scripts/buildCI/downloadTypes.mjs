// downloadTypes.mjs — baixa as definições globais (mls.d.ts, monaco.d.ts)
// para types/ na raiz do mls-base, nas versões apontadas pelo latest.json
// do collab.codes (mesma fonte do runInstallDevs.js / mls-ci).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LATEST_URL = 'https://s3.amazonaws.com/www.collab.codes/latest.json';

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response;
}

export async function downloadTypes({ root, log }) {
  const typesDir = join(root, 'types');
  await mkdir(typesDir, { recursive: true });

  const versions = await (await fetchOk(LATEST_URL)).json();
  log('types', `versões: monaco=${versions.monaco} libs=${versions.libs}`);

  const files = [
    { name: 'monaco.d.ts', url: `https://collab.codes/monaco/${versions.monaco}/monaco.d.ts` },
    { name: 'mls.d.ts', url: `https://collab.codes/libs/${versions.libs}/mls.d.ts` },
  ];

  for (const { name, url } of files) {
    const content = await (await fetchOk(url)).text();
    await writeFile(join(typesDir, name), content, 'utf8');
    log('types', `${name} atualizado (${content.length} bytes)`);
  }
}
