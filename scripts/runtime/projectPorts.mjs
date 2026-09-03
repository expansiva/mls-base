// projectPorts.mjs — a porta de um projeto na VM, em UM lugar só.
//
// gb15 item 2: o job do collab-sites e o hook do git precisam concordar sobre
// qual porta é de qual projeto — se divergirem, dois apps disputam a mesma
// porta ou o nginx aponta para o vazio. A regra é a do
// collab-sites/src/layer_3_usecases/sites.ts:265 (projectIdToPort); esta é a
// cópia canônica do lado da VM, e é ela que o caminho git usa.
//
// Regra: 2000 + os três últimos dígitos do id. 102043 -> 2043.

export class ProjectPortError extends Error {}

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

/** O release que o app de um projeto serve — o alias por projeto, não o `current` global. */
export function releaseAliasOf(projectId) {
  return `current-${String(projectId).trim()}`;
}
