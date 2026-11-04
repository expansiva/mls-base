// projectPorts.mjs — a porta de um projeto na VM, em UM lugar só.
//
// gb15 item 2: o job do collab-sites e o hook do git precisam concordar sobre
// qual porta é de qual projeto — se divergirem, dois apps disputam a mesma
// porta ou o nginx aponta para o vazio. A regra é a do
// collab-sites/src/layer_3_usecases/sites.ts:265 (projectIdToPort); esta é a
// cópia canônica do lado da VM, e é ela que o caminho git usa.
//
// Regra: 2000 + os três últimos dígitos do id. 102043 -> 2043.

export const DEFAULT_MLS_BASE = '/data/mls-base';

export class ProjectPortError extends Error {}

/** `--root`, senão MLS_BASE_DIR, senão COLLAB_MLS_BASE, senão /data/mls-base. */
export function resolveMlsBaseRoot({ rootFlag, env = process.env } = {}) {
  const raw = String(rootFlag || env.MLS_BASE_DIR || env.COLLAB_MLS_BASE || DEFAULT_MLS_BASE).trim();
  return raw.replace(/\/+$/u, '') || DEFAULT_MLS_BASE;
}

/** Árvore nova: …/app<id>/mls-base (o current é do projeto). */
export function isProjectTree(root) {
  return /(?:^|\/)app\d+\/mls-base\/?$/u.test(String(root).replaceAll('\\', '/'));
}

export function projectIdToPort(projectId) {
  const id = String(projectId).trim();
  if (!/^\d+$/u.test(id)) throw new ProjectPortError('projectId must contain only digits');
  const port = 2000 + Number(id.slice(-3));
  if (port < 2000 || port > 2999) throw new ProjectPortError('Calculated port is outside 2000-2999');
  return port;
}

/** Nome do app no pm2 e do arquivo em pm2.apps.d/ — `app<porta>`. */
export function appNameOf(port) {
  return `app${port}`;
}

/** O release que o app de um projeto serve. Árvore nova: `current`; antiga: `current-<id>`. */
export function releaseAliasOf(projectId, root) {
  if (root && isProjectTree(root)) return 'current';
  return `current-${String(projectId).trim()}`;
}
