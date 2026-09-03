# Skill: Git-push publish (gitBackend) — the second way an app reaches the VM

Complements [`runtimeEnvironment.md`](runtimeEnvironment.md), which describes the **traditional**
publish (tarball → VM → `pnpm build` → release). This file describes the **git path**, built
30–31/08/2026, and how the two coexist.

## The idea

Every `mls-<id>` folder on the VM is a normal (non-bare) git repo. You push; a `post-receive` hook
compiles and cuts a release. No tarball, no full publish.

| piece | file |
|---|---|
| setup on the VM (idempotent) | `mls-base/scripts/runtime/gitReposSetup.mjs --root /data/mls-base` |
| hook | `mls-base/scripts/runtime/gitPostReceive.sh` → `gitPostReceive.mjs` |
| client side | `mls-base/scripts/publishGit.mjs <projectId> local\|remote [--align] [--autocommit]` |
| clone from VM | `mls-base/scripts/publishGit.mjs <projectId> clone local\|remote` |

Each repo gets `main` + an immutable `vm-baseline` snapshot and
`receive.denyCurrentBranch=updateInstead`, so a push against a dirty worktree is refused instead of
silently overwriting. The hook only swaps the release when the compile passes, and prints
`##gitBackend build=ok|error##`; `publishGit`'s exit code follows the BUILD.

## Two rules that are not obvious

**1. The local `obj/` is disposable, and `publishGit` deletes it.** Before pushing, it removes
`obj/` from disk and from git, ensures the ignore and commits (`chore: remove obj/`). The build that
matters is produced on the VM by the hook (and on GitHub by the Action). Keeping `obj/` versioned
makes the hook's rewrite dirty the VM worktree, and `updateInstead` then refuses every later push.

**2. The traditional publish destroys these repos, and re-arms them.** `publishMlsBase.py` replaces
each project folder wholesale (`rm -rf`, the rsync `--delete` equivalent) and the tarball excludes
`.git`. So after a **successful** deploy it re-runs `gitReposSetup` on the VM. A failure to re-arm
is a warning only — the app is already up; the exit code stays 0 and the message says what to run
by hand. The `--sites` path does not wipe source dirs and does not re-arm.

**Since gb16 this only applies to publish-managed projects.** A project born with `vm:init`
carries `.collab-git`, and the traditional publish reads those markers off the VM before packing:
it neither wipes the folder nor ships its sources/obj. Its history survives every traditional
publish, so `publishGit` stays a fast-forward and never asks for `--align`. Publishing such a
project the traditional way is refused, with the `publishGit` command in the message.

**Accepted cost (publish-managed projects only):** after a traditional publish the VM's history is
new (`vm-baseline: initial snapshot`), so the next `publishGit` asks for `--align` (diff +
confirmation) once. Visible and
explainable, which is the point. Measured 02/09/2026: the expected diff is the VM `.gitignore`
block that `gitReposSetup` writes, plus `l5/config.json` (a build artefact). Confirmation of
`--align` is human by design — `clone` never answers it and never force-pushes.

## Supervisor cycle (preferred)

The LLM session that made the changes **commits them**, then `publishGit` only pushes. That is
the history that seeds the VM on a client-class project. Cycle:

1. **Verify** — `git status` / `git diff` in `mls-<id>`; summarise what changed.
2. **Commit** — a coherent message written by the LLM. After this, `publishGit` does not need
   `--autocommit`.
3. **Publish** — from `mls-<id>`: `pnpm publish:git` (lima) or `pnpm publish:remote` (production
   VM). Same as `node scripts/publishGit.mjs <id> local|remote`. Add `--align` only on the first
   unrelated-histories push (the confirmation is interactive; do not auto-answer it).
4. **Test** — `/monitor/tests` on the new release.
5. **Report** — passed / failed × the baseline.

`--autocommit` is the deterministic fallback when there is no LLM commit: `git add -A` (honouring
`.gitignore`) plus one `publish: <area> (n arquivos), …` message, e.g.
`publish: l2/listaAssinatura2 (14 arquivos), l4 (3 arquivos), l5 (2 arquivos)`. Without the flag
a dirty worktree is refused and the error cites the flag and this skill.

Studio bookkeeping (`.collab-fs.json`, `.collab-fs-trash/`) is not source: `publishGit` adds both
to the project's `.gitignore` before that `git add -A`, so they never enter the autocommit.

## Client wrappers (02/09/2026)

From inside `mls-<id>` (102047 first; the rest in the client-app migration):

