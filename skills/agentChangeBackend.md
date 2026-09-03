# Skill: agentChangeBackend (CB) — generating `l1` from `l4`

What you must know before changing the CB (`mls-102021/l2/agentChangeBackend`). Read
[`certificacao.md`](certificacao.md) before reporting any change as done.

## What it is

Reads the module's `l4` (contracts, operations, entities written by the NS) and generates `l1`:
domain entities → repository ports → tables → adapters → **usecases** → http controllers →
materialization (`.defs.ts` → `.ts`) → seeds (`seeds.defs.ts` + typed `seeds.ts`) → validate-all.

**One module per run.** The target module is resolved once and persisted; every downstream step
scopes to the same module.

## The invariants that break things when ignored

**1. `l5/<module>/todoBackend.defs.ts` is the ONLY source of generation status** (`cbShared.ts:189`).
Inline `statusBackend` in `l4` is ignored, with a warning.

**2. Owner identity includes the module.** Two modules in one project may legitimately have
operations with the same id (`createSignature` in both). Indexing owners by `ownerType:ownerId`
alone lets the first file (alphabetical) mask the other module's status. Use `lookupTodoOwner` /
`indexTodoOwner` (`helpers/cbScope.ts`). An owner whose module is known must **never** fall back to
a module-blind lookup; only the flat v1 layout (module unknown) may.
*This shipped as a real failure on 31/08: 7 of 10 operations of a new module were silently treated
as `done` and never generated; the run died with `INTEGRITY FAILED` on the controllers that imported
them.*

**3. `done` means "defs generated", and it is flipped BEFORE materialization**
(`steps/gen-http/agentCbHttpController.ts:289`). Consequence any reader must know: after that flip,
every `readBackendScan(['toCreate','inProgress'])` downstream returns **zero** owners. A check that
asks "does this artefact belong to a current owner?" must scan `ALL_STATUSES`, or it will classify
everything the run just generated as an orphan.

**4. Status is never written for work that was not done.** Both the `recovered` path and the
read-back retry in `steps/finalize/agentCbFinalizeStatus.ts` require the artefacts to exist on disk
before writing `done`. Only the artefacts decide.

**5. `/rebuild all [module]` is scorched earth** (`agentChangeBackend.ts`): resets the owners
to `toCreate` and archives **every** l1 file of the module (`.ts` and `.defs.ts`, all layers,
`seeds.ts`, `registerRepositories.ts`, including leftovers with `status=deleted`), then regenerates.
The wipe is recorded as `rebuild-all wiped <n> file(s) of l1/<mod>` on the scan trace, health
report and run summary; wipe of 0 on a populated module is a finding. A wipe that counted
archives and still left live files **aborts the run** with that finding — it is not a `/run`.
`/rebuild defs` keeps defs and strips derived `.ts` at the end.

**5b. Generate the `.ts` if it is absent, or if this `/rebuild all` archived it** (02/09;
wipe-memory 02/09). `isStale(tsExists)` is `!tsExists` (`cbMaterializeCore.ts`). A present `.ts`
is skipped even if defs or a dependency is newer — **except** stor keys this run archived
(`wipedKeys` on `cb-repair-state.json`, scoped by `wipeRunId`). A host rescan can rewrite
`status=nochange` on the trash; the wiped set is the CB's own memory and does not consult the
index. `[cb-stale]` prints `exists`, `status`, and `wipedThisRun`. `rebuildWiped > 0` with 0
materialize calls fails the run (`rebuild-all wiped N file(s) and materialize generated none`).
To regenerate (repair, defs change), `forceRegenerate(defRef)` deletes the output `.ts` and
counts against `COMPONENT_REPAIR_BUDGET + 1`; the dispatcher's `CB_DISPATCH_HARD_CEILING = 10`
is the backstop.

**6. Nothing country- or domain-specific in the generator.** A guard that mentions a national
document, a currency or a local rule is a future bug: names change per country. Detect the *shape*
(a loop, an arithmetic routine), never the vocabulary.

Seeds also export `seedSpares`: leftover valid values per seeded bare-string field, produced by
the same validator search as the rows. Create-command tests consume them so they do not reuse a
unique seeded value. Small, deterministic, no `Math.random`.

## Fan-out

`gen-usecase` is a dispatcher + `parallel_dynamic` workers: **one worker per operation owner**
(`steps/gen-usecase/agentCbUsecase.ts`). Workflows generate no usecase — they are pure `l4`
orchestration realized by their member operations. If the number of workers is smaller than the
number of pending operations, the scan is the suspect, not the LLM.

`gen-domain` fans out per domain; `gen-port`/`gen-table`/`gen-adapter` are still whole-layer.

## Vocabulary the l4 can send

- `mdmRefs` — master-data entities, reached through `ctx.mdm`, never a local table.
- `derivedRefs` — projections (`kind: "projection"`, `ownership: "derived"`,
  `storage.target: "derived"`): read models with **no table**. Mirrors the `mdmRefs` channel.
  When the l4 declared `derivation`, that block travels on the ref so the usecase can implement
  the aggregation; absent on older l4, and the run must not fail.
- Absent ≠ empty: use `??`, not `||`/`length > 0`, when the distinction carries meaning.

## Where the run leaves evidence

| file | what |
|---|---|
| `l4/<module>/pipeline/trace/l1/NNN-agent-cb-*.json` | per-LLM-call dump (prompt, result) |
| `l4/<module>/pipeline/trace/l1/cb-health-report.json` | findings, `operationsMissing`, cost by phase, rounds |
| `l4/<module>/pipeline/runNN_changebackend.json` | run record, written when a run FAILS |

`costByPhase.<phase>.calls` is the cheapest way to see how many workers actually ran.

The trace lives under the layer (`trace/l1`) so a CF rebuild cannot delete it and vice-versa.
Stale trace resurrects behaviour: three separate defects on 30/08 came from plans left in an old
trace folder.

*Written 31/08/2026; 5b (staleness = existence) added 02/09/2026; leftover-wipe abort added 02/09/2026;
wipe-memory (`wipedThisRun`) added 02/09/2026.*
