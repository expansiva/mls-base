# mls-base — índice de projetos

## Studio

| id | o que é |
|---|---|
| [100554](mls-100554/README.md) | **Núcleo do Studio** — o IDE do cliente: editores, serviços, painéis de agente, widgets (~350 ts) |
| [100555](mls-100555/README.md) | **Plugins do Studio** — 16 plugins (system, git, tester, explore, preview, style, architecture, …) |
| [102027](mls-102027/README.md) | **collab-comum** — biblioteca frontend compartilhada (`lib*`, enhancements, orquestração de IA, design system base) |
| [102041](mls-102041/README.md) | **collabInitial** — shell de produção do studio (`collab-page`, `collab-nav-*`), publicado como site estático |

## collab-messages

| id | o que é |
|---|---|
| [102025](mls-102025/README.md) | **Frontend do collab-messages** — threads, prompt, painel de tarefa, preview de run de agente (~935 ts) |
| [102036](mls-102036/README.md) | **Frontend base do collab-messages** — environment contract + IndexedDB, publica `dist/` |

## Masters — geração (onde ficam os agentes)

| id | o que é |
|---|---|
| [102020](mls-102020/README.md) | **Collab Aura2** — master de frontend; hospeda `agentNewSolution` e `agentChangeFrontend` |
| [102021](mls-102021/README.md) | **Collab Forge** — master de backend; hospeda `agentChangeBackend` |

## Masters — runtime (o que os apps gerados executam)

| id | o que é |
|---|---|
| [102033](mls-102033/README.md) | **Collab Aura** — master frontend do runtime |
| [102034](mls-102034/README.md) | **Collab Forge** — master backend do runtime |
| [102029](mls-102029/README.md) | **Collab Common Runtime** — primitivas de browser/runtime (`CollabLitElement`, …) usadas por todos |

Todo projeto cliente aponta para os dois lados:
frontend `102020` → runtime `102033`, backend `102021` → runtime `102034`.

## Catálogo do app gerado

| id | o que é |
|---|---|
| [102040](mls-102040/README.md) | **Catálogo de moléculas** — ~32 grupos de interação (`groupentertext`, `groupselectone`, `groupviewtable`, `groupviewchart`, …), cada um com suas variantes `ml-*`, que o gerador compõe nas páginas; inclui o harness isolado de teste de template (`test/`, fora de `l1..l7`) |

## Site público

| id | o que é |
|---|---|
| [102031](mls-102031/README.md) | **Landing site collab.codes** — páginas de marketing (`l2/www/en`, `dist/` datado) |
| [102032](mls-102032/README.md) | **Builder de landing page** — compile / preview / generateDist usado pelo 102031 |

## Aplicativos cliente (102039 a 102051)

| id | módulo | o que faz |
|---|---|---|
| [102047](mls-102047/README.md) | `petShopAgendamento` + `controleChamados` | agendamento de serviços para pets (admin/cliente, fotos antes-depois, agenda com bloqueios) e registro/comentário/encerramento de chamados |
| [102051](mls-102051/README.md) | `cafeFlow` | POS de cafeteria: pedidos mesa/takeout, status de cozinha, cardápio e estoque, fechamento de turno, resumo de vendas por IA |
| [102046](mls-102046/README.md) | `buildFlowFsm` (pt-BR, ns4) | construção e serviços de campo: custeio de obra, tarefas, materiais, timelog, change order, faturamento (~1140 ts) |
| [102049](mls-102049/README.md) | `petShop` | varejo pet: catálogo com busca e filtros, reserva online, pagamento na loja |
| [102048](mls-102048/README.md) | `buildFlowFsm` (en, newSolution3) | mesmo domínio do 102046; o run **falhou** — `l5/project.json` é o dump da task |
| [102030](mls-102030/README.md) | `petShopStripe` | e-commerce de pet shop com checkout Stripe — projeto cliente de exemplo |
| [102045](mls-102045/README.md) | `buildFlowFsm` | sem código: camadas esvaziadas, restos em `.collab-fs-trash` |
| [102050](mls-102050/README.md) | `cafeFlow` | sem código: declara só a dependência mdm do 102034 |
| [102044](mls-102044/README.md) | `repairBay` | sem código: oficina mecânica independente, nunca gerado |
| [102039](mls-102039/README.md) | — | sem código: scaffold puro, `modules: []` |
| `mls-102043` | — | pasta vazia, sem arquivo nenhum |

Três projetos usam o nome `buildFlowFsm` (`102046`, `102048`, `102045`) e dois
usam `cafeFlow` (`102051`, `102050`). Os apps são `102046`/`102048` e `102051`;
os outros são cascas.

## Atenção

`mls-base/config.json` lista o projeto `102047` com os módulos `todo`,
`listaAssinatura` e `listaAssinatura3`. Nenhum existe em disco — o `102047` tem
`petShopAgendamento` e `controleChamados`.
