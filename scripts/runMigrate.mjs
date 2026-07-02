#!/usr/bin/env node
// `pnpm migrate` (VM): runs the master backend's migrate from the ACTIVE release
// (cwd = current), so config.json and .env resolve exactly as the server sees them.
// The master backend id is read from the composed config.json — agnostic to ids.

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/..
const current = join(ROOT, 'current');

if (!existsSync(join(current, 'config.json'))) {
  console.error(`no active release at ${current} (run a publish first)`);
  process.exit(1);
}

// Keep the release .env in sync with the stable one at the mls-base root.
if (existsSync(join(ROOT, '.env'))) copyFileSync(join(ROOT, '.env'), join(current, '.env'));

const config = JSON.parse(readFileSync(join(current, 'config.json'), 'utf8'));
const masterBackendId = Object.entries(config.projects ?? {})
  .find(([, p]) => p?.type === 'master backend')?.[0];
if (!masterBackendId) {
  console.error('no master backend declared in config.json');
  process.exit(1);
}

const migrateJs = join(current, 'dist', 'local', `_${masterBackendId}_`, 'l1', 'scripts', 'migrate.js');
if (!existsSync(migrateJs)) {
  console.error(`migrate script not found: ${migrateJs}`);
  process.exit(1);
}

execSync(`node '${migrateJs}'`, { cwd: current, stdio: 'inherit' });
