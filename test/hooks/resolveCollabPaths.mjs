import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const monorepoRoot = path.resolve(import.meta.dirname, '../..');

function loadPathPrefixes() {
  const prefixes = {};

  for (const entry of readdirSync(monorepoRoot)) {
    if (!entry.startsWith('mls-') || !statSync(path.join(monorepoRoot, entry)).isDirectory()) continue;
    const projectId = entry.slice('mls-'.length);
    prefixes[`/_${projectId}_`] = path.join(monorepoRoot, entry);
  }

  return prefixes;
}

const pathPrefixes = loadPathPrefixes();

function buildCandidates(root, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const base = path.join(root, normalized);
  const hasExtension = path.extname(normalized).length > 0;
  const candidates = new Set([base]);

  if (normalized.endsWith('.js')) {
    candidates.add(path.join(root, normalized.replace(/\.js$/, '.ts')));
  }

  if (!hasExtension) {
    candidates.add(`${base}.ts`);
    candidates.add(`${base}.js`);
    candidates.add(path.join(base, 'index.ts'));
    candidates.add(path.join(base, 'index.js'));
  }

  return [...candidates];
}

function resolveCollabSpecifier(specifier) {
  for (const [prefix, root] of Object.entries(pathPrefixes)) {
    if (!specifier.startsWith(`${prefix}/`)) continue;

    const relativePath = specifier.slice(prefix.length + 1);

    for (const candidate of buildCandidates(root, relativePath)) {
      if (existsSync(candidate)) return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const mapped = resolveCollabSpecifier(specifier);
  if (mapped) {
    return nextResolve(mapped, context);
  }

  return nextResolve(specifier, context);
}