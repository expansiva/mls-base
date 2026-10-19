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

- Mac: lima. Windows: multipass (`PUBLISH_LOCAL_MULTIPASS_INSTANCE` in `mls-base/.env`;
  `vmInit.mjs` starts it with `multipass start`).
- `lima-ubuntu24` is only an **ssh alias**. On Windows a ssh config defines that alias pointing at
  the multipass VM, and `PUBLISH_LOCAL_SSH_CONFIG` names that file. Nothing calls `limactl` outside
  `vmInit.mjs`.

## Rules (each one was a real failure on Windows, 19/10/2026)

1. **A path inside a string that `sh` runs is quoted and uses `/`.** git runs `GIT_SSH_COMMAND`
   in `sh` on every platform, and `sh` eats the `\` of `C:\Users\…`. See `sshPathArg` in
   `scripts/publishGit.mjs` and `shPath` in `tools/lima/prepareSources.mjs`. A path passed as an
   argv element to `spawn` needs nothing.
2. **`spawn` without a shell only runs real executables on Windows.** `pnpm` is a `.cmd` there:
   run it with `shell: true` on win32 and quote the args yourself (`setup` in
   `tools/browser/browser.mjs`). Never spawn Unix commands such as `sleep`; do it in node
   (`sleepMs` in `scripts/vmInit.mjs`).
3. **A node script used as a binary goes through `spawnArgsFor`** (`tools/lima/session.mjs`): a
   `LIMA_SSH_BIN` / `LIMA_BROWSER_BIN` ending in `.js`/`.mjs`/`.cjs` runs under `process.execPath`.
4. **Test fakes are `.mjs`/`.cjs` node scripts, never `#!/bin/sh` wrappers** — Windows does not
   run a shebang file. A fake found through `PATH` also gets a `<name>.cmd` on win32
   (`writeNodeCommand` in `tools/browser/browser.test.mjs`).
5. **File URLs:** `fileURLToPath(url)`, never `url.pathname` (it gives `/C:/…`); to `import` an
   absolute path, `pathToFileURL(path).href`.
6. **Compare paths after `path.resolve`** when one side may mix `/` and `\`. Error messages may
   print either separator: match `[\\/]` in tests.
7. **Symlinks in tests:** on win32 use a `'junction'` with an absolute target (no admin needed).
8. **POSIX mode bits (0600/0700) and signals (`kill('SIGTERM'|'SIGINT')`) do not exist on
   Windows.** Keep the production `chmod`, but assert modes and signal handling only when
   `process.platform !== 'win32'`; on Windows assert what still protects (e.g. the lock was not
   released).

## Running the tests

On Windows `run-tests.mjs` does not run here; call each suite directly:

```
node --test scripts/publishGit.test.mjs scripts/vmInit.test.mjs tools/browser/browser.test.mjs tools/lima/*.test.mjs
```

All green on Windows on 19/10/2026 (one skip: the SIGINT test in `browser.test.mjs`).

*Written 19/10/2026.*
