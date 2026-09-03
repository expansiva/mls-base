// vmApps.mjs — o app pm2 de um projeto na VM (multiprojeto).
//
// gb15 item 2. Modelo (o mesmo que o job do collab-sites já usa):
//
//   releases/<ts>              a release compilada
//   current-<id>  -> releases/<ts>     alias POR PROJETO (COLLAB_RELEASE_ALIAS)
//   pm2.apps.d/app<porta>.config.js    um arquivo por projeto
//   pm2.config.js                      agregador: lê tudo de pm2.apps.d/
//
// O `current` global continua a existir (o addNewVersion sempre o repõe), mas
// nenhum app multiprojeto aponta para ele: é o alias por projeto que decide o
// que cada porta serve. Um app pendurado no `current` passa a servir a release
// do ÚLTIMO push, seja de quem for — é o mesmo defeito de "uma URL, duas
// identidades", e por isso o app legado tem de sair quando o primeiro app por
// projeto entra.
//
// O conteúdo é gerado igual ao do collab-sites (buildPm2ConfigCommand em
// src/layer_3_usecases/publish.ts) para que publicar pelo sites e empurrar pelo
// git não fiquem trocando o arquivo um do outro.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appNameOf, projectIdToPort, releaseAliasOf } from './projectPorts.mjs';

export const APPS_DIR = 'pm2.apps.d';
export const PM2_CONFIG = 'pm2.config.js';

/** Conteúdo de pm2.apps.d/app<porta>.config.js. */
export function pm2AppConfig(projectId, port, remoteBase) {
  const appName = appNameOf(port);
  return `module.exports = {
  name: ${JSON.stringify(appName)},
  script: './dist/local/_102034_/l1/server/layer_1_external/transport/http/startServer.js',
  cwd: ${JSON.stringify(`${remoteBase}/${releaseAliasOf(projectId)}`)},
  instances: 2,
  exec_mode: 'cluster',
  watch: false,
  kill_timeout: 180000,
  env: {
    NODE_ENV: 'production',
    TZ: 'UTC',
    PORT: ${JSON.stringify(String(port))},
    COLLAB_PROJECT_ID: ${JSON.stringify(String(projectId))}
  },
  log_date_format: 'YYYY-MM-DDTHH:mm:ss',
  out_file: ${JSON.stringify(`${remoteBase}/logs/${appName}-out.log`)},
  error_file: ${JSON.stringify(`${remoteBase}/logs/${appName}-error.log`)},
  merge_logs: true
};
`;
}

/** Conteúdo do pm2.config.js agregador. */
export function pm2AggregatorConfig() {
  return `const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const dir = join(__dirname, 'pm2.apps.d');
const apps = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => name.endsWith('.config.js'))
      .flatMap((name) => require(join(dir, name)))
  : [];
module.exports = { apps };
`;
}

/** O pm2.config.js do root já é o agregador (e não o app único legado)? */
export function isAggregator(text) {
  return String(text).includes(`join(__dirname, '${APPS_DIR}')`);
}

/**
 * Garante o app pm2 do projeto. Devolve
 * `{ port, appName, wrote, replacedLegacy }` — `wrote` false quando nada mudou
 * (idempotente: rodar de novo não reescreve).
 */
export function ensureProjectApp({ root, projectId, remoteBase = root }) {
  const port = projectIdToPort(projectId);
  const appName = appNameOf(port);
  const appsDir = join(root, APPS_DIR);
  mkdirSync(appsDir, { recursive: true });

  const appPath = join(appsDir, `${appName}.config.js`);
  const appText = pm2AppConfig(projectId, port, remoteBase);
  let wrote = false;
  if (!existsSync(appPath) || readFileSync(appPath, 'utf8') !== appText) {
    writeFileSync(appPath, appText);
    wrote = true;
  }

  const rootPath = join(root, PM2_CONFIG);
  const existing = existsSync(rootPath) ? readFileSync(rootPath, 'utf8') : '';
  const replacedLegacy = Boolean(existing) && !isAggregator(existing);
  if (!isAggregator(existing)) {
    writeFileSync(rootPath, pm2AggregatorConfig());
    wrote = true;
  }

  return { port, appName, wrote, replacedLegacy };
}
