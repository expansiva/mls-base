# Bancada local da lima — preparar e reservar

Receita única para Codex e Claude Code, no terminal do Mac, a partir do cwd `mls-base`. Os dois usam o mesmo comando e o mesmo protocolo. Não há cópia em `~/.codex` ou `~/.claude`. A instalação do `tools/browser` continua fora de `install:dev`, `postinstall`, `build` e `publish`.

Esta receita prepara um app da lista da bancada (`SUPPORTED_PROJECTS` em `tools/lima/session.mjs`: **102047** e **102056**) na lima de teste e reserva a bancada para uma campanha. Outro id é recusado. A reserva é única: um projeto por vez. Não há perfil remoto, `--host`, teste em VM de produção, nem aprovação extra para o localhost já autorizado.

**Quem prepara (Wagner, 19/10/2026):** *"vamos alterar isto porque dificultou para mim [...] vc só entra em caso de erros ou coisas complicadas, assim evita este ping pong"*. O tester prepara a própria campanha com `prepare`, usa a UI local e encerra com `end`. O supervisor do runtime só entra quando algo dá errado: prepare que não chega a `ready`, reserva em `failed` ou com operação incerta (`recover`), topologia do PM2, ref local órfã ou outra campanha ocupando a bancada sem dono que responda.

O tester não muda código, `.env` ou flag, não publica para corrigir falha de produto, não apaga o lock e não usa SSH, git ou SQL crus para contornar ocupação ou erro. Atualizar a raiz `mls-base` na lima também não é um `git push` manual: entra pelo `prepare`. `scripts/vm.mjs` opera o collab-sites remoto e não serve esta bancada.

## Campanha e jars

A campanha é a reserva da rodada (`--session`). As jars são os browsers nomeados dessa campanha. Exemplo: campanha `codex-ts01`, jars `codex-ts01-responsavel` e `codex-ts01-membro`. Duas jars do mesmo dono podem ficar abertas. Outra campanha, mesmo com o mesmo nome e outro dono, fica de fora.

O nome da sessão não é prova de posse. A posse fica na lima, em `/etc/collab/local-tests/lima.lock` (arquivo 0600, pasta 0700). O Mac só guarda uma referência privada 0600 no temp, para o par de browsers da mesma campanha. Encerrar o CLI não apaga a reserva. Não existe TTL nem `--force` para o tester.

**A referência do Mac é cache, não reserva (rt98, 19/10/2026).** Quem decide a posse é o `status` da lima.
- O `publish:git` pergunta à lima antes de olhar os arquivos `$TMPDIR/collab-lima/*.json`.
- Com `held:false` comprovado, ignora todas as referências antigas, inclusive as de campanhas recuperadas ou encerradas, e reserva de novo.
- Com `held:true`, usa só a referência da sessão que a lima aponta, depois de conferir dono, operação atual e ausência de browser.
- `status` incerto (SSH caído, JSON inválido, sem `held`) recusa.
- Não é preciso mover nem apagar referência antiga para publicar, e não se apaga como rotina.
- Uma campanha recuperada acabou: a rodada seguinte usa campanha nova ou `begin` válido.

`status` mostra quem está usando: sessão, projeto, fase (`reserved|preparing|ready|testing|failed`), início, operações e browsers. Não mostra `ownerId`, cookie, token, chave nem URL de banco. Outra sessão recebe exit 73, sem espera longa. Lock incompleto ou corrompido, operação de fim incerto e browser que não fechou ficam retidos. A recuperação é só do supervisor, com o `ownerId` esperado e a prova de que não há hook, operação nem browser em execução.

Há um único lock de campanha. O lock do publish no Mac (rt73) e o `.gitbuild.lock` do build continuam, e a reserva da lima vem antes deles. O `.collab-msg.lock` da geração é outra coisa: o prepare recusa repo sujo ou esse arquivo antes de enviar fonte.

## Comandos