| script | what it is |
|---|---|
| `pnpm publish` | traditional remote publish via collab-sites (`--sites`). Still what **creates / mounts** the VM. |
| `pnpm publish:local` | traditional local publish (tarball → lima). |
| `pnpm publish:git` | `node ../scripts/publishGit.mjs <id> local` — git push to lima. |
| `pnpm publish:remote` | `node ../scripts/publishGit.mjs <id> remote` — git push to the production VM. |

`publish` / `publish:local` are not replaced. Gate, markers (`##gitBackend build=ok|error##`) and
exit code are the same on both git wrappers.

## Remote profile

`local` reads `mls-base/.env` (`PUBLISH_LOCAL_SSH_HOST`, `PUBLISH_LOCAL_SSH_CONFIG`,
`PUBLISH_LOCAL_REMOTE_BASE`). `remote` reads CLI flags (`--ssh-host`, `--ssh-config`,
`--remote-base`) or `mls-base/servers/remote.conf`. Template: `servers/remote.conf.example`
(SSH_HOST, SSH_CONFIG with an SSM `ProxyCommand`, `REMOTE_BASE=/data/mls-base`). The real
`servers/*.conf` files are gitignored — no tokens in git. Missing `remote.conf` prints the exact
path to create (copy from the example); it does not dump a stack.

## Start a project on the VM — `pnpm vm:init <id>`

One command for "start the VM, put the project there (empty), clone it here, ready to change and
push". Every step is idempotent — a second run finds everything in place and changes nothing.

```
pnpm vm:init 102043            # perfil local (lima), scaffold mls-102039
pnpm vm:init 102043 --force    # recria na VM, SÓ se main == vm-baseline
```

What it does, in order: brings the lima instance up (derived from `PUBLISH_LOCAL_SSH_CONFIG`, or
`PUBLISH_LOCAL_LIMA_INSTANCE`) and waits for ssh → checks the platform is on the VM (it refuses
with the exact command instead of improvising a parallel install) → copies the scaffold **on the
VM** without `obj/`, `.git` or `.github`, substituting the id → writes `.collab-git` → runs
`gitReposSetup` → clones on the Mac with remote `vm`.

Order that matters: `.collab-git` is written **before** `gitReposSetup`, so the marker is inside
the `vm-baseline` commit — that is what makes the project git-managed from its very first byte.
`.github` is left out on purpose: a VM-first project is not on GitHub, and the Action would commit
`obj/compiled.zip` back into the history the marker exists to protect.

## Clone from the VM

URL (same ssh-config as publish):

```
ssh://<user>@<host>/data/mls-base/mls-<id>
```

`publishGit` sets `GIT_SSH_COMMAND=ssh -F <SSH_CONFIG>` when `SSH_CONFIG` is set. What you get:
branch `main` plus the immutable `vm-baseline` snapshot.

```
# lima
node scripts/publishGit.mjs <id> clone local
# production VM (needs servers/remote.conf)
node scripts/publishGit.mjs <id> clone remote
```

Three cases — never overwrites local work, never force-pushes, never auto-answers `--align`:

| local folder | what `clone` does |
|---|---|
| missing | `git clone -o vm` |
| exists, no `.git` | `git init`, add remote `vm`, propose `--align` |
| exists, with `.git` | ensure remote `vm`, fetch, print ahead/behind/diverged/unrelated/same |

Unrelated histories after a traditional publish is the **normal** case (rule 2 above). `clone`
says so in one line and suggests `--align`; it does not run it.

Full loop:

1. Clone (command above).
2. Generate with collab-msg (writes on the Mac).
3. From `mls-<id>`: `pnpm publish:git` (lima) or `pnpm publish:remote` (VM).
4. Read `##gitBackend build=ok|error##` in the terminal; exit follows the build.

## Publishing to a REMOTE VM: the JWT door (gb50, 03/09/2026)

On lima the clone URL is `ssh://…` and that works because lima's sshd is local. **On a remote VM it
cannot**: port 22 stays closed, and SSM identifies the machine/IAM, not the person in the collab. So
a remote VM gets a second door — git's own smart HTTP, on the app's existing port, authenticated by
the same collab-auth JWT the app door already trusts.

```
git push https://<vm-domain>/git/mls-<id>.git
```

**A VM precisa de um vhost com `location /git/`, e ele NÃO vem de graça.** Uma VM que nunca rodou
publish por tarball não tem vhost nenhum; uma que rodou tem um `location /` que engole `/git/` sem os
ajustes que um push precisa. Três defaults do nginx matam o push, e o pior deles só aparece depois de
o clone ter funcionado:

