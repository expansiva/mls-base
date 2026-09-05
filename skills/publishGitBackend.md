# Skill: Git-push publish (gitBackend) — how an app reaches the VM

Complements [`runtimeEnvironment.md`](runtimeEnvironment.md), which describes the VM runtime
(build, release, pm2, nginx). This file is the **only** publish path: git push to a repo on
the VM, where a `post-receive` hook compiles and cuts the release. The tarball path was
deleted 04/09/2026 (gb73). Platform files (`scripts/`, root config) arrive by `git pull` of
`mls-base` from GitHub, not in the push.

`--app-env` has no equivalent here **by decision** (Wagner, 04/09): the VM's `.env`
(`APP_ENV`) is what the runtime reads. Do not stamp `appEnv` onto `l5/project.json` on
the way in.

## The idea

Every `mls-<id>` folder on the VM is a normal (non-bare) git repo. You push; a `post-receive` hook
compiles and cuts a release.

| piece | file |
|---|---|
| setup on the VM (idempotent) | `mls-base/scripts/runtime/gitReposSetup.mjs --root /data/mls-base` |
| platform checkout (lima copy → git) | `mls-base/scripts/runtime/ensureMlsBaseCheckout.mjs` |
| hook | `mls-base/scripts/runtime/gitPostReceive.sh` → `gitPostReceive.mjs` |
| client side | `mls-base/scripts/publishGit.mjs <projectId> local\|remote [--align] [--autocommit]` |
| clone from VM | `mls-base/scripts/publishGit.mjs <projectId> clone local\|remote` |

Each repo gets `main` + an immutable `vm-baseline` snapshot and
`receive.denyCurrentBranch=updateInstead`, so a push against a dirty worktree is refused instead of
silently overwriting. The hook only swaps the release when the compile passes, and prints
`##gitBackend build=ok|error##`; `publishGit`'s exit code follows the BUILD.

## One rule that is not obvious

**The local `obj/` is disposable, and `publishGit` deletes it.** Before pushing, it removes
`obj/` from disk and from git, ensures the ignore and commits (`chore: remove obj/`). The build that
matters is produced on the VM by the hook (and on GitHub by the Action). Keeping `obj/` versioned
makes the hook's rewrite dirty the VM worktree, and `updateInstead` then refuses every later push.

`--align` remains for the first push onto a repo whose history is unrelated (a folder that
existed before it was git-managed, or a clone that never shared a commit with the VM).
Confirmation is human by design — `clone` never answers it and never force-pushes. A project
born with `vm:init` carries `.collab-git` inside `vm-baseline`, so later pushes are
fast-forward and do not ask.

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

## Client wrappers (02/09/2026; new-project path 04/09/2026)

From inside `mls-<id>`:

| script | what it is |
|---|---|
| `pnpm publish` / `pnpm publish:remote` | `publishGit.mjs <id> remote --git-url=https://<id>.collabcodes.com`. Canonical path. Domain is the `<id>.collabcodes.com` convention, not an l5 field. |
| `pnpm publish:git` | `node ../scripts/publishGit.mjs <id> local` — git push to lima. |

New projects are born with this `package.json` from `mls-102039` (literal `102039`, rewritten
when `projectInit --from-model` clones and renumbers). Older clients (102044–102051) were
retargeted to the same three scripts (gb73). Creating / mounting a VM slot is
collab-sites *Add project* / `pnpm vm:init`, not a publish. The static tree
`scripts/templates/project/` was deleted (gb70, 04/09/2026) — it was a second source of
truth and shipped without `shellTemplates`.

Gate, markers (`##gitBackend build=ok|error##`) and exit code are the same on both git wrappers.

When the app is already on the VM and only a dependency changed, `publishGit` writes an empty
commit on the **project** (`publish: rebuild after deps <ids>`) and pushes `main` with
`-o deps=<ids>`. The release is of the published project, one only. A dep snapshot never
triggers the build (`skip-build`): dep repos have no hook. A publish that does not cut a
release does not finish quietly — the missing-hook message names `gitReposSetup`.