Na raiz do `mls-base`. O `--` entrega os argumentos ao script.

```
rtk proxy pnpm run lima:preparar -- 102047 --session codex-ts01 --db migrate
```

Sem `--db`, o prepare usa `migrate` e registra isso no plano e no recibo.

Claude Code, o mesmo protocolo, outro nome de campanha:

```
rtk proxy pnpm run lima:preparar -- 102047 --session claude-ts01 --db migrate
```

`begin`, `status` e `end` não são scripts do `package.json`. São o mesmo CLI:

```
node tools/lima/lima.mjs begin 102047 --session codex-ts01
node tools/lima/lima.mjs status --session codex-ts01
node tools/lima/lima.mjs status
node tools/lima/lima.mjs end --session codex-ts01
```

`help` e `status` só leem. Não iniciam prepare nem browser. `--dry-run` mede ocupação e o plano, sem reserva nova, publish, banco ou seed:

```
node tools/lima/lima.mjs prepare 102047 --session codex-ts01 --dry-run
```

O prepare adquire ou retoma a reserva, prepara fontes e release, migra, semeia e só então marca `ready`. A reserva permanece. Com browser registrado, um novo prepare é recusado. Sem browser, `--db migrate` repete quando o ambiente já está coerente.

Fora do `mls-base`:

```
node /Volumes/WagnerSSD1/collab/mls-base/tools/lima/lima.mjs prepare 102047 --session codex-ts01 --db migrate
```

## Migrate, cm e recibo

`migrate` é o padrão. Conserva dados quando o esquema não muda. Não usa o `pnpm migrate` global.

Reset indisponível (decisão de 18/10/2026), só `migrate`.

Humanos e histórico do cm permanecem. Testes novos usam referências únicas da rodada.

O seed interno continua `scripts/runtime/prepareLocalTestBench.mjs` (`--member-role tarefas.MembroEquipe`). Ele agora só semeia dentro da reserva. Não é o comando de preparar a bancada.

O recibo pronto fica no temp do Mac (`lima-receipt-<sessão>.json`), escrito só depois de todos os checks. Traz sessão, fase, instante, VM, projeto, origem `localhost`, stamp da release (`id`, `client`, `versionRef`, `platformCommit`, `libs`, `monaco`), SHAs, árvores das dependências, resultado migrate/reset, módulos, Company, personas, CMids e limites. Falha apaga o recibo pronto e deixa um diagnóstico ao lado. Não promete perfis C14/C15, aviso diário nem integração How. O alpha das duas personas permanece. A instalação npm não é reproduzível byte a byte (pin `collabLibs` do Mac; lockfile fora, Wagner 04/09).

A preparação lê o PM2 depois do health. A bancada fica pronta como infraestrutura quando os dois processos do app estão online e a contagem declarada é 2 (`runtimeTopology.expectedWorkers` e `onlineWorkers`, ambos 2). Metadado ausente, contagem divergente, um único worker ainda online ou leitura inválida deixam a preparação não pronta, com diagnóstico, e a reserva retida. Não reduzir workers nem mudar a topologia do PM2 para acomodar estado local.

O recibo `ready` descreve a topologia observada. Não é aceite do ciclo, não afirma integração durável de Task/steps e não libera reteste do workflow em memória de processo. A preparação de infraestrutura não comprova esse ciclo; ele espera a integração durável em Task/steps e um recibo específico. Outro processo atender em seguida, ou um restart, é situação normal desse workflow durável: a receita não manda o tester evitá-la reduzindo workers, segurando a release ou contornando guard ou lock. O histórico de falhas permanece. `end` encerra a campanha e não apaga esse histórico.

## Os dois projetos da bancada (rt107, 20/10/2026)

- **Desde 20/10 a bancada é o 102056** (Wagner: *"ele vai ser a bancada agora, vou parar o módulo tarefas até completar o onboarding"*).
  Os exemplos abaixo com 102047 valem trocando o id.
