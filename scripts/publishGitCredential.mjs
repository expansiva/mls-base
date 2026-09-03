#!/usr/bin/env node
// scripts/publishGitCredential.mjs — credential helper do git para o publish por https (gb50/gb53).
//
// O git chama isto com a operação na primeira palavra (`get`, `store`, `erase`) e o contexto em
// `chave=valor` no stdin. Só `get` faz algo: devolve o token que o push deve usar como senha
// (formato PAT). `store`/`erase` são no-ops de propósito — quem manda no token é o `publishGit
// login`, não o git; apagar aqui deixaria o desenvolvedor sem sessão por causa de um 401 transitório.
//
// PRIMEIRO O HOST, DEPOIS O TOKEN. O `credential.helper` global é chamado para TODO remote https,
// github.com incluído. Responder a todos entregaria o JWT do collab como senha do GitHub, e o push
// para o GitHub passaria a falhar com um erro que ninguém ligaria a este script. Só hosts do collab
// (`isPublishHost`) recebem resposta; para os outros, stdout vazio e o git segue com os helpers dele.
//
// TODA a decisão do token está no `resolvePushToken` (gb53): usa o access guardado, renova pelo
// refresh quando ele está perto de expirar, ou troca a `COLLAB_API_KEY` por um JWT de serviço. É por
// isso que "login uma vez" é verdade — a renovação acontece aqui, no meio do `git push`.
//
// Falha ⇒ **stdout vazio** e o motivo no stderr. Stdout vazio é o que faz o git desistir com a
// própria mensagem de autenticação, que o publishGit traduz em "rode publishGit login" (exit 3).

import {
  credentialResponse, isPublishHost, parseCredentialInput, readAllStdin, resolvePushToken,
} from './publishGitAuth.mjs';

const operation = (process.argv[2] ?? '').trim();
if (operation !== 'get') process.exit(0);

const fields = parseCredentialInput(await readAllStdin());
if (!isPublishHost(fields.host)) {
  // Silêncio, não erro: o git tem outros helpers, e este host não é assunto nosso.
  process.exit(0);
}

const resolved = await resolvePushToken();
if (!resolved.ok) {
  process.stderr.write(`[publishGit] sem credencial para ${fields.host}: ${resolved.reason}\n`);
  process.stderr.write('[publishGit] rode: pnpm publishGit login\n');
  process.exit(0);
}
process.stdout.write(credentialResponse(resolved.token));
