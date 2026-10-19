# Skill: Mac and Windows — the dev-machine scripts run on both

The scripts that run on the developer's machine must work on **macOS (lima VM)** and on
**Windows (multipass/Hyper-V VM)** (decided 19/10/2026). Before changing any of them, read this
page; after changing, run its tests on the platform you are on, and do not break the other one.

Scope (dev-machine side only; code that runs on the VM is Linux-only):

- `scripts/publishGit.mjs`, `scripts/vmInit.mjs`
- `tools/lima/*.mjs` (except `sessionVm.mjs` and `prepareBench.mjs`, which run on the VM)
- `tools/browser/browser.mjs`
- their `*.test.mjs`

## The VM

- Mac: lima. Windows: multipass (`PUBLISH_LOCAL_MULTIPASS_INSTANCE` in `mls-base/.env`).
- `lima-ubuntu24` is only an **ssh alias**. On Windows a ssh config defines that alias pointing at
  the multipass VM, and `PUBLISH_LOCAL_SSH_CONFIG` names that file.

## Running the tests

On Windows `run-tests.mjs` does not run; call each suite directly:

```
node --test scripts/publishGit.test.mjs scripts/vmInit.test.mjs tools/browser/browser.test.mjs tools/lima/*.test.mjs
```

*Written 19/10/2026.*
