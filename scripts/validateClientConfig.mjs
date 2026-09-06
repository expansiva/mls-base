#!/usr/bin/env node
// Publish-time validation of the client l5/config.json.
// Called from publishGit (Mac, early) and gitPostReceive (VM — the necessary
// place: collab-sites *Build release* invokes the hook without publishGit).
// Both paths WARN and still cut the release (Wagner 06/09). The standalone
// CLI still exits 1 so a human running it by hand gets a red.
// Mirrors runtime rules in
// _102034_/l1/server/layer_1_external/config/projectConfig.ts (validateProjectsConfig).
// Usage: node scripts/validateClientConfig.mjs <path-to-config.json>

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateClientConfig(config) {
  const errors = [];
  const projects = Object.entries(config?.projects ?? {});
  const byType = (type) => projects.filter(([, p]) => p?.type === type);

  if (byType('client').length !== 1) {
    errors.push(`must declare exactly 1 project of type "client" (found ${byType('client').length})`);
  }
  if (byType('master frontend').length === 0) {
    errors.push('must declare at least 1 project of type "master frontend"');
  }
  if (byType('master backend').length === 0) {
    errors.push('must declare at least 1 project of type "master backend"');
  }
  if (!config?.defaultProjectId || !config?.projects?.[config.defaultProjectId]) {
    errors.push(`defaultProjectId "${config?.defaultProjectId}" is not declared in projects`);
  }
  if (!config?.shellTemplates?.spa) errors.push('shellTemplates.spa is required');

  const [clientEntry] = byType('client');
  if (clientEntry) {
    const [, client] = clientEntry;
    const modules = client.modules ?? [];
    if (modules.length === 0) errors.push('client project declares no modules');
    for (const mod of modules) {
      if (!mod.backendControllers && !mod.backendRouter) {
        errors.push(`module "${mod.moduleId}" has no backendControllers/backendRouter`);
      }
      if (!mod.frontend?.pages?.length) errors.push(`module "${mod.moduleId}" has no frontend.pages`);
    }
    if (!(client.persistenceModules ?? []).length) {
      errors.push('client project declares no persistenceModules');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateClientConfigFile(configPath) {
  if (!configPath) {
    return { ok: false, errors: ['usage: node validateClientConfig.mjs <config.json>'], path: '' };
  }
  if (!existsSync(configPath)) {
    return { ok: false, errors: ['l5/config.json is missing'], path: configPath };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      errors: [`invalid json: ${error.message}`],
      path: configPath,
      invalidJson: error.message,
    };
  }
  const result = validateClientConfig(config);
  return { ...result, path: configPath };
}

export function formatClientConfigCli(result) {
  if (result.invalidJson) return `invalid json at ${result.path}: ${result.invalidJson}`;
  if (!result.ok) {
    const lines = [`config validation FAILED for ${result.path}:`];
    for (const err of result.errors) lines.push(`  - ${err}`);
    return lines.join('\n');
  }
  return `config validation OK: ${result.path}`;
}

export function formatClientConfigWarn(result, prefix) {
  if (result.ok) return `${prefix} clientConfig: OK`;
  const lines = result.errors.map((err) => `  - ${err}`);
  return `${prefix} clientConfig: WARN (does not block):\n${lines.join('\n')}`;
}

export function clientConfigMarker(result) {
  return result.ok ? '##clientConfig ok##' : `##clientConfig warn n=${result.errors.length}##`;
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
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('usage: node validateClientConfig.mjs <config.json>');
    process.exit(1);
  }
  const result = validateClientConfigFile(configPath);
  if (result.invalidJson) {
    console.error(`invalid json at ${configPath}: ${result.invalidJson}`);
    process.exit(1);
  }
  if (!result.ok) {
    console.error(formatClientConfigCli(result));
    process.exit(1);
  }
  console.log(formatClientConfigCli(result));
}