### When the closure grows — a new dep is not yet on the VM (gb77, 04/09/2026)

`publishGit` pushes a snapshot onto a repo **that already exists**. It cannot create one: the
remote profile talks to the VM only through `/git/` HTTPS (`git-http-backend`), which cannot
run a command, and creating a repo on first push would let any push invent a project.

So a dep that just joined the client's `mlsDep.json` (the measured case: 100554/100555) takes
**two publishes**. That is the design, not a workaround:

1. **1st publish** — the snapshot fetch fails with "does not appear to be a git repository"
   (ssh) or HTTP 404 (`/git/`). That is a **warning**, not an error: it names the dep, says
   the VM will create it during the build, and asks for a second publish. The other deps still
   snapshot; the **client push still happens** — that is what fires the hook.
2. **On the VM**, `resolveDeps` clones whatever is missing (`git clone --depth 1`), **keeps
   `origin`**, creates `vm-baseline` from HEAD, then arms with the same `setupRepo`
   `gitReposSetup` already uses (`receive.advertisePushOptions`, `updateInstead`). Creating
   `vm-baseline` first is what lets a repo **with** `origin` through the guard
   (`skipped-external-remote` is `remotes && !vm-baseline` **fora** de `/data/mls-base`).
3. **2nd publish** — the repo exists, the snapshot lands, the hook compiles the Mac disk.

Why not one publish (resend the snapshot after the hook returns, in the same Mac process)?
The first build compiles the **GitHub clone**, not the Mac worktree. Sending the snapshot
afterwards still needs a second client push to compile it. Two builds pretending to be one
is worse than two honest publishes. No third transport.

A clone made **by hand** with `origin` and **no** `vm-baseline` is still refused
(`skipped-external-remote`) **outside** `/data/mls-base` — that is a developer's checkout,
and that is why the guard exists. Inside `VM_ROOT`, the same shape is a leftover of
`resolveDeps` from before gb77: `setupRepo` sends it through `armClonedDep` (creates
`vm-baseline`, keeps `origin`). The sequence that arms a **new** platform dep is still
clone → `vm-baseline` → `setupRepo`, origin stays.

### Two ways a lib on the VM is updated (gb77 rodada 2, 04/09/2026)

The copy on the VM is **materialized**, not a history to preserve. Both sources **replace**;
neither merges (`pull` is forbidden here):

| path | when | mechanism |
|---|---|---|
| **normal (every customer VM)** | the lib moved on GitHub | `git fetch origin && git reset --hard origin/<default>` |
| **override (the VM under test)** | the developer changed it on the Mac and wants to try before pushing GitHub | `publishGit` snapshot, `updateInstead`, as today |

`origin` stays so the normal path exists. `receive.*` stays so the snapshot still lands.
A customer VM that never sees a snapshot just tracks GitHub.

The automatic path is **not every build**. A build that fetched GitHub would wipe the
snapshot the developer just pushed to test — the case that exists. Automatic means no
per-VM hand work, not "always".

The mechanism is `resetFromOrigin` / `resetArmedDepsFromOrigin` in
`scripts/runtime/gitReposSetup.mjs`. On the VM:

```
node scripts/runtime/gitReposSetup.mjs --root /data/mls-base --reset-from-origin
node scripts/runtime/gitReposSetup.mjs --root /data/mls-base --reset-from-origin 100554 100555
```

It only touches an `mls-*` that has **both** `origin` and `vm-baseline`. A developer
checkout (origin, no baseline) is skipped — same door as the guard **off** the VM.
On the VM, `gitReposSetup` arms that leftover first, and then this command can see it.
A snapshot-only folder (no origin) is skipped.

**Who fires it is gb62** (collab-sites button / schedule, N VMs). This file only names
the command. Do not wire it into the git hook or `resolveDeps`. Manutenção da plataforma na
VM de teste tem CLI (`node scripts/vm.mjs <projectId> platform-update|deps-update|hold|status`)
e não exige admin — o mesmo token do `publishGit`.

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
with the exact command instead of improvising a parallel install) → `projectInit --from-model`
clones `mls-102039` **on the VM**, drops the model's `.git` / `obj/` / `.github`, renumbers the
id → writes `.collab-git` → runs `gitReposSetup` → clones on the Mac with remote `vm`.

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

