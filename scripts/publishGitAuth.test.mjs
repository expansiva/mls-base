import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  credentialResponse, httpsUrl, isAuthFailure, parseJwtPayload, readToken, tokenState,
  tokenStorePath, withCredentialHelper, writeToken, credentialHelperValue, AUTH_EXIT,
  needsRefresh, readSession, resolvePushToken, writeServiceToken, writeSession,
  isPublishHost, parseCredentialInput, refreshAccess, chooseOrgId, orgsFromPayload,
  tokenHasActiveOrg,
} from './publishGitAuth.mjs';

function jwt(payload) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.assinatura`;
}

test('parseJwtPayload lê o payload sem verificar assinatura, e recusa o que não é JWT', () => {
  assert.equal(parseJwtPayload(jwt({ email: 'a@b.c' })).email, 'a@b.c');
  assert.equal(parseJwtPayload('nao.e.jwt'), null);
  assert.equal(parseJwtPayload('sem-pontos'), null);
  assert.equal(parseJwtPayload(''), null);
  assert.equal(parseJwtPayload(undefined), null);
});

test('tokenState distingue válido, expirado e inválido', () => {
  const now = 1_000_000;
  assert.equal(tokenState(jwt({ email: 'a@b.c', exp: now + 60 }), now).state, 'ok');
  assert.equal(tokenState(jwt({ email: 'a@b.c', exp: now - 60 }), now).state, 'expired');
  // Sem exp não há como dizer se vale: é inválido, não "eterno".
  assert.equal(tokenState(jwt({ email: 'a@b.c' }), now).state, 'invalid');
  assert.equal(tokenState('lixo', now).state, 'invalid');
});

test('tokenState respeita grace_until, a mesma tolerância do resto da plataforma', () => {
  const now = 1_000_000;
  // O servidor aceita dentro da graça; se o cliente matasse o token aqui, mandaria fazer login
  // por um token que a VM ainda aceita.
  const state = tokenState(jwt({ email: 'a@b.c', exp: now - 60, grace_until: now + 60 }), now);
  assert.equal(state.state, 'ok');
});

test('httpsUrl aceita o domínio cru e o domínio já com /git', () => {
  assert.equal(httpsUrl('https://102043.collabcodes.com', 'mls-102043'),
    'https://102043.collabcodes.com/git/mls-102043.git');
  assert.equal(httpsUrl('https://102043.collabcodes.com/git/', 'mls-102043'),
    'https://102043.collabcodes.com/git/mls-102043.git');
  // Sem GIT_URL não há URL https: o chamador cai no ssh de sempre.
  assert.equal(httpsUrl('', 'mls-102043'), '');
  assert.equal(httpsUrl(undefined, 'mls-102043'), '');
});

test('isAuthFailure reconhece as formas em que o git relata 401', () => {
  assert.ok(isAuthFailure('fatal: Authentication failed for https://x/git/mls-1.git/'));
  assert.ok(isAuthFailure('error: The requested URL returned error: 401'));
  assert.ok(isAuthFailure('could not read Username for https://x: terminal prompts disabled'));
  assert.ok(isAuthFailure('remote: invalid or expired token (run: pnpm publishGit login)'));
  // Não confundir com o que NÃO é autenticação — senão um 401 falso manda mexer na worktree remota.
  assert.equal(isAuthFailure('error: failed to push some refs'), false);
  assert.equal(isAuthFailure('remote: working directory has unstaged changes'), false);
});

test('credentialResponse fala o protocolo do git credential, com o token na senha', () => {
  assert.equal(credentialResponse('tok'), 'username=collab\npassword=tok\n\n');
  // Sem token, silêncio: o git então mostra a própria mensagem e o publishGit traduz.
  assert.equal(credentialResponse(''), '');
});

test('withCredentialHelper acrescenta ao GIT_CONFIG_COUNT existente, sem sobrescrever', () => {
  const env = withCredentialHelper(
    { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'a.b', GIT_CONFIG_VALUE_0: 'c' },
    '/x/helper.mjs',
    '/usr/bin/node',
  );
  assert.equal(env.GIT_CONFIG_COUNT, '2');
  assert.equal(env.GIT_CONFIG_KEY_0, 'a.b');
  assert.equal(env.GIT_CONFIG_KEY_1, 'credential.helper');
  assert.equal(env.GIT_CONFIG_VALUE_1, credentialHelperValue('/x/helper.mjs', '/usr/bin/node'));
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
});

test('credentialHelperValue começa com ! para o git executar o comando como está', () => {
  const value = credentialHelperValue('/x/y helper.mjs', '/usr/bin/node');
  assert.ok(value.startsWith('!'));
  // O caminho com espaço tem de sobreviver: sem as aspas o git parte o comando ao meio.
  assert.ok(value.includes('"/x/y helper.mjs"'));
});

test('writeToken/readToken guardam na home com modo 600, e o env tem precedência', () => {
  const home = mkdtempSync(join(tmpdir(), 'collab-token-'));
  const token = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600 });
  const saved = writeToken(token, { home });
  assert.equal(saved.path, tokenStorePath(home));
  assert.ok(existsSync(saved.path));
  assert.equal(saved.email, 'w@collab.codes');
  assert.equal(readToken({ home, env: {} }), token);
  // O arquivo NÃO fica dentro do repo: o mls-base é empurrado para a VM a cada publish.
  assert.ok(!saved.path.includes('mls-base'));
  const stored = JSON.parse(readFileSync(saved.path, 'utf8'));
  // gb53 mudou o campo de `token` para `access` (agora existe um `refresh` ao lado). O formato
  // antigo continua LEGÍVEL — há um teste do resolvePushToken cobrindo isso.
  assert.equal(stored.access, token);
  assert.equal(stored.refresh, '');
  assert.equal(readToken({ home, env: { COLLAB_PUBLISH_TOKEN: 'do-env' } }), 'do-env');
  assert.equal(readToken({ home: mkdtempSync(join(tmpdir(), 'vazia-')), env: {} }), '');
});

test('AUTH_EXIT é 3, o código que o publish reserva para "faça login"', () => {
  assert.equal(AUTH_EXIT, 3);
});

// ── gb53: renovação automática e token de serviço ────────────────────────────────

/** collab-auth de mentira para as duas rotas de token, contando as chamadas. */
async function fakeTokenServer({ refreshOk = true, exchangeOk = true, access = '', refuseOrgId = '' } = {}) {
  const calls = { refresh: 0, exchange: 0, bodies: [] };
  const { createServer } = await import('node:http');
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const url = new URL(request.url, 'http://127.0.0.1');
      const send = (code, payload) => {
        response.writeHead(code, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };
      if (url.pathname === '/auth/token/refresh') {
        calls.refresh += 1;
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch { parsed = {}; }
        calls.bodies.push(parsed);
        if (refuseOrgId && parsed.org_id === refuseOrgId) {
          return send(400, { statusCode: 400, msg: 'Unknown org' });
        }
        return refreshOk
          ? send(200, { statusCode: 200, access_token: access, token_type: 'Bearer', expires_in: 3600 })
          : send(401, { statusCode: 401, msg: 'Invalid or expired refresh token' });
      }
      if (url.pathname === '/auth/token/exchange') {
        calls.exchange += 1;
        return exchangeOk
          ? send(200, { statusCode: 200, access_token: access, token_type: 'Bearer', expires_in: 3600, key_prefix: 'cak_abcd1234' })
          : send(401, { statusCode: 401, msg: 'Invalid or revoked API key' });
      }
      return send(404, {});
    });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, calls, env: { COLLAB_AUTH_BASE_URL: `http://127.0.0.1:${server.address().port}` } };
}

