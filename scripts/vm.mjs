#!/usr/bin/env node
// scripts/vm.mjs — manutenção nomeada da VM remota, via collab-sites.
//
// O admin.collab.codes é administração, não desenvolvimento. O dev testa pela VM e por
// alguns endpoints do sites, com o mesmo token do publishGit. Quem fala com a AWS é o
// sites; este CLI não executa comando arbitrário e não leva credencial AWS.
//
//   node scripts/vm.mjs <projectId> platform-update
//   node scripts/vm.mjs <projectId> deps-update <ids…>
//   node scripts/vm.mjs <projectId> hold on|off
//   node scripts/vm.mjs <projectId> status

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { AUTH_EXIT, resolvePushToken } from './publishGitAuth.mjs';

const DEFAULT_SITES_BASE = 'https://sites.collab.codes';
const API_PREFIX = '/api/v1';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;
const DEPS_UPDATE_IDS_MSG = [
  'deps-update requires ids (e.g. node scripts/vm.mjs 102043 deps-update 100554 102021).',
  'With no ids, --reset-from-origin sweeps every armed mls-* and runs reset --hard — and the app repo is homed on the VM.',
].join(' ');

/** Erro de uso: sai com a mensagem, sem stack. Um tipo, e não o prefixo do texto —
 *  senão traduzir uma mensagem quebra silenciosamente a classificação. */
export class UsageError extends Error {}

export { AUTH_EXIT, DEPS_UPDATE_IDS_MSG };

export function sitesBaseUrl(env = process.env) {
  return (env.COLLAB_SITES_BASE_URL ?? DEFAULT_SITES_BASE).replace(/\/+$/u, '');
}

export function normalizeProjectId(value) {
  const match = /^(?:mls-)?(\d+)$/u.exec(String(value ?? '').trim());
  return match ? match[1] : '';
}

export function usage() {
  return [
    'usage: node scripts/vm.mjs <projectId> platform-update',
    '       node scripts/vm.mjs <projectId> deps-update <ids…>',
    '       node scripts/vm.mjs <projectId> hold on|off',
    '       node scripts/vm.mjs <projectId> status',
    '  projectId  resolved from the collab-sites inventory (never an instanceId — a noted id rots)',
    '  auth       the same token as publishGit (~/.collab/publishGit.json); header only, never argv',
    `  sites      COLLAB_SITES_BASE_URL (default ${DEFAULT_SITES_BASE})`,
  ].join('\n');
}

export function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length < 2) throw new UsageError(usage());
  const projectId = normalizeProjectId(args[0]);
  if (!projectId) throw new UsageError(`invalid projectId: ${args[0]}\n${usage()}`);
  const command = args[1];
  if (command === 'platform-update') {
    if (args.length !== 2) throw new UsageError(usage());
    return { projectId, command };
  }
  if (command === 'status') {
    if (args.length !== 2) throw new UsageError(usage());
    return { projectId, command };
  }
  if (command === 'hold') {
    const flag = String(args[2] ?? '').toLowerCase();
    if (args.length !== 3 || (flag !== 'on' && flag !== 'off')) {
      throw new UsageError(`hold requires on|off\n${usage()}`);
    }
    return { projectId, command, hold: flag === 'on' };
  }
  if (command === 'deps-update') {
    const ids = args.slice(2).map((raw) => normalizeProjectId(raw));
    if (ids.length === 0 || ids.some((id) => !id)) {
      throw new UsageError(DEPS_UPDATE_IDS_MSG);
    }
    return { projectId, command, ids };
  }
  throw new UsageError(`unknown command: ${command}\n${usage()}`);
}

export function findServerByProjectId(servers, projectId) {
  const id = normalizeProjectId(projectId);
  if (!id) return null;
  const matches = (servers ?? []).filter((server) => {
    if (normalizeProjectId(server.projectId) === id) return true;
    return (server.hostedProjects ?? []).some((project) => normalizeProjectId(project.projectId) === id);
  });
  return matches[0] ?? null;
}

