import { existsSync, readdirSync, statSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const monorepoRoot = path.resolve(import.meta.dirname, '..');

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
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const mapped = resolveCollabSpecifier(request);
  if (mapped) {
    return mapped;
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

register(new URL('./hooks/resolveCollabPaths.mjs', import.meta.url), import.meta.url);