Unrelated histories (a folder that never shared a commit with the VM) get one line and a
suggestion of `--align`; `clone` does not run it.

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

### Platform install is not pinned (Wagner, 04/09/2026)

The `pnpm-lock.yaml` of mls-base stays gitignored. Wagner (04/09) refused committing it: a lockfile
that freezes installs would get in the way of the Mac → local test → remote path. The one place that
turns frozen off everywhere (Mac, lima, AWS, CI) is `.npmrc` at the mls-base root, and it contains
only this:

```
frozen-lockfile=false
```

pnpm turns `--frozen-lockfile` on by itself when `CI=true`. The `.npmrc` is what stops that, so
commands stay `pnpm install` with no flag. `addNewVersion.mjs` and the collab-sites first-release
install both rely on it. Do not put `--no-frozen-lockfile` (or `--frozen-lockfile`) on those
commands.

**Consequence, accepted on purpose:** the platform on a VM is **not byte-for-byte reproducible**.
Two VMs created weeks apart can receive different transitive versions (`esbuild: ^0.27.2`,
`typescript: ^5.5.3`). A build that passes today can fail tomorrow with no code change. **This is a
conscious decision by Wagner (04/09), not an oversight** — do not "fix" it by committing the
lockfile or adding `--frozen-lockfile`.

In order:

1. The admin creates the server; `collab-sites` builds the cloud-init (`buildCloudInit`,
   `src/helpers/awsProvisioner.ts`).
2. Cloud-init installs `git`, mounts/formats the data volume, writes
   `/etc/collab/sites-agent.env`.
3. It clones the **collab-runtime** repo (`runtime.repoUrl` → `runtime.repoDir`).
4. It runs `install.sh --profile=… --server-id=… --project-id=… --sites-url=… --agent-token=…`.
5. `install.sh` runs the numbered steps: data disk, apt update, nginx, postgres, timescaledb,
   redis, node, 7zip, pm2, certbot, mls-base, collab-messages.
6. Step 10 (`scripts/10-mls-runtime.sh`) installs rsync+git, enables pnpm through corepack,
   clones `mls-base` from GitHub into `/data/mls-base`, runs `pnpm install` there (no
   lockfile flag — `.npmrc` has `frozen-lockfile=false`, gb55) as the deploy user, then
   calls `scripts/lib/mls-app-db.sh` to write the production `.env` (`APP_ENV=production`,
   `RUNTIME_MODE=postgres`, `PORT=3000`) and create the `mdm` database.
   **Ready means cloned AND installed** (gb54, 04/09). A failed install is a warning, not a
   stop: the message says no build will work on this VM until it passes. The admin's *Build
   release* still installs when `node_modules` is missing (collab-sites
   `buildProjectReleaseCommand`) — second line of defence, not a substitute for this step.
   Measured hole 03/09 on the 102043 VM: clone without install died at
   `Cannot find package 'esbuild'`.
   **`gitReposSetup` used to skip every project on a VM** (fixed 03/09): its `isRepo` asked
   `git rev-parse --git-dir`, which walks UP the tree — inside the mls-base checkout that answers
   for any subfolder, returning the parent's `.git`, so the project looked like a foreign repo
   (`skipped-external-remote`) and never got one of its own. Consequence: no `main`, no
   `vm-baseline`, and **nothing to push to**. Lima never showed it because there mls-base arrived
   as a copy, not a clone. `projectInit` now also re-runs `gitReposSetup` on a project that already
   exists, so a VM created before the fix heals with *Update platform*.
   **Lima was a copy; it is a checkout now.** `ensureMlsBaseCheckout.mjs` (gb73) is the
   versioned, idempotent conversion: `git init` → `remote add origin $MLS_BASE_REPO` →
   `fetch` → `checkout -f -B main origin/main`. Same variables as this step
   (`MLS_BASE_DIR`, `MLS_BASE_REPO`). Ignored VM state stays; a folder that is already a
   checkout is left alone. Proven on lima 04/09 (HEAD matched origin/main). The script
   does not ssh — run it on the VM.