const freshJwt = () => jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600 });
const staleJwt = () => jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) - 10 });

test('needsRefresh renova 60s ANTES de expirar, não no instante exato', () => {
  const now = 1_000_000;
  assert.equal(needsRefresh(now + 3600, now), false);
  assert.equal(needsRefresh(now + 30, now), true);
  // Um push grande leva minutos; o git não repete o desafio no meio de um POST.
  assert.equal(needsRefresh(now + 61, now), false);
  assert.equal(needsRefresh(0, now), true);
});

test('resolvePushToken: access válido é usado como está, sem tocar na rede', async () => {
  const { server, calls, env } = await fakeTokenServer();
  const home = mkdtempSync(join(tmpdir(), 'collab-resolve-'));
  try {
    const access = freshJwt();
    writeSession({ access, refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, access);
    assert.equal(resolved.source, 'access');
    assert.equal(calls.refresh, 0);
  } finally {
    server.close();
  }
});

test('resolvePushToken: access expirado ⇒ renova pelo refresh e GRAVA o novo', async () => {
  const novo = freshJwt();
  const { server, calls, env } = await fakeTokenServer({ access: novo });
  const home = mkdtempSync(join(tmpdir(), 'collab-resolve-'));
  try {
    writeSession({ access: staleJwt(), refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, novo);
    assert.equal(resolved.source, 'refreshed');
    assert.equal(calls.refresh, 1);
    // Gravar é o que faz o push seguinte não renovar de novo — e o refresh continua o mesmo,
    // porque o /auth/token/refresh do collab-auth devolve só o access.
    assert.equal(readSession({ home, env: {} }).access, novo);
    assert.equal(readSession({ home, env: {} }).refresh, 'r1');
  } finally {
    server.close();
  }
});

test('resolvePushToken: refresh recusado ⇒ ok:false com o motivo do servidor', async () => {
  const { server, env } = await fakeTokenServer({ refreshOk: false });
  const home = mkdtempSync(join(tmpdir(), 'collab-resolve-'));
  try {
    writeSession({ access: staleJwt(), refresh: 'revogado' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, false);
    assert.match(resolved.reason, /refresh token/iu);
  } finally {
    server.close();
  }
});

test('resolvePushToken: sem sessão nenhuma ⇒ ok:false, e nada de stack', async () => {
  const { server, env } = await fakeTokenServer();
  try {
    const resolved = await resolvePushToken({ home: mkdtempSync(join(tmpdir(), 'vazia-')), env });
    assert.equal(resolved.ok, false);
    assert.match(resolved.reason, /nenhuma sessão/u);
  } finally {
    server.close();
  }
});

test('resolvePushToken: sessão do gb50 (só `token`, sem refresh) é lida — migração silenciosa', async () => {
  const { server, env } = await fakeTokenServer();
  const home = mkdtempSync(join(tmpdir(), 'collab-legado-'));
  try {
    const access = freshJwt();
    mkdirSync(join(home, '.collab'), { recursive: true });
    writeFileSync(join(home, '.collab', 'publishGit.json'), JSON.stringify({ token: access }));
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, access);
    // Expirado e sem refresh: a mensagem tem de dizer QUE é o login antigo, senão ninguém entende.
    writeFileSync(join(home, '.collab', 'publishGit.json'), JSON.stringify({ token: staleJwt() }));
    const expirada = await resolvePushToken({ home, env });
    assert.equal(expirada.ok, false);
    assert.match(expirada.reason, /colagem|refresh/u);
  } finally {
    server.close();
  }
});

test('modo serviço: COLLAB_API_KEY troca por JWT, cacheia, e o 2º push NÃO troca de novo', async () => {
  const servico = freshJwt();
  const { server, calls, env } = await fakeTokenServer({ access: servico });
  const home = mkdtempSync(join(tmpdir(), 'collab-servico-'));
  try {
    const withKey = { ...env, COLLAB_API_KEY: 'cak_abcd1234deadbeef' };
    const first = await resolvePushToken({ home, env: withKey });
    assert.equal(first.ok, true);
    assert.equal(first.token, servico);
    assert.equal(first.source, 'service');
    assert.equal(calls.exchange, 1);

    const second = await resolvePushToken({ home, env: withKey });
    assert.equal(second.source, 'service-cache');
    assert.equal(calls.exchange, 1, 'o cache existe porque cada push é um processo novo do helper');

    // A chave NUNCA vai para o disco: só o JWT derivado e o prefixo, que não é segredo.
    const cache = readFileSync(join(home, '.collab', 'publishGitService.json'), 'utf8');
    assert.equal(cache.includes('cak_abcd1234deadbeef'), false);
    assert.ok(cache.includes('cak_abcd1234'));
  } finally {
    server.close();
  }
});

test('modo serviço: chave revogada ⇒ ok:false, e o cache de outra chave não é reaproveitado', async () => {
  const { server, env } = await fakeTokenServer({ exchangeOk: false });
  const home = mkdtempSync(join(tmpdir(), 'collab-servico-'));
  try {
    writeServiceToken({ access: freshJwt(), keyPrefix: 'cak_outrakey' }, { home });
    const resolved = await resolvePushToken({ home, env: { ...env, COLLAB_API_KEY: 'cak_abcd1234revogada' } });
    assert.equal(resolved.ok, false);
    assert.match(resolved.reason, /revoked|recusada/iu);
  } finally {
    server.close();
  }
});

test('modo serviço tem precedência sobre a sessão da pessoa (automação não vira pessoa)', async () => {
  // Os dois tokens têm de ser distinguíveis, senão o teste passa por coincidência.
  const servico = jwt({ email: 'service+cak_abcd1234@service.collab.codes', exp: Math.floor(Date.now() / 1000) + 3600, service: true });
  const { server, env } = await fakeTokenServer({ access: servico });
  const home = mkdtempSync(join(tmpdir(), 'collab-precedencia-'));
  try {
    const pessoal = jwt({ email: 'wagner@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600 });
    writeSession({ access: pessoal, refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env: { ...env, COLLAB_API_KEY: 'cak_abcd1234xxxx' } });
    assert.equal(resolved.token, servico);
    assert.notEqual(resolved.token, pessoal);
  } finally {
    server.close();
  }
});

// ── O helper responde só para hosts do collab ────────────────────────────────────

test('isPublishHost: VMs do collab e o loopback sim; github.com NÃO', () => {
  // O motivo desta função existir: o `credential.helper` global é chamado para TODO remote https.
  // Responder para o github entregaria o JWT do collab como senha dele, e o push para o GitHub
  // passaria a falhar com um erro que ninguém ligaria ao publishGit.
  assert.equal(isPublishHost('github.com'), false);
  assert.equal(isPublishHost('gitlab.com'), false);
  assert.equal(isPublishHost('collabcodes.com.evil.com'), false);
  assert.equal(isPublishHost(''), false);
  assert.equal(isPublishHost(undefined), false);

  assert.equal(isPublishHost('102043.collabcodes.com'), true);
  assert.equal(isPublishHost('app.collab.codes'), true);
  assert.equal(isPublishHost('127.0.0.1'), true);
  assert.equal(isPublishHost('127.0.0.1:8443'), true);
  assert.equal(isPublishHost('localhost'), true);
  // Uma VM com domínio próprio entra por env, não por edição de código.
  assert.equal(isPublishHost('vm.cliente.com.br', {}), false);
  assert.equal(isPublishHost('vm.cliente.com.br', { COLLAB_PUBLISH_HOSTS: 'vm.cliente.com.br' }), true);
});

test('parseCredentialInput lê o protocolo do git credential (chave=valor por linha)', () => {
  const fields = parseCredentialInput('protocol=https\nhost=102043.collabcodes.com\npath=git/mls-102043.git\n\n');
  assert.equal(fields.protocol, 'https');
  assert.equal(fields.host, '102043.collabcodes.com');
  assert.deepEqual(parseCredentialInput(''), {});
  assert.deepEqual(parseCredentialInput(undefined), {});
});

const collabOrg = { id: '603ebd39-1111-2222-3333-444444444444', slug: 'collab', role: 'member' };
const acmeOrg = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', slug: 'acme', role: 'member' };

test('tokenHasActiveOrg: null ou ausente é falso; id/slug é verdadeiro', () => {
  assert.equal(tokenHasActiveOrg(jwt({ active_org: null, orgs: [collabOrg] })), false);
  assert.equal(tokenHasActiveOrg(jwt({ orgs: [collabOrg] })), false);
  assert.equal(tokenHasActiveOrg(jwt({ active_org: { id: collabOrg.id, slug: 'collab' } })), true);
  assert.equal(tokenHasActiveOrg('nao.e.jwt'), false);
});

test('chooseOrgId: uma org escolhe essa; várias sem escolha falham listando; guardada vence', () => {
  assert.deepEqual(chooseOrgId([collabOrg], ''), { ok: true, orgId: collabOrg.id, reason: '' });
  assert.deepEqual(chooseOrgId([], ''), { ok: true, orgId: '', reason: '' });
  const many = chooseOrgId([collabOrg, acmeOrg], '');
  assert.equal(many.ok, false);
  assert.match(many.reason, /more than one org/u);
  assert.match(many.reason, /collab/u);
  assert.match(many.reason, /acme/u);
  assert.match(many.reason, /orgId|COLLAB_ORG_ID/u);
  assert.equal(chooseOrgId([collabOrg, acmeOrg], acmeOrg.id).orgId, acmeOrg.id);
  assert.equal(chooseOrgId([collabOrg, acmeOrg], 'acme').orgId, acmeOrg.id);
  assert.deepEqual(orgsFromPayload({ orgs: [collabOrg], active_org: null }), [collabOrg]);
});

test('refreshAccess manda org_id quando o token tem uma org', async () => {
  const novo = freshJwt();
  const { server, calls, env } = await fakeTokenServer({ access: novo });
  try {
    const current = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) - 10, orgs: [collabOrg], active_org: null });
    const renewed = await refreshAccess('r1', { env, access: current });
    assert.equal(renewed.ok, true);
    assert.equal(renewed.access, novo);
    assert.equal(renewed.orgId, collabOrg.id);
    assert.equal(calls.refresh, 1);
    assert.equal(calls.bodies[0].refresh_token, 'r1');
    assert.equal(calls.bodies[0].org_id, collabOrg.id);
  } finally {
    server.close();
  }
});

test('refreshAccess falha com mensagem útil quando há várias orgs e nenhuma guardada', async () => {
  const { server, calls, env } = await fakeTokenServer({ access: freshJwt() });
  try {
    const current = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) - 10, orgs: [collabOrg, acmeOrg] });
    const renewed = await refreshAccess('r1', { env, access: current });
    assert.equal(renewed.ok, false);
    assert.equal(renewed.code, 'org-choice');
    assert.match(renewed.reason, /more than one org/u);
    assert.match(renewed.reason, /collab/u);
    assert.match(renewed.reason, /COLLAB_ORG_ID|orgId/u);
    assert.equal(calls.refresh, 0, 'não escolhe por conta própria — nem chega na rede');
  } finally {
    server.close();
  }
});