export function commandUrl(baseUrl, serverId, command, commandId) {
  const base = `${String(baseUrl).replace(/\/+$/u, '')}${API_PREFIX}`;
  const id = encodeURIComponent(serverId);
  switch (command) {
    case 'list':
      return `${base}/servers`;
    case 'status':
      return `${base}/servers/${id}`;
    case 'platform-update':
      return `${base}/servers/${id}/platform/update`;
    case 'deps-update':
      return `${base}/servers/${id}/platform-deps/update`;
    case 'hold':
      return `${base}/servers/${id}/platform-deps/hold`;
    case 'command':
      return `${base}/servers/${id}/commands/${encodeURIComponent(commandId)}`;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function failAuth(text) {
  fail(
    `\n[publishGit] ${text}. Rode: pnpm publishGit login\n`,
    AUTH_EXIT,
  );
}

function log(message) {
  process.stderr.write(`[vm] ${message}\n`);
}

async function sitesRequest(url, { method = 'GET', token, body, fetchImpl = fetch } = {}) {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
  };
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetchImpl(url, { method, headers, body: payload });
  let json = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }
  return { ok: response.ok, status: response.status, payload: json };
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function statusView(server) {
  return {
    id: server.id,
    projectId: server.projectId,
    status: server.status,
    instanceId: server.instanceId ?? null,
    publicIp: server.publicIp ?? null,
    tempDomain: server.tempDomain ?? null,
    holdDepReset: server.holdDepReset === true,
    lastDepResetAt: server.lastDepResetAt ?? null,
    lastHeartbeatAt: server.lastHeartbeatAt ?? null,
    hostedProjects: (server.hostedProjects ?? []).map((project) => project.projectId),
  };
}

function isRemoteSuccess(command) {
  return command?.status === 'Success';
}

async function waitForCommand({ baseUrl, token, serverId, commandId, fetchImpl, now = Date.now, wait = sleep, timeoutMs, intervalMs }) {
  const deadline = now() + timeoutMs;
  while (true) {
    const url = commandUrl(baseUrl, serverId, 'command', commandId);
    const result = await sitesRequest(url, { token, fetchImpl });
    if (result.status === 401) failAuth('collab-sites rejected the token');
    if (!result.ok) {
      fail(`[vm] falha lendo comando ${commandId} (HTTP ${result.status}): ${result.payload.error ?? result.payload.msg ?? ''}`.trim());
    }
    const command = result.payload.command;
    if (command?.terminal) return command;
    if (now() >= deadline) fail(`[vm] timeout esperando comando ${commandId} no sites`);
    log(`comando ${commandId}: ${command?.status ?? 'pendente'}`);
    await wait(intervalMs);
  }
}

async function resolveToken(options) {
  const resolved = await resolvePushToken(options);
  if (!resolved.ok) {
    failAuth(resolved.reason || 'no stored session');
  }
  return resolved.token;
}

async function loadServer({ baseUrl, token, projectId, fetchImpl }) {
  const listed = await sitesRequest(commandUrl(baseUrl, '', 'list'), { token, fetchImpl });
  if (listed.status === 401) failAuth('collab-sites rejected the token');
  if (listed.status === 403) {
    fail('[vm] this token has no collab-sites:operator authority (admin.collab.codes is not the testing path)');
  }
  if (!listed.ok) {
    fail(`[vm] could not read the sites inventory (HTTP ${listed.status}): ${listed.payload.error ?? listed.payload.msg ?? ''}`.trim());
  }
  const server = findServerByProjectId(listed.payload.servers, projectId);
  if (!server) {
    fail(`[vm] no server in the sites inventory for project ${projectId} — a noted instanceId rots; the inventory is the source`);
  }
  return server;
}

export async function run(argv, {
  env = process.env,
  fetchImpl = fetch,
  home,
  now = Date.now,
  wait = sleep,
  stdout = (value) => printJson(value),
} = {}) {
  const parsed = parseArgs(argv);
  const baseUrl = sitesBaseUrl(env);
  const token = await resolveToken({ env, home, fetchImpl });
  const server = await loadServer({ baseUrl, token, projectId: parsed.projectId, fetchImpl });

  if (parsed.command === 'status') {
    stdout(statusView(server));
    return 0;
  }

  if (parsed.command === 'hold') {
    const result = await sitesRequest(commandUrl(baseUrl, server.id, 'hold'), {
      method: 'POST',
      token,
      body: { hold: parsed.hold },
      fetchImpl,
    });
    if (result.status === 401) failAuth('collab-sites rejected the token');
    if (!result.ok) fail(`[vm] hold falhou (HTTP ${result.status}): ${result.payload.error ?? result.payload.msg ?? ''}`.trim());
    stdout(statusView(result.payload.server ?? server));
    return 0;
  }

  const body = parsed.command === 'deps-update' ? { projectIds: parsed.ids } : undefined;
  const queued = await sitesRequest(commandUrl(baseUrl, server.id, parsed.command), {
    method: 'POST',
    token,
    body,
    fetchImpl,
  });
  if (queued.status === 401) failAuth('collab-sites rejected the token');
  if (!queued.ok) {
    fail(`[vm] ${parsed.command} falhou (HTTP ${queued.status}): ${queued.payload.error ?? queued.payload.msg ?? ''}`.trim());
  }
  const commandId = queued.payload.commandId;
  if (!commandId) fail('[vm] o sites enfileirou sem commandId — nada para esperar');
  log(`${parsed.command} enfileirado commandId=${commandId}; esperando o SSM`);
  const command = await waitForCommand({
    baseUrl,
    token,
    serverId: server.id,
    commandId,
    fetchImpl,
    now,
    wait,
    timeoutMs: Number(env.COLLAB_VM_POLL_TIMEOUT_MS ?? POLL_TIMEOUT_MS),
    intervalMs: Number(env.COLLAB_VM_POLL_INTERVAL_MS ?? POLL_INTERVAL_MS),
  });
  stdout({
    commandId: command.commandId,
    status: command.status,
    responseCode: command.responseCode,
    stdout: command.stdout,
    stderr: command.stderr,
  });
  if (!isRemoteSuccess(command)) {
    fail(`[vm] comando remoto ${command.status ?? 'failed'} (responseCode=${command.responseCode ?? '?'})`);
  }
  return 0;
}

async function main() {
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UsageError) fail(message);
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
}

function invokedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
  } catch {
    return false;
  }
}

if (invokedAsMain()) {
  main();
}
