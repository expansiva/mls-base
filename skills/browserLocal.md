# Browser local — Playwright CLI com Firefox

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

Só Darwin instala. O setup pede o Firefox do Playwright, não o Firefox de `/Applications` e não Chromium, Chrome, Edge ou WebKit.

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

Não afirmar que `context.serviceWorkers()` funciona no Firefox. Para cache e service worker, ler as APIs da própria página (CacheStorage, registration) e os logs ou contadores que o harness já emite. Não bloquear o service worker e não usar `route` para medir cache HTTP: o routing desliga esse cache.

O harness Puppeteer/Firefox anterior continua como está. Sem fallback para Chrome.