test('refreshAccess degrada (não lança) quando o refresh com org é recusado', async () => {
  const novo = freshJwt();
  const { server, calls, env } = await fakeTokenServer({ access: novo, refuseOrgId: collabOrg.id });
  try {
    const current = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) - 10, orgs: [collabOrg] });
    const renewed = await refreshAccess('r1', { env, access: current });
    assert.equal(renewed.ok, true);
    assert.equal(renewed.access, novo);
    assert.equal(renewed.degraded, true);
    assert.equal(calls.refresh, 2);
    assert.equal(calls.bodies[0].org_id, collabOrg.id);
    assert.equal(calls.bodies[1].org_id, undefined);
  } finally {
    server.close();
  }
});

test('resolvePushToken: access válido sem active_org e uma org ⇒ refresh com org_id e persiste a escolha', async () => {
  const novo = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600, active_org: { id: collabOrg.id, slug: 'collab' } });
  const { server, calls, env } = await fakeTokenServer({ access: novo });
  const home = mkdtempSync(join(tmpdir(), 'collab-org-'));
  try {
    const current = jwt({ email: 'w@collab.codes', exp: Math.floor(Date.now() / 1000) + 3600, orgs: [collabOrg], active_org: null });
    writeSession({ access: current, refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, novo);
    assert.equal(resolved.source, 'refreshed');
    assert.equal(calls.bodies[0].org_id, collabOrg.id);
    assert.equal(readSession({ home, env: {} }).orgId, collabOrg.id);
  } finally {
    server.close();
  }
});