| default | efeito |
|---|---|
| `client_max_body_size 1m` | o **primeiro push de verdade** dá **413** (medido na lima: 5 MB em `location /` ⇒ 413) |
| `proxy_request_buffering on` | o nginx acumula o packfile inteiro; adeus streaming e progresso |
| `proxy_read_timeout 60s` | o hook compila e corta a release **dentro** desta requisição |

```nginx
  location /git/ {
    proxy_pass http://127.0.0.1:<porta do projeto>;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 0;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
```

Provado na lima até a camada do nginx (roteamento e corpo grande). A composição completa
(nginx → rota → token real) depende de a plataforma nova estar publicada na VM e de um login de
verdade — gb53, paradas P-W2 e P-W1.

Once, per developer — the browser opens and closes by itself, nothing to copy:

```
pnpm publishGit login                    # → ~/.collab/publishGit.json (mode 600)
pnpm publishGit login --install-helper   # also teach plain `git clone` to use it
```

`login` starts a server on `127.0.0.1:<random port>`, opens the collab-auth login, and receives the
token pair back. It is the native-app flow (RFC 8252 §7.3): the redirect never leaves the machine.
The tokens arrive in the URL **fragment**, which no server ever sees — so the page served on the
loopback reads `location.hash` in JS and posts it back to the local server. A random `state` travels
in the returnTo query and is checked on the way back, so another page open in the browser cannot post
a token into the loopback while a login is waiting.

**"Login once" is literal: access 1 h, refresh 30 days, and the renewal happens inside `git push`.**
The credential helper checks the expiry before answering, refreshes when it is within 60 seconds of
running out, and saves the new access. Nobody watches a token expire. After 30 days, `login` again.

`--paste` still works, and is the way out if the browser cannot open (a headless machine) — but a
pasted access token has **no refresh**, so it dies in an hour and `login` says so.

**Automation (runs, CI) holds an API key, not a session:**

```
COLLAB_API_KEY=cak_… node scripts/publishGit.mjs <id> remote --git-url=https://<vm-domain>
```

The helper trades the key for a short JWT at `POST /auth/token/exchange` and caches it in
`~/.collab/publishGitService.json` until it expires — a cache is needed because every `git push`
starts a fresh helper process. **The key itself is never written to disk**; only the derived token and
the key's non-secret prefix. In the push log automation shows as `service:cak_ab12…`, never as a
person, and revoking the key in the admin kills it at once.

Then the publish is the same command with one flag:

```
node scripts/publishGit.mjs <id> remote --git-url=https://<vm-domain>
```

`--git-url` is the whole switch: with it the remote `vm` is https and the identity is the token; without
it nothing changes and ssh keeps working. A profile with `GIT_URL` needs **no** `SSH_HOST`.

What to know when it refuses:

| symptom | meaning |
|---|---|
| exit **3** with "Rode: pnpm publishGit login" | no session, the refresh was also refused (30 days passed, or it was revoked), or the VM refused the token. Never a build error — that is what the reserved exit code is for |
| `login` says "o collab-auth não devolveu refresh" | a pasted token, or a collab-auth that has not been deployed with the `loopback` entry in `COLLAB_AUTH_ALLOWED_RETURN_HOSTS`. It works, but only for an hour |
| `401` and git never asks for a password | the `WWW-Authenticate: Basic` header is missing; without it git does not call the credential helper at all |
| push accepted, `mls-<id>` unknown | 404: that project is not hosted on this VM (`/data/mls-base/mls-<id>/.git` does not exist) |

**Where the pieces are.** The door is `mls-102034/l1/server/layer_1_external/transport/http/gitHttp.ts`,
registered in `startServer.ts:224` before the catch-all `GET /*`. It does not implement the protocol:
it spawns **`git http-backend`**, git's own CGI, and owns only the three things a CGI cannot decide —
who is asking (the JWT), which repository they may touch, and what gets written down. The developer
side is `scripts/publishGitAuth.mjs` (session store, expiry, refresh, key exchange),
`scripts/publishGitLogin.mjs` (the loopback redirect login) and `scripts/publishGitCredential.mjs`
(the credential helper git calls — the one place that renews).

**Enforcement here is unconditional**, unlike `/execBff`. `BFF_JWT_ENABLED` (default false) exists so
that a bad token never locks real users out of a page that is already published. `/git/` serves no
page: it is a write door into the VM's source. A door that opens when the check is merely "off" is not
a door. `COLLAB_GIT_HTTP_ENABLED=false` removes the route entirely — that is the emergency stop.

