# Skill: agentNewSolution (NS) — producing `l4` and `l5`

Cross-cutting notes for anyone touching the NS (`mls-102035/l2/agentNewSolution`) or consuming what
it writes. The agent's own contract lives in `mls-102035/l2/agentNewSolution/README.md` and
`docs/flow.json` (steps, gates, `canonicalReferences`); this file carries what the downstream agents
depend on.

## What it writes

`l4/<module>/` — the permanent product contracts:

| path | content |
|---|---|
| `module.defs.ts`, `siteMap.defs.ts`, `workspace-model.defs.ts` | the module itself |
| `operations/`, `workflows/` | the owners; **operations** get a usecase downstream, workflows do not |
| `contracts/<workspace>--<bff>.defs.ts` | the BFF contracts |
| `usecases/`, `access/`, `workspaces/` | realization plan, access matrix, screens |
| `pipeline/` | `e1…e10` drafts and reports, `pipeline.json`, `runNN_newsolution.json` |

`l5/<module>/` — the delivery contracts: `todoBackend.defs.ts`, `todoFrontend.defs.ts`,
`process.defs.ts`.

## Contracts the downstream depends on

**1. `todoBackend` owners are born `toCreate`** — every operation, written at e10
(`steps/e10/contracts.ts:215`). It is the only source of backend generation status
(see [`agentChangeBackend.md`](agentChangeBackend.md)). The same holds for `todoFrontend`.

**2. Owner ids are unique inside a module, not inside a project.** Two modules of the same project
routinely declare `createSignature`. Any consumer that indexes owners must key by module.

**3. File names never contain a dot** beyond the `.defs.ts` suffix: contracts are
`<workspace>--<bff>.defs.ts`, drafts are `-draft` / `-approved`. A dot in the short name breaks
storage lookups.

**4. `l4` is agnostic of the frontend.** It describes the product — screens, categories, contracts —
never a genome, a template or a component. The CF decides presentation.

**5. On-demand entities are projections**: `kind: "projection"`, `ownership: "derived"`,
`storage.target: "derived"`. No table is created for them; the CB reaches them through its
`derivedRefs` channel. New E4 runs also declare `derivation` (`from`, `filter`, `aggregate`) —
who declares the projection declares the account. Absent on L4 written before that field. A core
`moduleDatabase` entity that journeys read and never write is recorded as `NS4_E4_CORE_READ_ONLY`
(warning + systemDecision `keepCore` / `projection` / `masterData`) and does not block the run.

**6. A persona is not an actor.** Demographics and personas describe who uses the product; only an
actor with distinct permissions belongs in the access matrix. **A confirmation is not a decision.**
Confirming a form, validating captured data or applying a system rule is an `act` with `useRules`;
a `decide` step exists only when the request names a human choice between alternative outcomes.
The record-owner handle is `party: person` + E3 `dataScope.mode: own`, never a field name.

**7. `mutability: appendOnly` ⇒ no update/delete.** E4 may declare `mutability: 'editable' |
'appendOnly'` on an entity; E8 then emits no catalogue `update`/`delete`/`inactivate`/`reactivate`
and the `recordForm` keeps only create. Absent = editable. L4 written before the field keeps
compiling — nothing is migrated.

**8. Structure only where a machine reads it; intent stays prose, whole.** (Wagner, 08/09/2026 — after two
lived failures: rules once had ~200 fields and never closed, and became `id + description`; page definitions
were cut down to three fixed labels and screens lost their voice.) A structured field exists only when a
downstream step reads it **without an LLM** (id, reference, `kind`, closed enum, hash, status) or a
deterministic gate needs it. Everything that is intent — what, for whom, why, how it should feel — travels
as prose, **uncut**, to the LLM that decides: `journey.goal`, `outcome.statement` + `evidence`,
`steps[].description`, `sections[].intent`, `landingIntent`, `rules[].description`. Never summarize prose into
labels; never add a field to a human-facing artifact (journey `business`, rule, grant, entity) to steer a
model — steer with prose and check with a gate. When several downstream readers need the same fact, the
owning step's LLM extracts it from prose **once** and writes a reference (a projection, `affects[]`,
`mdmSubtype`), then the rest is deterministic. External grants with `fieldsOnly` / `summaryOnly` /
`aggregateOnly` are that extraction in E4B: a `<Entity><Profile>View` projection linked by
`projectionRef`, not a new field on the human grant. Guardrail text grows only per dated incident and prefers
becoming a gate (compiler, lint, ratchet). Structure wins on DATA; prose wins on BEHAVIOR and VISUAL.
Design record: `todo/gerarApp/design/familias/T_estrutura_vs_prosa.md` (not committed; the rule is this line).

## Running it

`pipeline.json` records each step's status (`approved`, plus `autoReason` when `/fast` skipped a
confirmation) and is the fastest way to see where a run stopped. `presentation.phrases` on
`module.defs.ts` and `pipeline.json` is the planner's translation of the English catalogue
(`helpers/ns4Text.ts`, including E1–E6 widget chrome `widget.<name>.*`); a missing key falls back to
English. Clarification widgets receive that object at mount (`bindNs4ClarificationWidget`). A derivation-binding repair is a
`task.json` step titled `Bind ontology derivations` (with ` · R1` on the bounded retry). `/fast` writes into `skippedDefaults`
only the product languages the original prompt cites (never the planner's proposed list); a discard
lands on `i18nWarnings` and on the run's `languages-provenance` degradation. `/rebuild` wipes the
module before regenerating — confirm the neighbouring module was untouched.

`/fast` still chains to agentChangeBackend on E10 success. `/fast /nochain` keeps the skip-and-run
path and suppresses only that handoff; the run summary records
`handoff: suppressed by /nochain — next: @@agentChangeBackend /rebuild all <module>` as a fact, not
a degradation. The flag is on the invocation, never inferred from CLI vs browser.

*Written 31/08/2026; `/nochain` added 06/09/2026; `mutability` added 06/09/2026; `/fast` language provenance 06/09/2026; confirmation vs decision 06/09/2026; E4 derivation-binding repair 06/09/2026; E4 CORE_READ_ONLY registrar 07/09/2026; owner handle by party+own 07/09/2026; `presentation.phrases` 07/09/2026; widget chrome from the same catalogue 07/09/2026.*