test('resolvePushToken: várias orgs sem escolha, access válido ⇒ degrada e o publish não para', async () => {
  const { server, calls, env } = await fakeTokenServer({ access: freshJwt() });
  const home = mkdtempSync(join(tmpdir(), 'collab-orgs-'));
  try {
    const current = jwt({
      email: 'w@collab.codes',
      exp: Math.floor(Date.now() / 1000) + 3600,
      orgs: [collabOrg, acmeOrg],
      active_org: null,
    });
    writeSession({ access: current, refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, current);
    assert.equal(resolved.source, 'access');
    assert.equal(calls.refresh, 0);
  } finally {
    server.close();
  }
});

test('resolvePushToken: access expirado, várias orgs sem escolha ⇒ refresh sem org_id (token de hoje)', async () => {
  const novo = freshJwt();
  const { server, calls, env } = await fakeTokenServer({ access: novo });
  const home = mkdtempSync(join(tmpdir(), 'collab-orgs-stale-'));
  try {
    const current = jwt({
      email: 'w@collab.codes',
      exp: Math.floor(Date.now() / 1000) - 10,
      orgs: [collabOrg, acmeOrg],
    });
    writeSession({ access: current, refresh: 'r1' }, { home });
    const resolved = await resolvePushToken({ home, env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.token, novo);
    assert.equal(calls.refresh, 1);
    assert.equal(calls.bodies[0].org_id, undefined);
  } finally {
    server.close();
  }
});

test('o helper de VERDADE (subprocesso) não devolve nada para o github.com', async () => {
  // O teste unitário do isPublishHost não cobre a costura: é o script que lê o stdin e decide.
  // E é o script que o git config global chama para TODO remote https.
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const home = mkdtempSync(join(tmpdir(), 'collab-helper-'));
  mkdirSync(join(home, '.collab'), { recursive: true });
  writeFileSync(join(home, '.collab', 'publishGit.json'), JSON.stringify({ access: freshJwt(), refresh: 'r' }));

  const run = (host) => spawnSync('node', [join(here, 'publishGitCredential.mjs'), 'get'], {
    input: `protocol=https\nhost=${host}\n\n`,
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });

  const github = run('github.com');
  assert.equal(github.stdout, '', 'o JWT do collab não pode virar senha do GitHub');
  assert.equal(github.status, 0, 'e não pode ser um erro: o git tem outros helpers para esse host');

  const vm = run('102043.collabcodes.com');
  assert.match(vm.stdout, /^username=collab\npassword=eyJ/u);
});