**Who published what** is in `/data/mls-base/logs/git-push.jsonl`, one JSON object per request
(e-mail, project, endpoint, status) plus one line per push from the hook, carrying the commit and its
author. Attribution is git's own: `http-backend` derives `GIT_COMMITTER_*` from `REMOTE_USER`, which
the route sets to the verified e-mail. A commit signed with a different e-mail is **annotated, not
refused** — two git identities is the normal case for someone who works on two machines, and refusing
the push would trade auditing for a blockade.

## A brand-new VM → app online

What a fresh remote VM actually does today, in order. Read this before promising a VM is
"git ready" — steps 1-6 are automatic, step 7 is the hole.

1. The admin creates the server; `collab-sites` builds the cloud-init (`buildCloudInit`,
   `src/helpers/awsProvisioner.ts`).
2. Cloud-init installs `git`, mounts/formats the data volume, writes
   `/etc/collab/sites-agent.env`.
3. It clones the **collab-runtime** repo (`runtime.repoUrl` → `runtime.repoDir`).
4. It runs `install.sh --profile=… --server-id=… --project-id=… --sites-url=… --agent-token=…`.
5. `install.sh` runs the numbered steps: data disk, apt update, nginx, postgres, timescaledb,
   redis, node, 7zip, pm2, certbot, mls-base, collab-messages.
6. Step 10 (`scripts/10-mls-runtime.sh`) installs rsync+git, enables pnpm through corepack,
   clones `mls-base` from GitHub into `/data/mls-base`, then calls
   `scripts/lib/mls-app-db.sh` to write the production `.env` (`APP_ENV=production`,
   `RUNTIME_MODE=postgres`, `PORT=3000`) and create the `mdm` database.
7. Step 12 (`scripts/12-mls-project.sh`) runs
   `node /data/mls-base/scripts/runtime/projectInit.mjs <projectId> --root /data/mls-base`
   when the installer got `--project-id`. That is what makes the VM **clonable**: the client
   project is born from the template, `.collab-git` is written before `gitReposSetup`, and the
   repo gets `main` + `vm-baseline` + the push hook. No `--project-id` ⇒ the step is skipped,
   not failed.
8. **The slot** (gb52): the admin action — button *Add project* in the VM's hosted-projects panel,
   or `POST /api/v1/servers/<serverId>/hosted-projects {"projectId":"<id>"}` — runs
   `provisionProjectSlot` (collab-sites `layer_3_usecases/servers.ts`, builders in
   `projectSlot.ts`). It refuses if the project already
   lives on another VM, records it in `hostedProjects[]`, syncs Route 53, and over SSM runs the
   **same** `projectInit.mjs` as step 7 plus the project's **nginx vhost**. It returns the clone
   URL. This is what makes the domain answer at all — before gb52 the vhost only existed inside
   the tarball publish job, so an app could be live on port 2xxx and unreachable.
   Re-running it on a project that is **already** on this VM is the repair path (a vhost that got
   lost): `projectInit` is idempotent, and the inventory entry is kept, so `lastPublishAt` survives.
   `slotApplied: false` in the answer means the server has no instance yet — nothing was sent to
   the VM, only the inventory was written.
9. **The first release cannot arrive by push** — measured on the 102043 VM, 03/09. The `/git/`
   door is served by the **project's own app** (the vhost proxies `/git/` to port 2xxx), so with no
   app running, `/` and `/git/` both answer **502** and there is nothing to push to. The slot is
   complete and correct at this point; what is missing is a release. Break the loop from the
   admin: **Build release**, the button next to Delete on the project's row in the VM's
   hosted-projects panel (`POST /servers/<id>/hosted-projects/<projectId>/release`). It sends, over
   SSM, the same routine the hook would have run — no ssh:

   ```
   sudo -u <owner> -H bash -lc 'cd /data/mls-base && node scripts/runtime/gitPostReceive.mjs --root /data/mls-base --project <id>'
   ```

   It needs no push: it builds (`buildProjectsObj --only <id> --force`), cuts the release
   (`addNewVersion.mjs`), writes `pm2.apps.d/app<porta>.config.js` and reloads pm2. Once the app
   answers on its port, the door is up and every later release comes from `pnpm publish:remote`.
   The legacy alternative is the sites **publish job** (tarball + `pnpm build --client <id>`) —
   which is why gb51 item 4 gates turning it off.

Steps 7 and 8 do the same two things from two directions, on purpose: step 7 is the VM creating its
own project during bootstrap (it knows the id from `--project-id`), step 8 is someone deciding later
to put a project on an existing VM. Both call one script and write one vhost — a second scaffold or a
second vhost writer would drift on the first fix.

