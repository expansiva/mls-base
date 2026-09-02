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
| client side | `mls-base/scripts/publishGit.mjs <projectId> local\|remote [--align]` |

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

**Accepted cost:** after a traditional publish the VM's history is new, so the next `publishGit`
asks for `--align` (diff + confirmation) once. Visible and explainable, which is the point.

## Where it stands (31/08/2026)

- Validated end to end on the local Lima VM: a push-created release runs and scores the same as the
  traditional publish.
- **Production VMs are not ready**: `git` must be installed and `gitReposSetup` run there.
- `publishGit … remote` still lacks `servers/remote.conf`.
- The `--align` confirmation prompt is in Portuguese; product text should be English/i18n.
- Compiling on the developer machine is being retired in favour of compiling on the VM; until that
  lands, the GitHub Action keeps re-creating `obj/` and `publishGit` keeps removing it locally.

*Written 31/08/2026.*
