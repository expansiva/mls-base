# __PROJECT_ID__ · new project (born on the VM)

This folder was created by `scripts/runtime/projectInit.mjs` from
`scripts/templates/project/`, with `__PROJECT_ID__` replaced by the real id.

## Why a template inside `scripts/`, and not a scaffold project

On a brand-new VM the platform arrives as `git clone` of `mls-base` — and that repository
tracks **no** `mls-*` project (measured 03/09/2026: only `scripts/`, `skills/`, `servers/`,
the tsconfigs, `package.json`, `pnpm-workspace.yaml`, `test/`, `index.md`, `.codegraph`). So
there is no scaffold project to copy from there. A template versioned **with the scripts**
exists on every VM, which is what makes lima and a remote VM take the same path.

## What is here and why

| file | why it must exist at birth |
|---|---|
| `l5/config.json` | `workspaceDependencies` is the ONLY thing the host reads to resolve an agent. Without it every agent is "invalid" and generation dies on the first `send`. |
| `l5/project.json` | the `masters` block is what makes the config composer run at all (`scripts/build.mjs`, `composeGeneratedConfig` reads `l5.masters?.[side]`). Without it `l5/config.json` is never composed and `mlsDep.json` is derived without the runtime projects — the family of 328 compile errors on the VM. |
| `mlsDep.json` | the dependency manifest the VM build reads. Order is irrelevant to the reader (it is used as a set) and the first agent run rewrites it from the canonical derivation: `l5/config.json.workspaceDependencies` ∪ `masters.*.runtimeProject`. |
| `.gitignore` | already carries the whole VM block, so `gitReposSetup` finds it complete and adds no follow-up commit to the baseline. |
| `l2/project.*`, `l2/designSystem.*` | the minimum a project needs to compile and to have a local design system. |

## What is deliberately NOT here

- `.github/` — a VM-first project does not live on GitHub, and the workflow it used to carry
  commits `obj/compiled.zip` back into the very history the `.collab-git` marker exists to protect.
- `obj/` — build output, rebuilt on the VM.
- `.collab-git` — written by `projectInit.mjs` **before** `gitReposSetup`, so it lands inside the
  `vm-baseline` commit.

Replace this README once the project has content.
