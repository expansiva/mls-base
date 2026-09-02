# Skill: Runtime Environment (production VM)

How a published client app actually runs in production, so a new session can reason about the
runtime without re-deriving it. This is a **reference index** — it points to the real source
instead of copying it. Read the referenced file when you need detail.

## What it is

After a publish (e.g. project 102051), the client app runs on Node.js inside a VM — **local**
(Lima on macOS, Multipass on Windows) for development, or **remote** (EC2, managed by
collab-sites) for real production. The runtime is NOT the Studio: it is a self-contained
`mls-base` tree on the VM that builds, releases and serves the app with pm2 + nginx.

## Projects involved

- **mls-102033** — master frontend: shell/boot common to all client apps.
- **mls-102034** — master backend: HTTP server, BFF pipeline (`execBff`), persistence registry,
  monitor. Every pm2 app runs `_102034_/l1/server/.../startServer.js`.
- **mls-<client>** (e.g. mls-102051) — the generated client app (l1 backend, l2 frontend,
  l3 assets, l5 admin/config). The publish is triggered FROM this project.
- **collab-sites** (repo root; UI surfaced at admin.collab.codes, API at sites.collab.codes) —
  manages the production VMs and finishes the remote publish.
- **collab-messages** — task/step engine backend. Planned to also run in production (see Gaps).

## Publish flow

> There is a **second** path since 30/08/2026: push to a git repo on the VM, where a `post-receive`
> hook compiles and cuts the release. See [`publishGitBackend.md`](publishGitBackend.md) — it also
> explains how a traditional publish destroys those repos and re-arms them.

Entry point: `mls-<client>/package.json` scripts — `publish` (remote, `--sites`) and
`publish:local`. Both call `mls-base/scripts/runPublishMlsBase.mjs`, a thin launcher for
`mls-base/scripts/publish/publishMlsBase.py`, which composes the client `config.json`, packs the
project SOURCES into a tarball and ships them — the **build always happens on the VM**.

- **Local path**: tarball over ssh (Lima) or multipass transfer. Target comes from
  `mls-base/.env` (gitignored): `PUBLISH_LOCAL_SSH_HOST`, `PUBLISH_LOCAL_SSH_CONFIG`,
  `PUBLISH_LOCAL_REMOTE_BASE` (optional `PUBLISH_LOCAL_CERT` / `PUBLISH_LOCAL_MULTIPASS_INSTANCE`).
  Ad-hoc profiles still use `mls-base/servers/<profile>.conf`.
- **Remote path (`--sites`)**: CLI flags on the `publish` script in `package.json`
  (`--ssh-host`, `--remote-base`, `--server-project-id`). Creates a publish job on collab-sites
  (upload → human authorization via link → running → done). collab-sites executes the publish
  on the VM through AWS SSM:
  download artifact, extract, write the per-app pm2 config, run the build, configure nginx.
  See `collab-sites/src/layer_3_usecases/publish.ts`.

## On-VM build and release (`pnpm build`)

`mls-base/scripts/runtime/addNewVersion.mjs` IS the build pipeline: update tsconfig paths from the
mls-* projects on disk, pnpm install, per-project migrate, compile, assemble a release under
`releases/<yyyyMMddHHmmss>` (runtime output only; node_modules symlinked), run the **master
backend migrate** (schemaBootstrap creates the Postgres tables from the client TableDefinitions
and applies seed rows — the server does NOT create schema at startup), then atomically activate
via the `current` symlink (or `current-<projectId>` alias on multi-app servers), prune to the 10
newest releases and reload pm2 with no downtime. Rollback = repoint the symlink + reload.

## pm2 topology and ports

pm2 can host **several apps, one per hosted project, each with its own port**:

- Port convention: `2000 + last 3 digits of projectId` (`projectIdToPort` in
  `collab-sites/src/layer_3_usecases/sites.ts`). Example: 102051 → 2051.
- Sites publishes write `pm2.apps.d/app<port>.config.js` (name `app<port>`, cwd
  `current-<projectId>`, cluster with 2 instances, `PORT` and `COLLAB_PROJECT_ID` in env) and a
  root `pm2.config.js` that aggregates everything in `pm2.apps.d/`.
- nginx gets one site per project (`<projectId>.collabcodes.com`) proxying to the app port.
- The local dev VM uses the simpler `mls-base/servers/pm2.config.js`: a single app named `app`
  on port 3000, cwd `/data/mls-base/current`.
- Because of cluster mode (2 instances), any per-process in-memory state (caches, run history)
  is NOT shared between instances — consecutive requests may hit different processes.

## Server environment