### The project template, and why it is not a scaffold project

`projectInit.mjs` copies `mls-base/scripts/templates/project/`, replacing `__PROJECT_ID__`.
It is a template inside `scripts/` — not a project to copy — because **the `mls-base`
repository tracks no `mls-*` at all**:

```
$ git ls-tree --name-only origin/main
.codegraph  .gitignore  codegraph.json  index.md  package.json
pnpm-workspace.yaml  scripts  servers  skills  test  tsconfig*.json
```

(measured 03/09/2026). So on a brand-new VM `/data/mls-base` arrives with the scripts and
**no platform projects either** — 102020/102021/102033/102034 come with the first
`publish:remote`. A template versioned with the scripts is the only thing guaranteed to be
there, which is what lets lima and a remote VM take the same path.

What the template must carry, each item paid for by a lost run:

| file | why |
|---|---|
| `l5/config.json` | `workspaceDependencies` is the ONLY input the host uses to resolve an agent. Missing ⇒ `Invalid agent agentNewSolution` on the first `send`. |
| `l5/project.json` with `masters` | `composeGeneratedConfig` (`scripts/build.mjs`) reads `l5.masters?.[side]`. Missing ⇒ the composer never runs and `mlsDep.json` is derived without the runtime projects — the family of 328 compile errors on the VM. |
| `mlsDep.json` | the manifest `resolveDeps` reads. Order does not matter (read as a set); the first agent run rewrites it from `l5/config.json.workspaceDependencies` ∪ `masters.*.runtimeProject`. |
| `.gitignore` | already the complete VM block, so `gitReposSetup` finds nothing missing and the baseline stays a single commit. |

`.github/` is deliberately absent: its workflow commits `obj/compiled.zip` back into the very
history `.collab-git` exists to protect.

### One rule, one place, two triggers

| what | where it lives | who calls it |
|---|---|---|
| create the project on the VM | `mls-base/scripts/runtime/projectInit.mjs` | `pnpm vm:init` over ssh (Mac) **and** collab-runtime step 12 (bootstrap) |
| app role, `mdm` database, runtime `.env` | `collab-runtime/scripts/lib/mls-app-db.sh` | collab-runtime step 10 **and** `mls-base/scripts/vmInitialSetup.sh` (the `--initial` ssh path) |
| project port | `mls-base/scripts/runtime/projectPorts.mjs` | the git hook (collab-sites still keeps its own copy — see gb15) |

`vmInitialSetup.sh` no longer writes the `.env` or creates the database itself; it finds a
collab-runtime checkout (`$COLLAB_RUNTIME_DIR`, `/data/collab-runtime`, `$HOME/collab-runtime`,
cloning as a last resort) and sources the library. An existing `.env` is **never** rewritten —
a VM's `.env` carries hand-added keys (`TESTS_ENABLED`, the test-login pair) that no generator
knows about.

## One VM, several projects

A VM installation is shared; what separates projects is the **alias**, not the folder:

```
releases/<ts>            the compiled release
current -> releases/<ts>          global — always the LAST push, whoever made it
current-<id> -> releases/<ts>     per project (COLLAB_RELEASE_ALIAS)
pm2.apps.d/app<port>.config.js    one file per project
pm2.config.js                     aggregator: reads pm2.apps.d/
```

The port is `2000 + the id's last three digits` (`scripts/runtime/projectPorts.mjs`; the
same rule lives in `collab-sites`). An app whose `cwd` is the global `current` serves
whichever project pushed last — always point an app at `current-<id>`.

## Where it stands (02/09/2026)

- Validated end to end on the local Lima VM: a push-created release runs and scores the same as the
  traditional publish.
- Wrappers `publish:git` / `publish:remote` and `clone` landed 02/09/2026 (102047 first).
- `servers/remote.conf.example` is the template; the real `remote.conf` is gitignored and filled
  per VM.
- **Production VMs are not ready**: `git` must be installed and `gitReposSetup` run there. Without
  that, `pnpm publish:remote` has no destination.
- The `--align` confirmation prompt is in Portuguese; product text should be English/i18n.
- Compiling on the developer machine is being retired in favour of compiling on the VM; until that
  lands, the GitHub Action keeps re-creating `obj/` and `publishGit` keeps removing it locally.

*Written 31/08/2026; supervisor cycle and `--autocommit` added 02/09/2026; remote wrappers, clone
and `remote.conf.example` added 02/09/2026; "brand-new VM" sequence and the multi-project alias
model added 03/09/2026; step 12, the project template and the single-owner table added 03/09/2026.*
