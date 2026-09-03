#!/usr/bin/env node
// scripts/publishGitAuth.mjs — a identidade do publish por git (gb50).
//
// POR QUE EXISTE
// Numa VM remota a porta 22 fica fechada e o SSM identifica a máquina/IAM, não a pessoa no collab.
// O transporte passou a ser smart HTTP (`https://<vm>/git/mls-<id>.git`), e quem identifica é o JWT do
// collab-auth — o MESMO token que a porta do app já valida. Este arquivo é só a parte do lado do
// desenvolvedor: onde o token mora, se ainda vale, e como o git o encontra.
//
// O TOKEN MORA FORA DO REPO, na home (`~/.collab/publishGit.json`, modo 600). Não é preciosismo: o
// `mls-base` é um repositório que a gente empurra para a VM a cada publish, e um segredo dentro dele
// depende de um `.gitignore` continuar certo para sempre. Fora do repo não há o que dar errado.
//
// GIT NÃO MANDA BEARER. Um credential helper devolve usuário/senha e o git manda
// `Authorization: Basic base64(user:senha)` — o formato do PAT do GitHub, com o token na SENHA. É o que
// o `/git/` do 102034 lê primeiro (`tokenFromGitRequest`).

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/** Exit code reservado para "faça login" — o publish usa isto para não parecer erro de build. */
export const AUTH_EXIT = 3;
const TOKEN_USERNAME = 'collab';

export function tokenStorePath(home = homedir()) {
  return join(home, '.collab', 'publishGit.json');
}

/**
 * Payload de um JWT, sem verificar assinatura.
 *
 * Verificar aqui seria teatro: quem valida é o servidor, com a JWKS do collab-auth. O que o cliente
 * precisa saber é outra coisa — "isto parece um token e ainda não expirou?" — para dizer "rode login"
 * antes de gastar um push inteiro.
 */
export function parseJwtPayload(token) {
  const parts = String(token ?? '').trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/gu, '+').replace(/_/gu, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/** `ok` | `expired` | `invalid`, mais o e-mail quando dá para ler. */
export function tokenState(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = parseJwtPayload(token);
  if (!payload) return { state: 'invalid', email: '', expiresAt: '' };
  const email = typeof payload.email === 'string' ? payload.email : '';
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const expiresAt = exp ? new Date(exp * 1000).toISOString() : '';
  if (!exp) return { state: 'invalid', email, expiresAt };
  // `grace_until` é a tolerância que o resto da plataforma já respeita; um token dentro dela ainda é
  // aceito pelo servidor, então não é aqui que ele morre.
  const grace = typeof payload.grace_until === 'number' ? payload.grace_until : exp;
  return { state: nowSeconds <= Math.max(exp, grace) ? 'ok' : 'expired', email, expiresAt };
}

/**
 * A sessão gravada: access + refresh + validade.
 *
 * Lê TAMBÉM o formato que o gb50 gravava (`{token}` sozinho, sem refresh): quem já fez login por
 * colagem não precisa refazer nada — a sessão vale até o access expirar, e aí o login por redirect
 * grava o par completo. Migração silenciosa é melhor que um erro pedindo `login` de novo.
 */
export function readSession({ home = homedir(), env = process.env } = {}) {
  if (env.COLLAB_PUBLISH_TOKEN) {
    const access = env.COLLAB_PUBLISH_TOKEN.trim();
    return { access, refresh: '', ...tokenState(access), fromEnv: true };
  }
  const path = tokenStorePath(home);
  if (!existsSync(path)) return { access: '', refresh: '', state: 'invalid', email: '', expiresAt: '' };
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    const access = String(stored.access ?? stored.token ?? '').trim();
    const refresh = String(stored.refresh ?? '').trim();
    return { access, refresh, ...tokenState(access) };
  } catch {
    return { access: '', refresh: '', state: 'invalid', email: '', expiresAt: '' };
  }
}

/** Só o access — o que o credential helper devolve como senha. */
export function readToken(options = {}) {
  return readSession(options).access;
}

export function writeSession({ access, refresh = '' }, { home = homedir() } = {}) {
  const path = tokenStorePath(home);
  mkdirSync(dirname(path), { recursive: true });
  const { email, expiresAt } = tokenState(access);
  const body = { access, refresh, email, expiresAt, savedAt: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows não tem o modo; o arquivo continua na home do usuário.
  }
  return { path, email, expiresAt };
}

/** Compatibilidade com o gb50: gravar só o access, sem refresh (o caminho `--paste`). */
export function writeToken(token, options = {}) {
  return writeSession({ access: token, refresh: '' }, options);
}

/** A base do collab-auth. Env para poder apontar um servidor de teste sem tocar em código. */
export function authBaseUrl(env = process.env) {
  return (env.COLLAB_AUTH_BASE_URL ?? 'https://auth.collab.codes').replace(/\/+$/u, '');
}

