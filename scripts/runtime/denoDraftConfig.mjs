import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadMlsProjectDirs, renderDenoJson } from '../denoImportMap.mjs';

// Sem nodeModulesDir: o node_modules é o da plataforma, resolvido por caminho.
function withTrailingSep(dir) {
  return dir.endsWith(path.sep) ? dir : dir + path.sep;
}

export function buildDraftImports({ base, slug, clientProjectId }) {
  const root = path.resolve(base);
  const clientId = String(clientProjectId);
  const imports = {};

  for (const entry of loadMlsProjectDirs(root)) {
    const projectId = entry.slice('mls-'.length);
    const target = projectId === clientId
      ? path.join(root, 'drafts', slug, entry)
      : path.join(root, entry);
    imports[`/_${projectId}_/`] = withTrailingSep(target);
  }

  const clientKey = `/_${clientId}_/`;
  if (!imports[clientKey]) {
    imports[clientKey] = withTrailingSep(path.join(root, 'drafts', slug, `mls-${clientId}`));
  }

  const sorted = {};
  for (const key of Object.keys(imports).sort()) sorted[key] = imports[key];
  return sorted;
}

export function buildDraftDenoConfig(input) {
  return {
    unstable: ['sloppy-imports'],
    imports: buildDraftImports(input),
  };
}

export function writeDraftDenoConfig({ base, slug, clientProjectId }) {
  const root = path.resolve(base);
  const destDir = path.join(root, 'drafts', slug);
  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'deno.json');
  const text = renderDenoJson(buildDraftDenoConfig({ base: root, slug, clientProjectId }));
  writeFileSync(dest, text);
  return dest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, slug, clientProjectId] = process.argv.slice(2);
  if (!base || !slug || !clientProjectId) {
    console.error('usage: node denoDraftConfig.mjs <base> <slug> <clientProjectId>');
    process.exit(1);
  }
  console.log(writeDraftDenoConfig({ base, slug, clientProjectId }));
}