`startServer.js` serves the frontend and the BFF from the active release. Environment comes from
the `.env` kept at the mls-base root on the VM and copied into every release
(`_102034_/l1/server/layer_1_external/config/env.ts`). Key vars: `APP_ENV`
(development|staging|production), `RUNTIME_MODE` (postgres|memory — memory is the development
default, refused outside development; its intended production use is as a disposable sandbox for
tests), `TESTS_ENABLED` (default `APP_ENV=development`; enables Run on `/monitor/tests` — set to `true` in
the local Lima VM's `.env`, left off on remote VMs until the runtime has login), `PORT`,
`PG*` credentials.

Persistence layout: client-project tables are physically namespaced with the project number
(`mls<projectId>_` prefix, resolved in the 102034 registry), so several projects share one
Postgres without name collisions. Since 31/08/2026 the generated `tableName` also carries the
lowercased module id (`mls102047_listaassinatura3_petition_signature`); regenerating a module that
already exists therefore creates empty tables under the new name — a migration step before a real
customer (the old unprefixed table is left behind). Lookup (`getTable('petition_signature')`,
`seedFor`) still uses the unprefixed logical name. The **mdm tables are common to all projects** — treat them as
shared state; project-scoped work must never assume exclusive ownership of mdm data. The Lima VM runs
`APP_ENV=production` + `RUNTIME_MODE=postgres`, i.e. the local VM is a true production rehearsal.

Operations UI: `/monitor` (overview, process health, postgres/dynamo inspection, abends, traces,
releases with deploy/rollback and pm2 logs, config, generated BFF tests). Served by 102034
(`l2/monitor/module.ts` routes → `l1/monitor` handlers).

## The cbe module (studio-on-VM) and login

The VM is also a mini-studio. mls-102034 exposes cbe-compatible endpoints
(`l1/server/layer_1_external/cbe/`): `POST /exec` (login / authSession / authLogout),
`GET /libs/*` (mls lib, disk cache + `on.collab.codes` origin) and the service worker. The
shell templates load `mls-102033/l2/cbe/cbeMiniCfe.ts`, which boots the mls lib and performs
the cbe login; the cfe then fills the browser's IndexedDB with each project's compiled sources,
delivered incrementally from `mls-<id>/obj/compiled.zip` at the VM base. The login serves ALL
`mls-*` projects present at the base (config.json set plus studio projects).

Authentication mirrors the central cbe: collab-auth issues RS256 JWTs
(`auth.collab.codes/auth/login/<provider>?returnTo=<origin>/?collabauth=1` → tokens in the URL
fragment → cfe posts `authSession`), the VM validates offline via JWKS and keeps
`cauth`/`crefresh` httpOnly cookies + the JS-readable `loginUser` (UI gate). Client helpers live
in `mls-102033/l2/cbe/cbeAuth.ts` (`window.collabRuntimeAuth.login()/logout()/user()`).
`AUTH_JWT_ENABLED=false` disables the JWT path; `CBE_TEST_LOGIN_USER` is the localhost test user.
NOTE: the VM origin must be an allowed returnTo on collab-auth.

## Project compilation ON the VM (replaces GitHub Actions)

The per-repo GitHub Actions (mls-ci) used to produce each project's `obj/*.zip`; the VM now
builds its own: `scripts/runtime/buildProjectsObj.mjs` (run by addNewVersion after pm2 reload;
`pnpm build:objs` manually; `CBE_BUILD_OBJS=false` skips) iterates every `mls-*` at the base,
rebuilds stale projects through the local `scripts/buildCI` pipeline in offline mode (shipped
`types/`, sha1 versionRefs when there is no `.git`) and copies the zips into `mls-<id>/obj/`.
Incremental by source mtime; a project that fails to build keeps its previous obj. The publish
syncs ALL `mls-*` projects to ssh/multipass targets by default (`PUBLISH_ALL_PROJECTS` /
`--all-projects` to override; sites publishes default to the config.json set only).

## Known gaps (as of 2026-08-06)

- **collab-messages in production**: will run as an additional pm2 app named `msg` on the
  production VM. Not wired yet (today collab-messages runs only in the Studio environment).
- **Monitor admin gating**: the cbe login now identifies the user (JWT), but monitor admin
  actions (releases activate, logs) are not yet gated by it ("ADMIN ONLY once auth exists").
- **collab-auth returnTo allowlist** must include the VM domains (`*.collabcodes.com`) for the
  login redirect to come back (collab-auth service config, outside this repo).
- **Test execution in production**: solved by the memory sandbox — when `TESTS_ENABLED` is on and
  `RUNTIME_MODE=postgres`, each `/monitor/tests` run builds its own in-memory runtime (tables and
  mdm seeded from the definitions), so nothing reaches Postgres and sandbox runs are kept out of
  the monitor execution log/telemetry. Enabled on the local VM only until the runtime has login.
  Remaining wart: the run history ring is per pm2 process, so `recentRuns` depends on which of the
  2 instances answers — a shared store would be needed if run history has to survive the process
  that served it.

## Pointers

- Publish scripts: `mls-base/scripts/runPublishMlsBase.mjs`, `mls-base/scripts/publish/publishMlsBase.py`
- Build/release on VM: `mls-base/scripts/runtime/addNewVersion.mjs`
- Server env & runtime mode: `mls-base/mls-102034/l1/server/layer_1_external/config/env.ts`
- Schema + seeds: `mls-base/mls-102034/l1/server/layer_1_external/persistence/` (registry,
  schemaBootstrap), client seeds in `mls-<client>/l1/<module>/layer_1_external/adapters/persistence/`
- VM management & remote publish: `collab-sites/src/layer_3_usecases/` (servers, publish, releases, sites)
- Local VM profile: `mls-base/servers/dev.conf` (+ `dev.conf.example`), pm2: `mls-base/servers/pm2.config.js`