/**
 * Renovar 60s ANTES de expirar, não no instante exato.
 *
 * Um push grande leva minutos; renovar em cima da hora deixaria o token morrer no meio da
 * transferência, e o git não repete o desafio no meio de um POST.
 */
export function needsRefresh(expSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!expSeconds) return true;
  return expSeconds <= nowSeconds + 60;
}

/** O `exp` de um access token, em segundos, ou 0 quando não há. */
export function expOf(token) {
  const payload = parseJwtPayload(token);
  return payload && typeof payload.exp === 'number' ? payload.exp : 0;
}

async function postJson(url, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { ok: response.ok, status: response.status, payload };
}

/**
 * Troca o refresh por um access novo.
 *
 * O `/auth/token/refresh` do collab-auth devolve **só** o access — o refresh continua o mesmo, com
 * validade de 30 dias (`refreshTokenExpiresAt`, default `refreshTokenExpiryDays`). Por isso o
 * arquivo não é reescrito com um refresh novo: não existe um.
 */
export async function refreshAccess(refresh, { env = process.env, fetchImpl = fetch } = {}) {
  if (!refresh) return { ok: false, status: 0, access: '', reason: 'sem refresh token guardado' };
  const { ok, status, payload } = await postJson(
    `${authBaseUrl(env)}/auth/token/refresh`,
    { refresh_token: refresh },
    fetchImpl,
  );
  const access = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!ok || !access) {
    return { ok: false, status, access: '', reason: payload.msg || `refresh recusado (HTTP ${status})` };
  }
  return { ok: true, status, access, reason: '' };
}

/** Troca uma API key (`cak_…`) por um JWT curto de serviço (gb53, `POST /auth/token/exchange`). */
export async function exchangeApiKey(apiKey, { env = process.env, fetchImpl = fetch } = {}) {
  const { ok, status, payload } = await postJson(
    `${authBaseUrl(env)}/auth/token/exchange`,
    { api_key: apiKey },
    fetchImpl,
  );
  const access = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!ok || !access) {
    return { ok: false, status, access: '', reason: payload.msg || `chave recusada (HTTP ${status})` };
  }
  return { ok: true, status, access, reason: '' };
}

/**
 * A URL https do repo do projeto na VM, quando o perfil declara `GIT_URL`.
 *
 * `GIT_URL` aceita o domínio (`https://102043.collabcodes.com`) ou já com o prefixo
 * (`https://102043.collabcodes.com/git/`): as duas formas aparecem em conf escrita à mão.
 */
export function httpsUrl(gitUrl, projectName) {
  const base = String(gitUrl ?? '').trim().replace(/\/+$/u, '');
  if (!base) return '';
  const withGit = /\/git$/u.test(base) ? base : `${base}/git`;
  return `${withGit}/${projectName}.git`;
}

/** O git só chama o credential helper se o 401 vier com WWW-Authenticate; isto reconhece a recusa. */
export function isAuthFailure(text) {
  return /\b401\b|authentication failed|could not read Username|invalid or expired token|terminal prompts disabled/i
    .test(String(text ?? ''));
}

/**
 * O `credential.helper` como o git o quer: `!` na frente = executa o comando como está.
 *
 * Injetado por `GIT_CONFIG_*` no ambiente do push, para não escrever no git config do usuário sem ele
 * pedir. `publishGit login --install-helper` é o caminho explícito para o `git clone` cru.
 */
export function credentialHelperValue(scriptPath, nodeExec = process.execPath) {
  return `!${JSON.stringify(nodeExec)} ${JSON.stringify(scriptPath)}`;
}

/** As variáveis `GIT_CONFIG_*` que carregam o helper, mescladas com o que já houver no env. */
export function withCredentialHelper(env, scriptPath, nodeExec = process.execPath) {
  const existing = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10);
  const count = Number.isFinite(existing) && existing > 0 ? existing : 0;
  return {
    ...env,
    GIT_CONFIG_COUNT: String(count + 1),
    [`GIT_CONFIG_KEY_${count}`]: 'credential.helper',
    [`GIT_CONFIG_VALUE_${count}`]: credentialHelperValue(scriptPath, nodeExec),
    // Sem isto o git abre um prompt e pendura o script quando o token não serve.
    GIT_TERMINAL_PROMPT: '0',
  };
}

/** A resposta de um credential helper no protocolo `get`: linhas `chave=valor`, terminadas em branco. */
export function credentialResponse(token, username = TOKEN_USERNAME) {
  if (!token) return '';
  return `username=${username}\npassword=${token}\n\n`;
}

export { TOKEN_USERNAME };

/**
 * O cache do token de SERVIÇO.
 *
 * Precisa ser em disco, e não em memória: cada `git push` invoca o credential helper como um processo
 * novo, que morre em seguida — um cache em memória seria uma troca por requisição. Guarda o JWT
 * derivado e o PREFIXO da chave (que não é segredo, é o que o admin mostra). **A `cak_` nunca é
 * gravada**: ela vive no ambiente de quem chamou.
 */