7. Step 12 (`scripts/12-mls-project.sh`) runs
   `node /data/mls-base/scripts/runtime/projectInit.mjs <projectId> --root /data/mls-base --from-model`
   when the installer got `--project-id`. That is what makes the VM **clonable**: the client
   project is cloned from `mls-102039` and renumbered, `.collab-git` is written before `gitReposSetup`, and the
   repo gets `main` + `vm-baseline` + the push hook. No `--project-id` ⇒ the step is skipped,
   not failed. No network to GitHub ⇒ the step fails; there is no offline fallback.
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
   There is no tarball fallback: the python publisher was deleted (gb73). The first release
   is this button, then git.
   The scaffold's `l5/config.json` (from the cloned model) must declare four things or the release dies
   in a way that names the wrong culprit: `defaultProjectId`, itself as `projects.<id>.type =
   "client"`, a `publication` target, and — the one that costs a whole cycle — the **masters**
   (102033/102034) in `projects`, with 102034 carrying its `modules` and `persistenceModules`.
   Without the masters the build "finishes" and emits no platform; without 102034's
   `persistenceModules` the table registry is empty (`registry:4f53cda1…`, the sha256 of `[]`) and
   `migrate` fails with `relation "_schema_migrations" does not exist`. All four measured 03/09.

   **Slot and release are independent halves, and the domain needs both**: the slot writes the vhost
   (and gets the certificate), the release makes something listen on the port. Measured 03/09 on a
   fresh VM: release done and no slot ⇒ the domain still answers the nginx default page and `/git/`
   is a 404 from nginx — the app was running and simply not exposed. The order does not matter;
   skipping either one does.

Steps 7 and 8 do the same two things from two directions, on purpose: step 7 is the VM creating its
own project during bootstrap (it knows the id from `--project-id`), step 8 is someone deciding later
to put a project on an existing VM. Both call one script and write one vhost — a second scaffold or a
second vhost writer would drift on the first fix.

### The project model (`mls-102039`)

`projectInit.mjs --from-model` clones `https://github.com/expansiva/mls-102039.git` (`--depth 1`),
removes the model's `.git` (the client does not inherit that history), strips `.github/` and
`obj/` if they travelled, and rewrites every `102039` / `_102039_` to the new id. The URL is a
constant in `mls-base`; `--model-url` exists only for tests. No network ⇒ fail; there is no
offline copy (Q1, 03/09/2026). The static tree `scripts/templates/project/` was deleted
(gb70, 04/09/2026) because it was a second source of truth that nobody validated — it shipped
without `shellTemplates` and left 102043 in 502 with pm2 green.

`mls-base` still tracks no `mls-*` (measured 03/09/2026), so a brand-new VM arrives with the
scripts and **no platform projects** — 102020/102021/102033/102034 come with the first
`publish:remote`. The model lives on GitHub, not inside `scripts/`, which is what lets lima and
a remote VM take the same path.

What the model must carry, each item paid for by a lost run:

| file | why |
|---|---|
| `l5/config.json` | `workspaceDependencies` is the ONLY input the host uses to resolve an agent. Missing ⇒ `Invalid agent agentNewSolution` on the first `send`. `shellTemplates.spa` is required to listen (missing ⇒ 502, pm2 green). |
| `l5/project.json` with `masters` | `composeGeneratedConfig` (`scripts/build.mjs`) reads `l5.masters?.[side]`. Missing ⇒ the composer never runs and `mlsDep.json` is derived without the runtime projects — the family of 328 compile errors on the VM. |
| `mlsDep.json` | the manifest `resolveDeps` reads. Order does not matter (read as a set); the first agent run rewrites it from `l5/config.json.workspaceDependencies` ∪ `masters.*.runtimeProject`. |
| `package.json` | canonical publish (`publish` / `publish:remote` with `--git-url=https://<id>.collabcodes.com`). Missing ⇒ a new project has no command to publish (gb69, 04/09). |
| `.gitignore` | `gitReposSetup` completes the VM block if the model is missing patterns (102039 today is only `.DS_Store`; the extra commit is the existing setup behaviour). |

