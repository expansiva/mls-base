# Publicar na lima — o que vai junto e como não colidir

Receita curta para Codex e Claude Code. O contrato completo do publish está em [`publishGitBackend.md`](publishGitBackend.md).

## O comando

Na pasta do app (ex.: `mls-base/mls-102047`):

```
pnpm run publish:git > /tmp/pub.txt 2>&1
```

Nunca em pipe para `head`: o SIGPIPE mata o release no meio. Ler o arquivo depois. O fim esperado é
`##gitBackend build=ok release=<id>` e `release <id> ativa`.

## O que vai junto

- **O app** vai pelo commit do Mac. A lima não tem história própria: se ela divergir (rebase, amend, reset no Mac), o publish alinha
  sozinho, com `--force-with-lease` no SHA que acabou de ler (rt73).
- **As dependências que mudaram vão junto, sem pedir.** O publish compara cada `mls-<dep>` do Mac com a lima e envia um retrato de cada
  uma que mudou (`deps changed: 102033 102034 … | unchanged: N`, depois `retrato mls-<dep> → VM`). O retrato tem a mensagem
  `snapshot <sha do Mac>[+dirty]: <assunto>`.
- **O retrato é a pasta como está no disco**, inclusive o que não foi commitado (o `+dirty` marca isso). Mudança em andamento de outra
  sessão numa dependência vai para a lima.
- **Só o app publicado ganha release.** O repositório da dependência na lima é compartilhado e fica atualizado na hora, mas os outros apps
  (2043, 2052…) só usam a versão nova na próxima release deles.
- **Não vai junto:** o `mls-base` (scripts e plataforma), que sobe por `git push limaroot HEAD:main`; a lib do cfe, que vem do
  `latest.json`; e a VM remota, que é outro caminho (`releaseSites.mjs`).
- **App igual e dependência mudada:** o publish faz um commit-marca no app (`publish: rebuild after deps <ids>`) para cortar a release.
  Tudo igual: `Nothing to publish`. Para forçar uma release, `git commit --allow-empty` antes.
- **O build e a migração rodam na lima.** A migração pode refazer tabelas de um módulo cujo esquema mudou (`[migrate] refeitos …`); o
  banco da lima é de teste.

## Colisão: o que já está protegido

| risco | proteção | onde |
|---|---|---|
| dois publishers locais ao mesmo tempo (mesmo app ou apps com dependência comum) | **lock por workspace** num diretório do temp do sistema (`$TMPDIR/collab-publish-local-<hash>`, criado de forma atômica). O segundo espera (aviso único, 10 min) e só lê o estado depois que o hook do primeiro termina | `scripts/publishGitLocalLock.mjs` (rt73) |
| a lima mudar entre ler e enviar | `--force-with-lease` no SHA lido; lease recusado = conflito, para sem forçar de novo | `publishGit.mjs` |
| ref da dependência mudar durante o envio | o retrato vai pelo SHA que acabou de ser criado, não pelo ref | `publishGitDeps.mjs` (rt73) |
| worktree da lima sujo | o Git recusa o push (`updateInstead`); não contornar | Git |

O lock fica retido se o publish morrer no meio do envio (sinal, desconexão). Não apagar no começo de um publish: só quem confirmou que o
hook da lima terminou remove o diretório.

## Colisão: o que NÃO está protegido — conferir antes

1. **App com arquivos de outra sessão.** O `publish:git` passa `--autocommit`: tudo o que estiver sujo no app vira um commit `publish: …`
   e sobe. Antes: `git status --porcelain` no app. Arquivo que não é seu: `git stash push -- <arquivos>`, publicar, `git stash pop` e
   conferir que voltou igual.
2. **Dependência no meio de uma edição.** O retrato leva a pasta suja (`+dirty`). Antes: `git status --porcelain` em cada dependência que
   vai mudar; se houver trabalho de outra sessão, esperar ou combinar.
3. **Agente gerando no projeto.** Com `.collab-msg.lock` na raiz do app ou de uma dependência, um agente está escrevendo ali agora. O
   publish não olha esse arquivo: não publicar enquanto ele existir.

## Depois

Conferir o que ficou no ar, não só o exit: `readlink /data/mls-base/current-<id>` na lima, `curl -s localhost:20xx/` (302) e, se a mudança
for de tela, a receita de [`browserLocal.md`](browserLocal.md).
