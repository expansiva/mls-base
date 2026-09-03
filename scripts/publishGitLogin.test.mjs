// gb53 — o login por redirect, com um collab-auth de mentira mas um fluxo de verdade.
//
// O navegador é a única peça que um teste não pode ter. Tudo o resto é real: um servidor de
// loopback de verdade, um redirect de verdade com o fragment, e o `POST /done` que a página faria.
// A página em si tem cinco linhas de JS que fazem exatamente esse POST — simular esse passo é fiel;
// simular o resto seria testar uma cópia.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  awaitLoopbackLogin, browserCommand, loginUrl, parseCallbackFragment, runRedirectLogin,
} from './publishGitLogin.mjs';

function jwt(payload) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.assinatura`;
}

const ACCESS = jwt({ email: 'wagner@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600, sub: 'u1' });
const REFRESH = 'refresh-de-30-dias';

/** collab-auth de mentira: só o `/auth/login/google` que redireciona com o fragment. */
async function fakeAuth({ access = ACCESS, refresh = REFRESH, error = '' } = {}) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/auth/login/google') {
      const returnTo = url.searchParams.get('returnTo') ?? '';
      const fragment = error
        ? `#error=${encodeURIComponent(error)}`
        : `#access_token=${access}&refresh_token=${encodeURIComponent(refresh)}`;
      response.writeHead(302, { location: `${returnTo}${fragment}` });
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/**
 * O "navegador": segue o redirect sem seguir automaticamente (para VER o fragment, que um cliente
 * HTTP normal descartaria) e faz o POST que a página faria.
 */
function fakeBrowser({ tamperState = null, skipPost = false } = {}) {
  return (url) => {
    void (async () => {
      const response = await fetch(url, { redirect: 'manual' });
      const location = response.headers.get('location') ?? '';
      if (skipPost) return;
      const hashAt = location.indexOf('#');
      const tokens = parseCallbackFragment(hashAt >= 0 ? location.slice(hashAt) : '');
      const target = new URL(hashAt >= 0 ? location.slice(0, hashAt) : location);
      const state = tamperState ?? target.searchParams.get('state');
      await fetch(`${target.origin}/done`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state,
          access_token: tokens.access,
          refresh_token: tokens.refresh,
          error: tokens.error,
        }),
      });
    })();
    return true;
  };
}

test('loginUrl leva o loopback e o state no returnTo, codificados', () => {
  const url = loginUrl({ base: 'https://auth.collab.codes', port: 53211, state: 'abc123' });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/auth/login/google');
  const returnTo = new URL(parsed.searchParams.get('returnTo'));
  assert.equal(returnTo.origin, 'http://127.0.0.1:53211');
  assert.equal(returnTo.pathname, '/cb');
  // O state vai no QUERY, não no fragment: o safeReturnTo do collab-auth preserva query e tira hash.
  assert.equal(returnTo.searchParams.get('state'), 'abc123');
});

test('parseCallbackFragment lê o par de tokens e também o erro', () => {
  const ok = parseCallbackFragment(`#access_token=aaa&refresh_token=${encodeURIComponent('b/b+b')}`);
  assert.equal(ok.access, 'aaa');
  assert.equal(ok.refresh, 'b/b+b');
  assert.equal(parseCallbackFragment('#error=access_denied').error, 'access_denied');
  assert.deepEqual(parseCallbackFragment(''), { access: '', refresh: '', error: '' });
  assert.deepEqual(parseCallbackFragment(undefined), { access: '', refresh: '', error: '' });
});

test('browserCommand escolhe o abridor de cada plataforma', () => {
  assert.equal(browserCommand('darwin').command, 'open');
  assert.equal(browserCommand('linux').command, 'xdg-open');
  assert.deepEqual(browserCommand('win32'), { command: 'cmd', args: ['/c', 'start', ''] });
});

test('login por redirect: zero copiar/colar, e a sessão fica gravada com access E refresh', async () => {
  const { server, base } = await fakeAuth();
  const home = mkdtempSync(join(tmpdir(), 'collab-login-'));
  try {
    const saved = await runRedirectLogin({ home, base, open: fakeBrowser(), log: () => {} });
    assert.equal(saved.email, 'wagner@collab.codes');
    assert.equal(saved.hasRefresh, true);
    const stored = JSON.parse(readFileSync(saved.path, 'utf8'));
    assert.equal(stored.access, ACCESS);
    // O refresh é o que faz "login uma vez": sem ele a sessão morre em 1 hora.
    assert.equal(stored.refresh, REFRESH);
    assert.ok(existsSync(join(home, '.collab', 'publishGit.json')));
  } finally {
    server.close();
  }
});

test('state trocado ⇒ o retorno é IGNORADO (é para isso que o state existe)', async () => {
  const { server, base } = await fakeAuth();
  const home = mkdtempSync(join(tmpdir(), 'collab-login-'));
  try {
    // Sem essa checagem, qualquer página aberta no browser poderia postar um token no loopback
    // enquanto o login espera.
    await assert.rejects(
      runRedirectLogin({ home, base, open: fakeBrowser({ tamperState: 'outro-state' }), log: () => {} }),
      /state não confere/u,
    );
    assert.equal(existsSync(join(home, '.collab', 'publishGit.json')), false);
  } finally {
    server.close();
  }
});

test('collab-auth recusando o login ⇒ erro que diz o motivo, nada gravado', async () => {
  const { server, base } = await fakeAuth({ error: 'access_denied' });
  const home = mkdtempSync(join(tmpdir(), 'collab-login-'));
  try {
    await assert.rejects(
      runRedirectLogin({ home, base, open: fakeBrowser(), log: () => {} }),
      /access_denied/u,
    );
    assert.equal(existsSync(join(home, '.collab', 'publishGit.json')), false);
  } finally {
    server.close();
  }
});

test('o browser que não volta ⇒ timeout com mensagem, sem pendurar o processo', async () => {
  const { server, base } = await fakeAuth();
  try {
    await assert.rejects(
      awaitLoopbackLogin({ base, timeoutMs: 300, open: fakeBrowser({ skipPost: true }), onUrl: () => {} }),
      /o login não voltou/u,
    );
  } finally {
    server.close();
  }
});