`.github/` is stripped on clone: its workflow commits `obj/compiled.zip` back into the very
history `.collab-git` exists to protect. The model itself is never hosted on a VM (Q9).

### One rule, one place, two triggers

| what | where it lives | who calls it |
|---|---|---|
| create the project on the VM | `mls-base/scripts/runtime/projectInit.mjs` | `pnpm vm:init` over ssh (Mac) **and** collab-runtime step 12 (bootstrap) |
| app role, `mdm` database, runtime `.env` | `collab-runtime/scripts/lib/mls-app-db.sh` | collab-runtime step 10 **and** `mls-base/scripts/vmInitialSetup.sh` (the `--initial` ssh path) |
| project port | `mls-base/scripts/runtime/projectPorts.mjs` | the git hook (collab-sites still keeps its own copy — see gb15) |
| lima copy → platform checkout | `mls-base/scripts/runtime/ensureMlsBaseCheckout.mjs` | Wagner on the VM (once; idempotent). Same `MLS_BASE_DIR` / `MLS_BASE_REPO` as step 10 |

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

`current-*` and `pm2.apps.d` are in the mls-base `.gitignore` (gb73), so they never
show up as `??` on a platform checkout. Each release stamps `platformCommit` in
`releases/<id>/release.json` (`releaseStamp.mjs`) — HEAD of that checkout, or
`unknown` when `/data/mls-base` is not a checkout. Same pin + same platform commit ⇒ same
release on both VMs.

The port is `2000 + the id's last three digits` (`scripts/runtime/projectPorts.mjs`; the
same rule lives in `collab-sites`). An app whose `cwd` is the global `current` serves
whichever project pushed last — always point an app at `current-<id>`.

## Where it stands (04/09/2026)

- The tarball/python publisher is gone (gb73). `publish` / `publish:git` / `publish:remote` all
  call `publishGit.mjs`.
- Validated end to end on lima and the remote 102043 VM: a push-created release runs.
- `servers/remote.conf.example` is the template; the real `remote.conf` is gitignored and filled
  per VM.
- The `--align` confirmation prompt is in Portuguese; product text should be English/i18n.
- Compiling on the developer machine is being retired in favour of compiling on the VM; until that
  lands, the GitHub Action keeps re-creating `obj/` and `publishGit` keeps removing it locally.

*Written 31/08/2026; supervisor cycle and `--autocommit` added 02/09/2026; remote wrappers, clone
and `remote.conf.example` added 02/09/2026; "brand-new VM" sequence and the multi-project alias
model added 03/09/2026; step 12, the project template and the single-owner table added 03/09/2026;
new-project `package.json` and dep-only rebuild-on-the-project (gb69) added 04/09/2026;
static template deleted, `projectInit --from-model` clones mls-102039 (gb70) added 04/09/2026;
lima platform checkout + `platformCommit` on the release stamp (gb73) added 04/09/2026;
tarball/python publisher deleted, `publishGit` is the only path (gb73 rodada 3) added 04/09/2026;
new dep in the closure: two-publish cycle, VM clone keeps origin and is armed via vm-baseline
(gb77) added 04/09/2026; fetch+reset of armed deps, trigger is gb62 (gb77 rodada 2) added 04/09/2026;
platform install unpinned via `.npmrc` `frozen-lockfile=false` (Wagner 04/09) added 04/09/2026;
pre-gb77 clone on the VM (origin, no vm-baseline) is armed by setupRepo at VM_ROOT (gb64 rodada 2)
added 04/09/2026;
step 10 runs `pnpm install` after clone/pull so a fresh VM is buildable (gb54) added 04/09/2026.*
