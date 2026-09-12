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
| `mls-102020` | l2 | `aura/molecules/agentSyncMoleculeCatalog/helpers/syMigrateIndexTs.test.ts` (L88, L107, L149) + `aura/molecules/shared/localDocRefs.test.ts` (2 `todo/` paths in `agentNewMoleculeVariant/steps/v4-index/CHANGELOG.md:36` and `molecules/skills/canonicalFallbacks.ts:16`, since 04/09) — **4 failures**. `agentGenerateHeader.test.ts` no longer fails (re-measured 06/09/2026) |
| `mls-102035` | l2 | green with NS5 (`agentNewSolution5`, including `replayRealRuns.test.ts` on the two complete runs). **78 files, 0 red**, measured 11/09/2026 (ns5_20; was 77 after ns5_13) |

`tsc` baseline (11/09/2026, re-measured ns5_20): frontend — **1**, `mls-102051/l5/runtimeConfig.ts`
(generated app; the page31 TS2367 left with `controleEstoque4` on ns5_15);
backend — **1**, only `mls-102051` (generated app); `controleChamados` (NS4, `mls-102047/l1`) was
retired 11/09/2026 (ns5_15: bancada `mls-102047` limpa para a análise do NS5). Zero in
`mls-102020`/`mls-102021`. The old `l2/aura/agentManageHeader` (4 errors) is gone.

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

NS5 live-run cost (complete `/fast /rebuild all` on `mls-102047`, 11/09/2026, from
`l4/<mod>/pipeline/run01_newsolution5.json`):

| module | total USD | by step (LLM) |
|---|---|---|
| `comandaRestaurante5` | 0.8386 | module10 0.0462, journeys20 0.0616, ontology30 0.4386, rules40 0.1776, access60 0.1146 (`workflows50` / `integration70` empty, no call) |
| `ordenServicio5` | 1.4994 | module10 0.045, journeys20 0.2509, ontology30 0.6616, rules40 0.1717, workflows50 0.1353, access60 0.2349 (`integration70` empty, no call) |

*Written 31/08/2026; typeCheck status (gb74) added 04/09/2026; baselines re-measured 06/09/2026;
frontend baseline gained the page31 TS2367 (07/09/2026, leaves on regenerate); 102035 l2 + NS5
run costs added 11/09/2026 (ns5_10); 102035 l2 77 files ns5_13 (11/09/2026); 102035 l2 78 files
ns5_20 (11/09/2026).*
