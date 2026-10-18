# Browser local — Playwright CLI com Chromium

Mesma ferramenta para Codex e Claude Code, pelo terminal do Mac. Não há MCP, skill global nem configuração em `~/.codex` ou `~/.claude`. O `--help` do launcher e este arquivo são a mesma referência.

O pacote é `mls-base/tools/browser`. A instalação não entra em `install:dev`, `postinstall`, `build` nem `publish`. Se a dependência falta, o comando responde com a receita de setup. Não inventar instalação em `/tmp`.

## Setup, uma vez, no Mac

Na raiz do `mls-base`:

```
rtk pnpm run browser:setup
```

Fora do `mls-base` (chat com outro cwd):

```
node /Volumes/WagnerSSD1/collab/mls-base/tools/browser/browser.mjs setup
```

Só Darwin instala. O motor é o Chromium do Playwright: no Firefox do Playwright (156) a página perde o service worker depois da primeira navegação; no Chromium (Chrome for Testing 155) o `controller` permanece nos reloads. Sem `channel` e sem o Google Chrome de marca do Mac. Sem perfil humano, sem Edge, WebKit ou Firefox como motor.

## Sessão nomeada

Reutilizar o mesmo `-s=` durante a rodada. Não gerar id novo a cada comando e não usar perfil humano.

- Codex: `-s=codex-<id>`
- Claude Code: `-s=claude-<id>`

Uma instalação serve aos dois. Cada um usa sessão e, se precisar de disco, um `--profile` próprio. Os dois não compartilham o mesmo perfil ao mesmo tempo. Fechar uma sessão não fecha a outra. O launcher recusa `close-all` e `kill-all`.

Headless é o padrão. Idle da sessão headless: 5 min. Prazo: 60 s por operação, 10 min no setup. `--headed` quando a inspeção visual pedir.

## Comandos

Na raiz do `mls-base` (o `--` entrega os argumentos ao launcher):

```
rtk pnpm run browser -- -s=codex-<id> open http://localhost:2047
rtk pnpm run browser -- -s=codex-<id> find "Entrar"
rtk pnpm run browser -- -s=codex-<id> snapshot e12 --depth=4
rtk pnpm run browser -- -s=codex-<id> click e12
rtk pnpm run browser -- -s=codex-<id> click "getByRole('button', { name: 'Entrar' })"
rtk pnpm run browser -- -s=codex-<id> fill e20 "texto"
rtk pnpm run browser -- -s=codex-<id> press Enter
rtk pnpm run browser -- -s=codex-<id> console warning
rtk pnpm run browser -- -s=codex-<id> requests
rtk pnpm run browser -- -s=codex-<id> screenshot e12 --filename=/tmp/painel.png
rtk pnpm run browser -- -s=codex-<id> close
```

Claude Code, a mesma sequência com `-s=claude-<id>`.

Fora do `mls-base`:

```
node /Volumes/WagnerSSD1/collab/mls-base/tools/browser/browser.mjs -s=codex-<id> open http://localhost:2047
node /Volumes/WagnerSSD1/collab/mls-base/tools/browser/browser.mjs -s=claude-<id> find "Entrar"
node /Volumes/WagnerSSD1/collab/mls-base/tools/browser/browser.mjs -s=claude-<id> close
```

`list`, `help` e `version` não exigem sessão. `open http://localhost:2047` é a lima no Mac (app 102047). Esperar o pronto da página por um sinal real (`collabMiniCfeReady` ou o controle do cenário). `networkidle` sozinho não prova que o app subiu.

## Leitura que cabe no contexto

1. Abrir e ler o resumo curto que o comando já devolve.
2. `find` pelo nome do botão ou da região. Não pedir a árvore inteira.
3. `snapshot <ref> --depth=4` só da região. Guardar o arquivo se o stdout ainda for grande.
4. Agir: `click` pela ref atual, ou por locator estável (`getByRole` / `getByTestId`) num percurso já conhecido.
5. Verificar o resultado com um `find` ou um snapshot da mesma região.

Não devolver o HTML da página nem a árvore a cada passo. Screenshot recortada (`screenshot <ref>`) só para aparência, alinhamento ou CSS, e de novo depois de uma mudança visual. O snapshot não prova aparência.

Renovação de ref: depois que o DOM muda, a ref antiga não vale. O locator de papel e nome continua valendo se o papel e o nome continuam.

`eval` serve para uma observação pontual ou para agrupar leituras. Não usar JavaScript para executar o clique que se quer testar.

## Percurso conhecido

`run-code` (inline ou `--filename`) agrupa uma sequência já conhecida e devolve menos chamadas. Isso não adiciona Playwright Test, MCP nem Puppeteer ao pacote.

Sem vídeo, sem trace contínuo e sem várias abas ou browsers por padrão.

- Frio: `open` sem reaproveitar a sessão, ou `--profile` de uma pasta nova e dedicada. Estado vazio de propósito.
- Quente: a mesma sessão. `reload` é o F5; cookies e storage da sessão permanecem até `close`.

Perfil em disco só quando a sessão precisa sobreviver ao fecho do browser, numa pasta dedicada àquele cliente. Não gravar token, cookie ou storage neste documento nem no código.

## Cache e service worker

