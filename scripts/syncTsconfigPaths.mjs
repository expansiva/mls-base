#!/usr/bin/env node
// Workspace tsconfig.json "paths" must list every mls-<id> that has
// l5/config.json. A missing entry makes every `/_<id>_/` import a TS2307
// that looks like an agent generation error. This is a setup problem.
//
// Mac (publishGit, projectInit): this script writes the versioned
// tsconfig.json. There the repo is the source and the entry is committed
// with the project.
//
// VM compile (addNewVersion) writes tsconfig.vm.json from the projects on
// disk and never touches this file (gb63). The typeCheck gate
// (typeCheckRun writeLayerTsconfig) copies `paths` from vmTsconfigRel —
// the generated file when it exists, this versioned file when it does not.
// gitPostReceive refreshes tsconfig.vm.json and does not call this writer
// (a dirty versioned tree blocks pull --ff-only).
//
// Usage:
//   node scripts/syncTsconfigPaths.mjs            # add missing entries
//   node scripts/syncTsconfigPaths.mjs --check    # exit 1 if any missing
//   node scripts/syncTsconfigPaths.mjs --root DIR

import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS_BLOCK = /"paths"\s*:\s*\{[^}]*\}/;

export function pathIdsOf(text) {
  return [...String(text).matchAll(/"\/_(\d+)_\/\*"/g)].map((m) => m[1]);
}

export function pathLabelsOf(text) {
  const labels = {};
  const lineRe = /"\/_(\d+)_\/\*"\s*:\s*\[[^\]]*\]\s*,?\s*\/\/\s*(.+)/g;
  let match;
  while ((match = lineRe.exec(text)) !== null) labels[match[1]] = match[2].trim();
  return labels;
}

/** mls-<digits> directories that carry l5/config.json — a real client, not an empty folder. */
export function discoverConfiguredProjectIds(root) {
  return readdirSync(root)
    .filter((name) => /^mls-\d+$/.test(name))
    .filter((name) => {
      const dir = join(root, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, 'l5', 'config.json'));
    })
    .map((name) => name.slice('mls-'.length))
    .sort();
}

export function missingTsconfigPathIds(root) {
  const text = readFileSync(join(root, 'tsconfig.json'), 'utf8');
  const have = new Set(pathIdsOf(text));
  return discoverConfiguredProjectIds(root).filter((id) => !have.has(id));
}

export function formatMissingTsconfigPathsMessage(ids) {
  const list = ids.map((id) => `mls-${id} (l5/config.json) → "/_${id}_/*": ["./mls-${id}/*"]`).join('\n  ');
  return [
    'tsconfig.json paths is missing a project that exists on disk.',
    'This is a setup error, not an agent error. Imports `/_<id>_/*` resolve',
    'through compilerOptions.paths; without a mapping, tsc reports TS2307',
    "on the project's own files and the agent looks broken.",
    'Add the mapping: node scripts/syncTsconfigPaths.mjs',
    `Missing:\n  ${list}`,
  ].join('\n');
}

export function insertPathEntries(text, idsToAdd) {
  if (!PATHS_BLOCK.test(text)) {
    throw new Error('Could not find a "paths" block in tsconfig.json');
  }
  if (!idsToAdd.length) return text;
  const labels = pathLabelsOf(text);
  const ids = [...pathIdsOf(text)];
  for (const id of idsToAdd) {
    if (!ids.includes(id)) ids.push(id);
  }
  const indent = ' '.repeat(12);
  const entries = ids.map((id, i) => {
    const comma = i < ids.length - 1 ? ',' : '';
    const label = labels[id] ? ` // ${labels[id]}` : '';
    return `${indent}"/_${id}_/*": ["./mls-${id}/*"]${comma}${label}`;
  });
  const block = `"paths": {\n${entries.join('\n')}\n        }`;
  return text.replace(PATHS_BLOCK, () => block);
}

/**
 * Append missing `/_<id>_/*` entries. Does not remove paths whose folder is gone.
 *
 * Mac writer of the versioned tsconfig.json: there the repo is the source and
 * the entry is committed with the project. The VM hook must not call this —
 * the VM is a checkout that has to stay clean for `git pull --ff-only`
 * (Atualizar plataforma).
 */
export function addMissingTsconfigPaths(root) {
  const missing = missingTsconfigPathIds(root);
  if (missing.length === 0) return [];
  const file = join(root, 'tsconfig.json');
  writeFileSync(file, insertPathEntries(readFileSync(file, 'utf8'), missing));
  return missing;
}

export function parseSyncArgs(argv, defaultRoot = DEFAULT_ROOT) {
  let root = defaultRoot;
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--root' && argv[i + 1]) { root = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
  }
  return { root: resolve(root), check };
}

function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  const real = (path) => { try { return realpathSync(path); } catch { return resolve(path); } };
  try {
    return real(fileURLToPath(import.meta.url)) === real(entry);
  } catch {
    return false;
  }
}

if (invokedAsMain()) {
  const { root, check } = parseSyncArgs(process.argv.slice(2));
  const missing = missingTsconfigPathIds(root);
  if (check) {
    if (missing.length) {
      process.stderr.write(`${formatMissingTsconfigPathsMessage(missing)}\n`);
      process.exit(1);
    }
    process.exit(0);
  }
  const added = addMissingTsconfigPaths(root);
  if (added.length) {
    process.stderr.write(
      `tsconfig.json paths: added ${added.map((id) => `"/_${id}_/*"`).join(', ')} — setup mapping, not an agent error.\n`,
    );
  }
}
