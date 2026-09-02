# Skill: agentNewSolution (NS) — producing `l4` and `l5`

Cross-cutting notes for anyone touching the NS (`mls-102020/l2/agentNewSolution`) or consuming what
it writes. The agent's own contract lives in `mls-102020/l2/agentNewSolution/README.md` and
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
who declares the projection declares the account. Absent on L4 written before that field.

**6. A persona is not an actor.** Demographics and personas describe who uses the product; only an
actor with distinct permissions belongs in the access matrix.

## Running it

`pipeline.json` records each step's status (`approved`, plus `autoReason` when `/fast` skipped a
confirmation) and is the fastest way to see where a run stopped. `/rebuild` wipes the module before
regenerating — confirm the neighbouring module was untouched.

*Written 31/08/2026.*
