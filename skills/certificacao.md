# Skill: Certification — proving an agent change is safe

What to run, and how to read it, before saying an agent change is done. Applies to `mls-102020`
(NS/CF), `mls-102021` (CB) and anything else under `mls-base`.

## 1. BOTH tsconfigs, always

```bash
npx tsc -p tsconfig.frontend.json --noEmit
npx tsc -p tsconfig.backend.json --noEmit
```

- `tsconfig.frontend.json` covers `**/l2/**` + `**/l5/*.ts` — and **excludes `**/*.test.ts`**
  (`tsconfig.frontend.json:15-19`). A green frontend run says nothing about the test files.
- `tsconfig.backend.json` covers `**/l1/**` + `nodejs*`. The CB's own product is `l1`: certifying a
  CB change with the frontend config only is blind to what it just generated.

Errors inside a generated client app (`mls-base/mls-1020xx/l1|l2/...`) are **not** agent errors.
Attribute them before reporting: a broken generated app is usually the evidence of the run you are
fixing, and disappears when it is regenerated.

## 2. The test runner exits 0 even when tests fail

```bash
node scripts/run-tests.mjs <projectId> l2     # e.g. 102021
node scripts/run-tests.mjs --all l2
```

**Never trust the exit code.** Compare the list of RED FILES against the known baseline.

Baseline reds, measured 31/08/2026:

| project | layer | baseline |
|---|---|---|
| `mls-102021` | l2 | green |
| `mls-102020` | l2 | `aura/agentManageHeader/agentGenerateHeader.test.ts` + `aura/molecules/agentSyncMoleculeCatalog/helpers/syMigrateIndexTs.test.ts` (L88, L107, L149) |

A red file outside that list is a regression. Re-measure the baseline if it drifts, and update this
table with the date.

## 3. Prove the neighbour is intact

A change scoped to module/area X must show that Y still works. Preferred, in order:

1. **Real data** — count the artefacts on both sides and show the invariant holds (e.g. "module A
   has 18 l4 operations and 18 todo owners; module B, 10 and 10 — no divergence either side").
2. A test that encodes the rule.
3. Last resort: a live run.

A passing unit test written alongside the change is the weakest of the three: it tends to test what
the change does, not what it might have broken.

## 4. Rule tests beat value tests

Write the invariant, not the sample: *"no path may hardcode `attempt: 1"*, *"no category may return
fewer than 3 genomes"*, *"no agent may read or write the status of an owner in another module"*.
A test asserting a function that must never come back (`assert.doesNotMatch(source, /function
currentCreateRunModule/)`) is a legitimate rule test.

## 5. typeCheck status (`l5/project.json`)

The same release used to get two type verdicts: `build.mjs` emitted with `--noCheck` while the git hook gated on `buildCI`'s type errors, and a cache-hot `obj/` skipped the check entirely (measured 04/09 on mls-102025, `TS2345` `"LoadMonaco"`).

`l5/project.json` now declares the verdict. Both paths (`build.mjs` dist and `buildProjectsObj` / gitPostReceive gate) read it through `scripts/typeCheckPolicy.mjs`:

```json
"typeCheck": { "status": "permissive", "reason": "<why, one line>" }
```

| status | effect |
|---|---|
| `permissive` (default if the field is **absent**) | type errors are reported per layer (`l1` = `tsconfig.backend.json`, `l2` = `tsconfig.frontend.json`) and do **not** block the gate or the release |
| `strict` | type errors block **both** paths |

Syntax errors (TS1xxx), broken imports (`TS2307`) and emit/tsc crashes **always** block. The status governs type errors only. Compile stays tolerant (decision #19, `compile.mjs`).

`COLLAB_FAIL_ON_TSC_ERRORS` is a local override and must log `typeCheck: overridden by COLLAB_FAIL_ON_TSC_ERRORS (declared: …)`. It is not the source of the decision.

Do not add a follow-up task to tighten this. Tightening is a decision, not a schedule.

*Written 31/08/2026; typeCheck status (gb74) added 04/09/2026.*
