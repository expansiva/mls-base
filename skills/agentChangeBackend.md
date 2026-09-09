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

`gen-domain` fans out per domain; `gen-adapter` fans out per aggregate/event (`cb-adapter-fanout`; `cb-gen-usecase` joins on the fan-out, never the dispatcher). `gen-port`/`gen-table` are still whole-layer.

## MDM: create-or-attach, no name inference (n05, 2026-09-08)

The l4 is the only source of MDM meaning. The CB transcribes `mdmSubtype`, `role`, `displayField`,
`storage.idField` and `relationships[]` from ontology v7 (`cbDefsSource.readOntologyEntity`). It
does **not** infer subtype from an English substring, country from language, or a foreign key from
an `Id` suffix. v6 modules keep the suffix fallback until they are regenerated.

`mdmWrites` on a usecase item is `{ mdmType: role, subtype, idField, baseFields, namespaceFields }`.
A create of a Person/Company role is **create-or-attach**: `ctx.mdm.entity.create` (the engine
dedups by document and returns `alreadyExists`), then `update` to add the role tag and write
`details[ctx.moduleId]`. `countryCode` is `ctx.organization?.countryCode` when n06 exposes it;
until then the level-1 identification default is `'US'` (`origin: level1-subtype-default`).

`findByDocument` / `findByContact` / `attachRole` are not on the facade yet (n06).

## Vocabulary the l4 can send

- `mdmRefs` — master-data entities, reached through `ctx.mdm`, never a local table.
- `derivedRefs` — projections (`kind: "projection"`, `ownership: "derived"`,
  `storage.target: "derived"`): read models with **no table**. Mirrors the `mdmRefs` channel.
  When the l4 declared `derivation`, that block travels on the ref so the usecase can implement
  the aggregation; absent on older l4, and the run must not fail.
  `aggregate[].signBy {field, negativeValues}` em `sum`: linhas com `field ∈ negativeValues`
  entram negativas; ausente = todas positivas.
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

`/fast` after a successful run dispatches agentChangeFrontend. `/fast /nochain` completes the
backend run and records `handoff: suppressed by /nochain — next: @@agentChangeFrontend /rebuild all <module>`
instead of dispatching. The flag is on the invocation, never inferred from CLI vs browser.

## Authority and person-scope (n09, 2026-09-09)

The l4 V4 matrix (`operationAuthorityRefs`) and `access/access-bindings.defs.ts` are the only source
of who may run an operation and which rows they see. The CB transcribes; it does not infer a filter
from a field suffix or from grant prose.

- **Scan.** `cbAccess.readAccessMatrixV4` + `readAccessBindings`. A V4 module whose operation has no
  `authorityRefs` is `CB_SCAN_AUTHORITY_REQUIRED` (blocking, never a permissive fallback). Pre-n07
  l4 without V4 is unchanged until regeneration. `custom` scope is recorded on the run
  (`custom scope (prose): <operationId>`).
- **Usecase.** For `own` / `assigned` / `related`, gen-http emits
  `layer_2_application/scope/sessionScope.ts` from the declared anchor (join by the hop `fieldId`s
  until `Person.platformUserId = ctx.sessionContext.actorId`, last hop via `ctx.mdm`). The LLM
  receives `scopeFilter.alreadyApplied` and must not re-derive. `organization` / `public`: no
  person filter. `custom`: `// scope: custom (prose) — <description>` for the model.
- **Controller.** Besides `actorScope ∩ actors`, each handler carries `authorityRefs` and, when the
  covering grant is `public`, `public: true`. Claims `<moduleId>:<actorId>` map through
  `layer_1_external/auth/profileAuthorities.ts`. Empty session scope stays permissive (platform
  pending). Anonymous session acceptance is not a CB change.

## N writes, one transaction (n10, 2026-09-09)

When the l4 operation `writes` lists N entities, gen-usecase emits **one**
`ctx.data.runInTransaction` that covers every local table in that list and every `mdmWrites`
entry. Never one transaction per entity. Catalogue operations that still write a single
`entityRef` are unchanged.

## Time status is computed on read (n13, 2026-09-09)

When the l4 entity declares `reachedBy: time` states, gen-usecase puts `timeStates` on get/list/
projection owners. The usecase evaluates the named rule (`ruleRef` → `description`) on every
read and does not persist the status by default. List/panel never trust a stored field for a
time state. Dated comment on the assignment: `// time status computed on read (2026-09-09)`.

*Written 31/08/2026; 5b (staleness = existence) added 02/09/2026; leftover-wipe abort added 02/09/2026;
wipe-memory (`wipedThisRun`) added 02/09/2026; `/nochain` added 06/09/2026; gen-adapter fan-out added 06/09/2026;
`derivedRefs.derivation.aggregate[].signBy` added 06/09/2026; authority/anchor (n09) added 09/09/2026;
N-write transaction (n10) added 09/09/2026; time-on-read (n13) added 09/09/2026.*
