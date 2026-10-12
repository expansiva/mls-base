import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DENO_JSON_NAME = 'deno.check.json';

// Deno 2.4.5: a chave "/_<id>_/" basta para o especificador absoluto; `.js`→`.ts` exige "unstable": ["sloppy-imports"].
export function loadMlsProjectDirs(root) {
  const dirs = [];
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('mls-') || !statSync(path.join(root, entry)).isDirectory()) continue;
    dirs.push(entry);
  }
  dirs.sort();
  return dirs;
}

export function buildImports(root) {
  const imports = {};
  for (const entry of loadMlsProjectDirs(root)) {
    const projectId = entry.slice('mls-'.length);
    imports[`/_${projectId}_/`] = `./${entry}/`;
  }
  return imports;
}

export function buildDenoConfig(root) {
  return {
    unstable: ['sloppy-imports'],
    nodeModulesDir: 'auto',
    imports: buildImports(root),
  };
}

export function renderDenoJson(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function writeDenoJson(root) {
  const dest = path.join(root, DENO_JSON_NAME);
  writeFileSync(dest, renderDenoJson(buildDenoConfig(root)));
  return dest;
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isMain()) {
  writeDenoJson(path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..'));
}
