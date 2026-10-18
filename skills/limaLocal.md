# Bancada local da lima — preparar e reservar

Receita única para Codex e Claude Code, no terminal do Mac, a partir do cwd `mls-base`. Os dois usam o mesmo comando e o mesmo protocolo. Não há cópia em `~/.codex` ou `~/.claude`. A instalação do `tools/browser` continua fora de `install:dev`, `postinstall`, `build` e `publish`.

Esta receita prepara o app **102047** na lima de teste e reserva a bancada para uma campanha. Outro id é recusado. Não há perfil remoto, `--host`, teste em VM de produção, nem aprovação extra para o localhost já autorizado.

O runtime prepara e atualiza a bancada entre rodadas. O tester reserva, lê o recibo, usa a UI local e encerra a campanha ao terminar. O tester não muda código, `.env` ou flag, não publica para corrigir falha de produto, não apaga o lock e não usa SSH, git ou SQL crus para contornar ocupação. Atualizar a raiz `mls-base` na lima também não é um `git push` manual: entra pelo `prepare`. `scripts/vm.mjs` opera o collab-sites remoto e não serve esta bancada.

## Campanha e jars

A campanha é a reserva da rodada (`--session`). As jars são os browsers nomeados dessa campanha. Exemplo: campanha `codex-ts01`, jars `codex-ts01-responsavel` e `codex-ts01-membro`. Duas jars do mesmo dono podem ficar abertas. Outra campanha, mesmo com o mesmo nome e outro dono, fica de fora.

O nome da sessão não é prova de posse. A posse fica na lima, em `/etc/collab/local-tests/lima.lock` (arquivo 0600, pasta 0700). O Mac só guarda uma referência privada 0600 no temp, para o par de browsers da mesma campanha. Encerrar o CLI não apaga a reserva. Não existe TTL nem `--force` para o tester.

`status` mostra quem está usando: sessão, projeto, fase (`reserved|preparing|ready|testing|failed`), início, operações e browsers. Não mostra `ownerId`, cookie, token, chave nem URL de banco. Outra sessão recebe exit 73, sem espera longa. Lock incompleto ou corrompido, operação de fim incerto e browser que não fechou ficam retidos. A recuperação é só do supervisor, com o `ownerId` esperado e a prova de que não há hook, operação nem browser em execução.

Há um único lock de campanha. O lock do publish no Mac (rt73) e o `.gitbuild.lock` do build continuam, e a reserva da lima vem antes deles. O `.collab-msg.lock` da geração é outra coisa: o prepare recusa repo sujo ou esse arquivo antes de enviar fonte.

## Comandos

Na raiz do `mls-base`. O `--` entrega os argumentos ao script.

```
rtk proxy pnpm run lima:preparar -- 102047 --session codex-ts01 --db migrate
```

Sem `--db`, o prepare usa `migrate` e registra isso no plano e no recibo. Reset explícito, só nesta lima de teste:

```
rtk proxy pnpm run lima:preparar -- 102047 --session codex-ts01 --db reset
```

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

O prepare adquire ou retoma a reserva, prepara fontes e release, migra ou reseta, semeia e só então marca `ready`. A reserva permanece. Com browser registrado, um novo prepare é recusado. Sem browser, `--db migrate` repete quando o ambiente já está coerente. `--db reset` reconstrói mesmo com o código igual.

Fora do `mls-base`:

```
node /Volumes/WagnerSSD1/collab/mls-base/tools/lima/lima.mjs prepare 102047 --session codex-ts01 --db migrate
```

## Migrate, reset, cm e recibo

`migrate` é o padrão. Conserva dados quando o esquema não muda. Não usa o `pnpm migrate` global.

`reset` só corre se `collab_app_test` for exclusivo desta bancada, o app 2047 estiver parado para o DDL e não houver consumidor ou objeto dependente alheio. Se o banco estiver compartilhado, ausente ou ambíguo, o comando recusa o reset e deixa o migrate disponível. Não apaga banco, schema, extensão nem tabelas de outro app. Apps 2043 e 2052 ficam no ar.

O banco limpo não limpa o cm. Humanos e histórico do cm permanecem. Depois de um reset, os MDMids antigos não valem: abrir jars novas e não reutilizar perfil ou storage da campanha anterior. Testes novos usam referências únicas da rodada.

O seed interno continua `scripts/runtime/prepareLocalTestBench.mjs` (`--member-role tarefas.MembroEquipe`). Ele agora só semeia dentro da reserva. Não é o comando de preparar a bancada.

O recibo pronto fica no temp do Mac (`lima-receipt-<sessão>.json`), escrito só depois de todos os checks. Traz sessão, fase, instante, VM, projeto, origem `localhost`, stamp da release (`id`, `client`, `versionRef`, `platformCommit`, `libs`, `monaco`), SHAs, árvores das dependências, resultado migrate/reset, módulos, Company, personas, CMids e limites. Falha apaga o recibo pronto e deixa um diagnóstico ao lado. Não promete perfis C14/C15, aviso diário nem integração How. O alpha das duas personas permanece. A instalação npm não é reproduzível byte a byte (pin `collabLibs` do Mac; lockfile fora, Wagner 04/09).

## Browser

O tester continua em `tools/browser`. O primeiro `open` da campanha leva `--lima-session`. Os comandos seguintes da mesma jar não repetem a opção. `help`, `version`, `list` e `setup` não reservam. `close` de uma jar não libera a campanha. `end` fecha só as jars desse dono e só então libera; se um close não se comprovar, a reserva fica.

```
rtk proxy pnpm run browser -- --lima-session codex-ts01 -s=codex-ts01-responsavel open http://localhost:2047/__test/session
rtk proxy pnpm run browser -- --lima-session codex-ts01 -s=codex-ts01-membro open http://localhost:2047/__test/session
node tools/lima/lima.mjs end --session codex-ts01
```

A leitura da UI, o idle e o seletor de pessoa estão em [`browserLocal.md`](browserLocal.md). Publish local e o seed antigo também respeitam esta reserva: com outro dono ou com browser aberto, recusam antes de mudar a bancada. O publish remoto não depende da lima.