No Chromium o service worker continua controlando a página nos F5, e `context.serviceWorkers()` existe nesse motor. Para cache e service worker, ler as APIs da própria página (CacheStorage, registration) e os logs ou contadores que o harness já emite. Não bloquear o service worker e não usar `route` para medir cache HTTP: o routing desliga esse cache.

O harness Puppeteer/Firefox anterior continua disponível. Sem perfil humano e sem o Google Chrome de marca.

## Bancada de duas pessoas na lima

Pré-requisitos, já na lima: runtime do app com o seed MDM compilado na release, collab-messages instalado, bancos de teste existentes. Este comando não roda migrate, não recria schema e não instala outro browser. A pasta `/etc/collab/local-tests` precisa ser gravável pelo usuário da lima (modo 0700, arquivo 0600); se a permissão faltar, o supervisor libera. Não copiar `.env` nem token para o Mac.

Na raiz do `mls-base`, um comando. Os caminhos são os da VM. O SSH é só o alias `lima-ubuntu24`.

```
node scripts/runtime/prepareLocalTestBench.mjs --project 102047 --runtime-root <release-do-app> --cm-root <cm-local>
```

O manifesto fica em `/etc/collab/local-tests/102047.json` (o id muda com o projeto), fora da release, do git e dos estáticos. A saída mostra o caminho e os ids da bancada. A `cookieKey` não aparece.

Quatro ids, com papéis diferentes:

- alias `responsavel` ou `membro` — perfil de teste, não um papel real; os dois seguem com o super do alpha
- sub `local-test:<projectId>:<alias>` — identidade local estável
- `personMdmId` — a pessoa no MDM
- `cmUserId` — o humano no cm, diferente do email, do sub e do id MDM

O email `alias.<projectId>@runtime.test` liga os dois stores. `cmOrgId` `runtime-test:<projectId>` é o tenant da bancada, não o id da Company. `cmTarget` é `http://127.0.0.1:8180`. As origens são só `localhost` e `127.0.0.1` na porta do slot.

Limite desta preparação: não autentica o navegador e não prova mensagem nem Task. Isso é a sessão abaixo e, na VM, a prova da rt86.

Repetir o mesmo comando depois de um banco novo. Email e sub reaproveitam as pessoas e os humanos; a `cookieKey` já gravada permanece. Se o cm falhar, o MDM fica como está e o manifesto anterior não é trocado. Rodar o comando de novo retoma o que faltou.

## Sessão de teste no browser, só na lima

A `.env` de `/data/mls-base/.env` é compartilhada por todas as portas. Não gravar a flag ali.

O supervisor grava as duas linhas no `env` de `/data/mls-base/pm2.apps.d/app<porta>.config.js` do app da bancada, e em nenhum outro lugar. No 102047 a porta é 2047:

```
    LOCAL_TEST_SESSION_ENABLED: "true",
    LOCAL_TEST_SESSIONS_FILE: "/etc/collab/local-tests/102047.json"
```

O caminho é absoluto, fica sob `/etc/collab/local-tests/` e o arquivo é `<projectId>.json`. A flag é a string `"true"`. As duas linhas vão juntas. O gerador do pm2 não cria esses campos: na publicação seguinte ele só os reescreve quando o arquivo do app já os tem nesse formato. A instalação é manual e só na lima.

Depois da gravação:

```
pm2 restart /data/mls-base/pm2.apps.d/app2047.config.js --update-env
```

Trocar de pessoa não reinicia o app. Desligar é apagar as duas linhas e o mesmo `pm2 restart <arquivo> --update-env`. A flag e o arquivo não entram na release, no cfe nem no repositório. Não imprimir `cookieKey`, token de serviço nem o conteúdo do manifesto.

Dois perfis limpos da ferramenta, um por pessoa. Sem outra aba dessa origem durante a troca: o seletor apaga `msgDB`, `serviceCollabMessages` e `collabMessages_userId` e, se outra aba bloquear o IndexedDB, não troca a sessão. Sem perfil humano e sem o Google Chrome de marca.

```
rtk pnpm run browser -- -s=responsavel open http://localhost:2047/__test/session
rtk pnpm run browser -- -s=responsavel click "getByRole('button', { name: 'responsavel' })"
rtk pnpm run browser -- -s=responsavel open http://localhost:2047/<rota-do-modulo>
rtk pnpm run browser -- -s=membro open http://localhost:2047/__test/session
rtk pnpm run browser -- -s=membro click "getByRole('button', { name: 'membro' })"
```

A página diz "Local test session". Os botões são `responsavel`, `membro` e `Leave session`. A troca navega para `/`. Para uma rota do módulo, abrir essa rota depois da seleção. `reload` (F5) conserva a seleção. `Leave session` ou `GET /exec/logout` saem. Apagar as duas linhas do `env` do app e `pm2 restart <arquivo> --update-env` revoga o mecanismo; a rota `/__test/session` responde 404.

Conferir os dois lados pelo JSON, não por screenshot: `/session/info` traz `userId` (o sub), `person.mdmId` e a mesma `company.mdmId`; `/whoami` traz o `cmUserId` da pessoa selecionada. Os quatro ids continuam distintos. A prova de mensagem real e de Task é a rt86 na lima, com upstream de verdade. O teste de composição desta receita usa upstream controlado e não substitui essa prova.