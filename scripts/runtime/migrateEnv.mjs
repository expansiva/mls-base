// One choice of migrate environment for the release (`addNewVersion`) and for
// `pnpm migrate` (`runMigrate`). The URL stays in the env object — never in the
// command line and never in the log line.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { databaseUrlTestFor, declaredTestMode } from './vmApps.mjs';

/** Client app in a release `config.json`, the same rule as `clientOf`. */
export function clientIdOfConfig(config) {
  const found = Object.entries(config?.projects ?? {}).find(([, project]) => project?.type === 'client');
  const id = found?.[0] ?? '';
  return /^\d+$/u.test(id) ? id : '';
}

/** `appEnv` from `l5/project.json`. Missing or unreadable is `''`. */
export function appEnvOf(root, clientId) {
  if (!/^\d+$/u.test(String(clientId ?? ''))) return '';
  const path = join(root, `mls-${clientId}`, 'l5', 'project.json');
  if (!existsSync(path)) return '';
  try {
    const appEnv = JSON.parse(readFileSync(path, 'utf8')).appEnv;
    return typeof appEnv === 'string' ? appEnv : '';
  } catch {
    return '';
  }
}

/** Extra env for migrate. A test mode with no test URL is `undefined` (the caller must stop). */
export function envForMigrate(root, clientId) {
  if (!(clientId && /^\d+$/u.test(clientId) && declaredTestMode(root, clientId))) return undefined;
  const url = databaseUrlTestFor(root);
  if (!url) return undefined;
  return { DATABASE_URL_TEST: url };
}

/** One value of a `.env` file (`KEY=value`, no quotes handling beyond trimming), or `''`. Used for the database name only. */
export function envFileValue(path, key) {
  if (!existsSync(path)) return '';
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0 && trimmed.slice(0, eq).trim() === key) return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/gu, '');
    }
  } catch { /* unreadable: the name falls back to the process env */ }
  return '';
}

/** Database name only. Never the user, the password, or the connection string. */
export function databaseNameOf(migrateEnv, processEnv) {
  const url = migrateEnv?.DATABASE_URL_TEST || '';
  if (url) {
    try {
      const name = new URL(url).pathname.replace(/^\//u, '');
      if (name) return name;
    } catch { /* unreadable URL: fall through */ }
  }
  const fromPg = String(processEnv?.PGDATABASE ?? '').trim();
  return fromPg || 'default';
}

/**
 * Decide the manual migrate. Does not run it.
 * `refused` is a test-mode app with no test URL: the default connection is not a fallback.
 */
export function planManualMigrate(root, config, processEnv = process.env) {
  const clientId = clientIdOfConfig(config);
  const appEnv = clientId ? appEnvOf(root, clientId) : '';
  const testMode = Boolean(clientId) && declaredTestMode(root, clientId);
  const migrateEnv = clientId ? envForMigrate(root, clientId) : undefined;
  if (testMode && !migrateEnv?.DATABASE_URL_TEST) {
    return {
      refused: true,
      clientId,
      appEnv,
      message: `migrate refused: project ${clientId} appEnv=${appEnv || 'test'} has no test database URL. The default connection is not used.`,
    };
  }
  const database = databaseNameOf(migrateEnv, processEnv);
  return {
    refused: false,
    clientId,
    appEnv,
    database,
    migrateEnv,
    line: `migrate project=${clientId || '-'} appEnv=${appEnv || '-'} database=${database}`,
  };
}