export function serviceStorePath(home = homedir()) {
  return join(home, '.collab', 'publishGitService.json');
}

export function apiKeyPrefix(apiKey) {
  return String(apiKey ?? '').trim().slice(0, 12);
}

export function readServiceToken({ home = homedir() } = {}) {
  const path = serviceStorePath(home);
  if (!existsSync(path)) return { access: '', keyPrefix: '', exp: 0 };
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    const access = String(stored.access ?? '').trim();
    return { access, keyPrefix: String(stored.keyPrefix ?? ''), exp: expOf(access) };
  } catch {
    return { access: '', keyPrefix: '', exp: 0 };
  }
}

export function writeServiceToken({ access, keyPrefix }, { home = homedir() } = {}) {
  const path = serviceStorePath(home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ access, keyPrefix, savedAt: new Date().toISOString() }, null, 2)}\n`);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows não tem o modo.
  }
  return path;
}

/**
 * O token que o `git push` vai usar como senha — a única função que o credential helper chama.
 *
 * Três origens, nesta ordem, e a ordem importa: **serviço** (automação declarou `COLLAB_API_KEY`),
 * **access válido** guardado, **refresh** quando o access expirou. Renovar aqui, e não no `login`, é
 * o que faz "login uma vez" ser verdade: o desenvolvedor não vê o token expirar.
 */
export async function resolvePushToken({ home = homedir(), env = process.env, fetchImpl = fetch } = {}) {
  const apiKey = (env.COLLAB_API_KEY ?? '').trim();
  if (apiKey) {
    const keyPrefix = apiKeyPrefix(apiKey);
    const cached = readServiceToken({ home });
    if (cached.access && cached.keyPrefix === keyPrefix && !needsRefresh(cached.exp)) {
      return { ok: true, token: cached.access, source: 'service-cache', reason: '' };
    }
    const exchanged = await exchangeApiKey(apiKey, { env, fetchImpl });
    if (!exchanged.ok) return { ok: false, token: '', source: 'service', reason: exchanged.reason };
    writeServiceToken({ access: exchanged.access, keyPrefix }, { home });
    return { ok: true, token: exchanged.access, source: 'service', reason: '' };
  }

  const session = readSession({ home, env });
  if (session.access && !needsRefresh(expOf(session.access))) {
    return { ok: true, token: session.access, source: 'access', reason: '' };
  }
  if (!session.refresh) {
    return {
      ok: false,
      token: '',
      source: 'none',
      reason: session.access
        ? (session.fromEnv
          ? 'COLLAB_PUBLISH_TOKEN expirou e não há refresh para renovar'
          : 'sessão expirada e sem refresh token (login antigo, por colagem)')
        : 'nenhuma sessão guardada',
    };
  }
  const renewed = await refreshAccess(session.refresh, { env, fetchImpl });
  if (!renewed.ok) return { ok: false, token: '', source: 'refresh', reason: renewed.reason };
  writeSession({ access: renewed.access, refresh: session.refresh }, { home });
  return { ok: true, token: renewed.access, source: 'refreshed', reason: '' };
}

/**
 * Para QUAIS hosts este credential helper pode responder.
 *
 * O `credential.helper` no git config global é **sem escopo**: o git o chama para todo remote https,
 * github.com incluído. Um helper que responde a todos entregaria o JWT do collab como senha do
 * GitHub — e o push para o GitHub passaria a falhar com um erro de autenticação que ninguém ligaria
 * ao publishGit. Então o helper decide pelo `host=` que o git manda no stdin, e o default é estreito.
 *
 * `COLLAB_PUBLISH_HOSTS` acrescenta hosts (uma VM com domínio próprio, por exemplo), separados por
 * vírgula, aceitando `*.dominio`.
 */
export const DEFAULT_PUBLISH_HOSTS = '*.collabcodes.com,*.collab.codes,127.0.0.1,localhost';

export function isPublishHost(host, env = process.env) {
  const hostname = String(host ?? '').trim().toLowerCase().replace(/:\d+$/u, '');
  if (!hostname) return false;
  const entries = `${DEFAULT_PUBLISH_HOSTS},${env.COLLAB_PUBLISH_HOSTS ?? ''}`
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return entries.some((entry) => (entry.startsWith('*.')
    ? hostname.endsWith(entry.slice(1)) && hostname.length > entry.length - 1
    : hostname === entry));
}

/** O `chave=valor` que o git manda no stdin do credential helper. */
export function parseCredentialInput(text) {
  const fields = {};
  for (const line of String(text ?? '').split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return fields;
}

/** Todo o stdin, ou string vazia quando não há (o git sempre manda; um humano testando pode não). */
export function readAllStdin(stream = process.stdin) {
  return new Promise((resolve) => {
    if (stream.isTTY) {
      resolve('');
      return;
    }
    let text = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { text += chunk; });
    stream.on('end', () => resolve(text));
    stream.on('error', () => resolve(text));
  });
}