- **Seed por projeto:**
  - o 102047 aplica o papel do tarefas (`tarefas.MembroEquipe`);
  - os outros usam o seed sem papel de módulo.
- **Sem bloco `onboarding` no `config.json` da release não há seed.** O `prepare` fica `ready` com `seedSkipped: true` no recibo, sem
  Company e sem logins de teste (limite `no test logins: the project has no onboarding block yet`). É o caso do 102056 até o onboarding
  dele ser gerado. Config ilegível é erro, nunca "sem seed".
- **Remoto do Mac:** o `mls-102056` do Mac tem `vm` → produção. O publish para a lima usa `vm-local`, e o `publishGit` nunca reescreve um
  remoto que aponta para outro destino. Não trocar o `vm` à mão.

## O tester prepara a própria campanha

`begin` sozinho deixa a reserva em `reserved`, e o browser só liga em `ready` (medido em 18/10/2026: `bench reservation is not ready`). Quem deixa `ready` é o `prepare`. O tester roda, do cwd `mls-base`:

```
node tools/lima/lima.mjs status
node tools/lima/lima.mjs prepare 102047 --session tester-<rodada> --db migrate
```

Depois abre as jars com `--lima-session tester-<rodada>` e dá o `end` ao terminar. Próxima rodada, campanha nova.

**O que o `prepare` faz:**
- Publica o que está no HEAD de cada repo do Mac, inclusive commits de outras sessões, e recusa repo sujo.
- Roda o migrate no banco de teste. Não há reset.
- Reinicia o app2047. O app2043 e o app2052 também reiniciam quando a release da plataforma muda.
- Leva poucos minutos.

**Antes de rodar:**
- `status` com `held:false`. Se outra campanha estiver ativa, esperar o dono; não apagar lock.
- Os repos que entram no publish (raiz `mls-base`, 102047 e dependências) sem arquivo sujo. Arquivo sujo de outra sessão não é do tester: não commitar nem guardar. Esperar o dono ou chamar o supervisor.

**Quando chamar o supervisor do runtime** (arquivo `fromTester_*` no pool do runtime, com a saída bruta):
- `prepare` sai com código diferente de zero ou sem `ready:true`;
- `status` mostra `phase:"failed"` ou operação `uncertain`. Não repetir o `prepare` por conta própria: a reserva fica retida até o `recover`, que é do supervisor;
- `publish:git` ou `prepare` recusado com "owner file does not match the reservation", "lima reservation belongs to session …" ou "lima reservation status is uncertain";
- `healthOk` falso, menos de 2 workers online ou app fora do ar;
- qualquer coisa que peça SSH, PM2, SQL ou `.env`.

**O recibo é o JSON do próprio `prepare`.** Release, SHAs, `healthOk`, `runtimeTopology` e limites: anotar na task do tester. O `todo/runtime/docs/bancada_tester_102047.md` guarda só o último recibo do supervisor e as condições gerais.

## Browser

O tester continua em `tools/browser`. O primeiro `open` da campanha leva `--lima-session`. Os comandos seguintes da mesma jar não repetem a opção. `help`, `version`, `list` e `setup` não reservam. `close` de uma jar não libera a campanha. `end` fecha só as jars desse dono e só então libera; se um close não se comprovar, a reserva fica.

```
rtk proxy pnpm run browser -- --lima-session codex-ts01 -s=codex-ts01-responsavel open http://localhost:2047/__test/session
rtk proxy pnpm run browser -- --lima-session codex-ts01 -s=codex-ts01-membro open http://localhost:2047/__test/session
node tools/lima/lima.mjs end --session codex-ts01
```

A leitura da UI, o idle e o seletor de pessoa estão em [`browserLocal.md`](browserLocal.md). Publish local e o seed antigo também respeitam esta reserva: com outro dono ou com browser aberto, recusam antes de mudar a bancada. O publish remoto não depende da lima.
