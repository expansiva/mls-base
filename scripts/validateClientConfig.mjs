#!/usr/bin/env node
// Publish-time validation of the composed client config.json (fail fast on the dev
// machine, before rsync). Mirrors the runtime rules in
// _102034_/l1/server/layer_1_external/config/projectConfig.ts (validateProjectsConfig).
// Usage: node scripts/validateClientConfig.mjs <path-to-config.json>

import { readFileSync } from 'node:fs';

const configPath = process.argv[2];
if (!configPath) { console.error('usage: node validateClientConfig.mjs <config.json>'); process.exit(1); }

const errors = [];
let config;
try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch (e) {
  console.error(`invalid json at ${configPath}: ${e.message}`); process.exit(1);
}

const projects = Object.entries(config.projects ?? {});
const byType = (type) => projects.filter(([, p]) => p?.type === type);

if (byType('client').length !== 1) errors.push(`must declare exactly 1 project of type "client" (found ${byType('client').length})`);
if (byType('master frontend').length === 0) errors.push('must declare at least 1 project of type "master frontend"');
if (byType('master backend').length === 0) errors.push('must declare at least 1 project of type "master backend"');
if (!config.defaultProjectId || !config.projects?.[config.defaultProjectId]) errors.push(`defaultProjectId "${config.defaultProjectId}" is not declared in projects`);
if (!config.publication?.targets || Object.keys(config.publication.targets).length === 0) errors.push('must declare at least one publication target');
else if (!config.publication.targets[config.publication.defaultTarget]) errors.push(`publication.defaultTarget "${config.publication.defaultTarget}" is not declared`);
if (!config.shellTemplates?.spa) errors.push('shellTemplates.spa is required');

const [clientEntry] = byType('client');
if (clientEntry) {
  const [, client] = clientEntry;
  const modules = client.modules ?? [];
  if (modules.length === 0) errors.push('client project declares no modules');
  for (const mod of modules) {
    if (!mod.backendControllers && !mod.backendRouter) errors.push(`module "${mod.moduleId}" has no backendControllers/backendRouter`);
    if (!mod.frontend?.pages?.length) errors.push(`module "${mod.moduleId}" has no frontend.pages`);
  }
  if (!(client.persistenceModules ?? []).length) errors.push('client project declares no persistenceModules');
}

if (errors.length) {
  console.error(`config validation FAILED for ${configPath}:`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(`config validation OK: ${configPath}`);
