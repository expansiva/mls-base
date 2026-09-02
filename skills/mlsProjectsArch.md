## Arquitetura aplicativo cliente em produção 

mls-base/
    mls-102033/
        // master frontend, rotinas comuns para todos os aplicativos em produção 
    mls-102034/
        // master backend , rotinas comuns para todos os aplicativos em produção
    mls-102030/
        // app final gerado, pode ser o 102051, etc

        l1/
            // back-end, hexagonal model
            petshop/
                layer_1_external/
                layer_2_application/
                layer_3_domain/
            stripe/
                // um plugin irá ter um endpoint e pode atender a vários módulos 
                // como o módulo stripe é criado após o módulo petshop, além de definir as funcionalidades deve ter um arquivo de configuração para o plugin saber quais módulos, etc 
        l2/
            // front-end
            petshop/
                // nome do módulo = petshop, um projeto pode ter vários módulos
                web/
                    contracts/
                    shared/
                    desktop/
                        page11/
                            // dispositivo = web / desktop
                            // page11 = layout 1 , DS 1 

            plugins/ 
                stripe/
                    // rotinas para conexão com este plugin
                    // a criação de um novo plugin pode ser feito pelo agentNewSolution após ajustes
            financeiro/
                // módulo horizontal 
        l3/
            // assets
        l4/
            // business
            petshop/
        l5/
            // admin
            config.json
            project.json -> plan, lista de módulos, etc, seguir modelo 
            petshop/

## Três implementações da lib mls

A superfície `mls.*` (o objeto global que o código do Studio e do runtime chama) tem **três
implementações**, não uma. Conferido 01/09/2026.

| # | onde corre | o que é | âncora |
|---|---|---|---|
| (a) **cfe** (browser / Studio) | gerada em `cfe-collab-front-end`, servida como `/libs/mls.js` | a lib "oficial": namespaces `mls.stor`, `mls.sites`, `mls.editor`, … `mls.sites` é um *forwarder* mudo — getters devolvem `undefined` e setters são no-op até alguém chamar `register()` | `cfe-collab-front-end/src/sites/sites.ts:33` (`register`), `:53` (`getLanguage`); declaração `cfe-collab-front-end/wwwroot/mls.d.ts:1502` (`declare namespace mls.sites`) |
| (b) **host** collab-msg (Deno) | `installGlobalMls` monta `globalThis.mls` no CLI | subconjunto da superfície, descrito em `collab-msg/spec/04_superficie_mls.md`. Em 01/09/2026 monta `actualProject` / `stor` / `editor` / `l5` — **não** monta `mls.sites` | `collab-msg/collab-mls/src/stor.ts:267` |
| (c) **runtime na VM** | shell `mls-102033` depois do mount | usa a lib da cfe (a) e **injeta** os handlers reais via `mls.sites.register(...)` (idioma, DS, header, aside, page). Antes do register, o comportamento é o da cfe: getters `undefined` | `mls-102033/l2/shared/shell.ts:737` (`registerSitesControls`); `getLanguage` do shell em `:644`, passado no `register` em `:744` |

Espelho de tipos no `mls-base`: `mls-base/types/mls.d.ts:1502` (`mls.sites`, mesmo texto que o `wwwroot/mls.d.ts`).

**Regra (01/09/2026):** mudança de **superfície** (novo método, nova assinatura, novo namespace) altera as **3** implementações, e os **espelhos** de `mls.d.ts` (`cfe-collab-front-end/wwwroot/mls.d.ts` e `mls-base/types/mls.d.ts`) quando a declaração muda. Mudança de **comportamento** (o que um método já existente devolve) confere as 3 — o host pode ser `parcial` ou `stub` (ver a tabela de fidelidade em `collab-msg/spec/04_superficie_mls.md`), mas não pode ficar em silêncio com a superfície velha.

Consumo host-agnóstico da superfície: optional chaining (`mls.sites?.getLanguage?.()`), para o Studio antes do `register` e o host sem `sites` caírem no fallback local. `getMessageKey` (102029 `libCommom.ts:836`; 102025 `collabMessagesHelper.ts` importa essa exportação) resolve idioma nessa cadeia: `mls.sites.getLanguage` → `document.documentElement.lang` (com `typeof document`) → primeira chave (`en`). Cópias antigas, só `document`, ficam em `collabLitElement.ts:48` e `collabLandingPage.ts:34` (UI do Studio; o shell da VM escreve `document.documentElement.lang`, então hoje concordam com `mls.sites`).

## Bibliotecas e módulos compartilhados do runtime

As versões abaixo correspondem ao manifesto atual do `mls-base`. Bibliotecas de build não devem ser confundidas com módulos JavaScript carregados pelo navegador.

### Frontend base

- **Lit 3.3** — base dos Web Components, páginas, shell e componentes compartilhados do runtime.
- **Tailwind CSS 4.2** — utilitários visuais compilados durante o build e disponibilizados no CSS publicado do master frontend.
- **Aura Shell** — shell interno do `mls-102033`, responsável por layout, regiões, navegação, carregamento de rotas e integração com o design system.
- **Design System do runtime** — tokens, temas e estilos compartilhados carregados pelo master frontend.

Lit e o shell fazem parte do bootstrap da aplicação. O Tailwind não permanece como biblioteca JavaScript no navegador: seu resultado é CSS compilado no publish.

### Gráficos e visualização de dados

- **Apache ECharts 6.1** — engine padrão para gráficos de aplicações business e monitoramento.
- O módulo compartilhado está em `/_102033_/l2/shared/chartRuntime.js`.
- É publicado como chunk ESM separado e carregado somente no primeiro `import()`.
- Após o primeiro carregamento, o módulo é reutilizado pelo cache nativo de módulos do navegador durante a sessão da aplicação.
- O runtime compartilhado registra gráficos de linha, barra, pizza, dispersão, gauge, funil, heatmap, treemap, sunburst, sankey, grafo, candlestick e boxplot, além de tooltip, legenda, dataset, zoom, toolbox, marcações, acessibilidade e renderização Canvas.

### Componentes de interface e shadcn

O runtime não possui atualmente `shadcn/ui`, Radix UI ou seus pacotes auxiliares como dependências. A base de interface equivalente é composta por Lit, Tailwind CSS, Aura Shell e pelo design system do runtime.

Componentes inspirados no padrão visual do shadcn podem existir como código de aplicação, mas não devem ser tratados como uma biblioteca global já carregada pelo runtime.

### Backend base

- **Node.js** — processo de execução dos aplicativos publicados.
- **Fastify 5.6** — servidor HTTP e transporte do backend.
- **PostgreSQL (`pg` 8.16)** — driver do banco relacional, incluindo ambientes com TimescaleDB.
- **AWS SDK v3 para DynamoDB** — acesso ao DynamoDB e ao Document Client.
- **node-fetch 2.7** — compatibilidade HTTP para módulos que ainda dependem dessa implementação.

### Build e publish

- **TypeScript 5** — compilação e validação dos projetos.
- **esbuild 0.27** — geração dos bundles ESM, code splitting e chunks compartilhados ou sob demanda.
- **Less 4** — processamento dos estilos legados e estilos de componentes.
- **Tailwind CLI 4** — geração do CSS final do master frontend.

Essas ferramentas executam durante build ou publish e não são carregadas como dependências de execução no navegador.

        
