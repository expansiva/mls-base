#!/usr/bin/env node
// scripts/publishGitLogin.mjs — login sem copiar e colar (gb53).
//
// O DESENHO, e por que é este
// O collab-auth devolve os tokens no **fragment** da URL de retorno
// (`…/cb#access_token=…&refresh_token=…`). Fragment não viaja no HTTP: nenhum servidor jamais o
// recebe — é uma propriedade do navegador, e é justamente o que torna o fragment seguro. Então o
// servidor de loopback serve uma página cujo único trabalho é ler `location.hash` em JS e devolvê-lo
// por um `POST /done` para o mesmo servidor. É o fluxo de aplicação nativa do RFC 8252, e o motivo de
// ele ser seguro não generaliza: o redirect nunca sai da máquina do usuário.
//
// `state` aleatório vai no QUERY do returnTo (o `safeReturnTo` preserva query, só tira o hash) e é
// conferido na volta: sem isso, qualquer página aberta no browser poderia postar um token no
// loopback enquanto o login está esperando.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { authBaseUrl, tokenState, writeSession } from './publishGitAuth.mjs';

const DEFAULT_TIMEOUT_MS = 120_000;

/** A URL de login, com o loopback (e o state) como destino de retorno. */
export function loginUrl({ base, port, state, provider = 'google' }) {
  const returnTo = `http://127.0.0.1:${port}/cb?state=${encodeURIComponent(state)}`;
  return `${base}/auth/login/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Os tokens de um `location.hash` (`#access_token=…&refresh_token=…`). */
export function parseCallbackFragment(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/u, ''));
  return {
    access: params.get('access_token') ?? '',
    refresh: params.get('refresh_token') ?? '',
    error: params.get('error') ?? '',
  };
}

/** O comando que abre o browser, por plataforma. */
export function browserCommand(platform = process.platform) {
  if (platform === 'darwin') return { command: 'open', args: [] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', ''] };
  return { command: 'xdg-open', args: [] };
}

function openInBrowser(url) {
  const { command, args } = browserCommand();
  try {
    const child = spawn(command, [...args, url], { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** A página que lê o fragment. Sem nada de fora: só o que este servidor entrega. */
function callbackPage() {
  return `<!doctype html>
<meta charset="utf-8"><title>collab — login</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:3rem auto;max-width:32rem;color:#222}</style>
<h1>collab</h1><p id="m">Finishing sign-in…</p>
<script>
  (function () {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var state = new URLSearchParams(location.search).get('state') || '';
    fetch('/done', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        state: state,
        access_token: p.get('access_token') || '',
        refresh_token: p.get('refresh_token') || '',
        error: p.get('error') || ''
      })
    }).then(function () {
      location.hash = '';
      document.getElementById('m').textContent = 'Signed in. You can close this tab.';
    }).catch(function (e) {
      document.getElementById('m').textContent = 'Could not reach the local helper: ' + e;
    });
  })();
</script>`;
}

/**
 * Sobe o loopback, abre o browser e espera o par de tokens.
 *
 * `open` é injetável para o teste: o navegador é a única peça que um teste não pode ter, e simular a
 * página (ler o fragment e postar em /done) é fiel porque o JS acima faz exatamente isso.
 */
export function awaitLoopbackLogin({
  base = authBaseUrl(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  open = openInBrowser,
  onUrl = () => {},
} = {}) {
  const state = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      fn(value);
    };

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/cb') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(callbackPage());
        return;
      }
      if (request.method === 'POST' && url.pathname === '/done') {
        let body = '';
        request.on('data', (chunk) => { body += chunk; });
        request.on('end', () => {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"ok":true}');
          let payload = {};
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            payload = {};
          }
          if (payload.state !== state) {
            // Alguma outra página no browser postou aqui. Não é erro do usuário: é o motivo do state.
            finish(reject, new Error('state não confere — retorno de login ignorado'));
            return;
          }
          if (payload.error) {
            finish(reject, new Error(`collab-auth recusou o login: ${payload.error}`));
            return;
          }
          const access = String(payload.access_token ?? '');
          const refresh = String(payload.refresh_token ?? '');
          if (!access) {
            finish(reject, new Error('o retorno não trouxe access_token'));
            return;
          }
          finish(resolve, { access, refresh });
        });
        return;
      }
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found\n');
    });

    const timer = setTimeout(() => {
      // A causa mais provável não é o browser: é um collab-auth que ainda não tem `loopback` na
      // allowlist do `safeReturnTo`. Nesse caso ele ignora o returnTo e manda os tokens para o
      // collab-admin — o browser abre, o login funciona, e o loopback nunca recebe nada. Sem dizer
      // isto, o sintoma manda a pessoa procurar problema no navegador.
      finish(reject, new Error(
        `o login não voltou em ${Math.round(timeoutMs / 1000)}s.\n`
        + '  Se o browser abriu e o login funcionou, o collab-auth publicado ainda não aceita o\n'
        + '  loopback: precisa da entrada `loopback` em COLLAB_AUTH_ALLOWED_RETURN_HOSTS (gb53 P-W1).\n'
        + '  Enquanto isso: publishGit login --paste',
      ));
    }, timeoutMs);
    // Um timer aberto seguraria o processo mesmo depois de resolver.
    timer.unref?.();

    server.on('error', (error) => finish(reject, error));
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const url = loginUrl({ base, port, state });
      onUrl(url);
      if (!open(url)) {
        // Não é fatal: o usuário pode abrir na mão. Fatal seria desistir do login por isso.
        onUrl(url, true);
      }
    });
  });
}

/** O comando completo: espera o retorno e grava a sessão. */
export async function runRedirectLogin({
  home,
  base = authBaseUrl(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  open = openInBrowser,
  log = (message) => process.stderr.write(`${message}\n`),
} = {}) {
  const { access, refresh } = await awaitLoopbackLogin({
    base,
    timeoutMs,
    open,
    onUrl: (url, manual) => {
      if (manual) log(`[publishGit] não consegui abrir o browser. Abra você: ${url}`);
      else log(`[publishGit] abrindo o browser em ${base}/auth/login/google …`);
    },
  });
  const { state, email, expiresAt } = tokenState(access);
  if (state === 'invalid') throw new Error('o collab-auth devolveu um token que não parece um JWT');
  const saved = writeSession({ access, refresh }, home ? { home } : {});
  return { ...saved, email, expiresAt, hasRefresh: Boolean(refresh) };
}
