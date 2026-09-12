# Skill: agentNewSolution5 (NS5) — producing the six l4 sources

Cross-cutting notes for anyone touching the NS5 (`mls-102035/l2/agentNewSolution5`) or consuming
what it writes. The agent's own contract lives in `mls-102035/l2/agentNewSolution5/README.md` and
`docs/flow.json`. This file carries what downstream agents and humans depend on.

The MDM level-1 catalog (subtypes and `platform.defs.ts`) is emitted by `mls-102034` and
read from `/_102034_/l4/organization/ontology/*`. NS5 does not copy or re-parse it.

NS5 writes **l4 sources only**. It never emits derived copies (operations, workspaces, usecases,
contracts, landings, site maps) and **never** dispatches `agentChangeBackend` or
`agentChangeFrontend`. There is no `/nochain` flag: handoff does not exist.

## What it writes

`l4/<module>/` — the permanent product sources:

| source | file(s) | `schemaVersion` |
|---|---|---|
| module (envelope) | `module.defs.ts` | `2026-09-10-ns5-module-v2` |
| journeys | `journeys/<journeyId>.defs.ts` + `journeys/index.defs.ts` | `2026-09-10-ns5-journey-v1` |
| ontology | `ontology/<Entity>.defs.ts` + `ontology/index.defs.ts` | `2026-09-11-ns5-ontology-v2` |
| rules | `rules.defs.ts` | `2026-09-10-ns5-rules-v1` |
| workflows | `workflows.defs.ts` | `2026-09-10-ns5-workflows-v1` |
| access | `access.defs.ts` | `2026-09-10-ns5-access-v2` |
| integration | `integration.defs.ts` | `2026-09-10-ns5-integration-v1` |

Pipeline: `pipeline/pipeline.json`, per-step `pipeline/<step>-draft.json`,
`pipeline/finalize-report.json`, `pipeline/runNN_newsolution5.json`.

Types live in `/_102035_/l2/solution/types.ts`. Shared pure helpers are re-exported from
`/_102035_/l2/solution/lib.ts` without moving the NS4 files.

The six **human** sources are journeys, ontology, rules, workflows, access and integration.
`module.defs.ts` is the envelope (name, languages, prompt, details). Actors live on `access.defs.ts`.

## Ownership rule

An artifact only carries what is its own and references the rest **by id**. Forbidden on these
sources: `sourceRefs`, `realization` (except ontology relationship endpoints), `resolution`,
`contexts`, `operationIds`, `workspace*`, `landing*`, copies of `useRules` from another artifact,
story prose. Header `/// <mls fileReference="_<proj>_/l4/<mod>/…" enhancement="_blank"/>` and
`as const satisfies Ns5<Tipo>` imported from `/_102035_/l2/solution/types.js`.

## What does **not** exist

No screens, no operations, no BFF contracts, no usecases, no landings, no site map, no
workspace-model, no `todoBackend` / `todoFrontend`. Regenerating a module regenerates from the
six sources. A later master frontend decides screens; a later master backend grows endpoints
by request. The journey is the acceptance oracle of both sides and generates neither.

## Invocation

```
@@newSolution5 <prompt> /module <lowerCamel>
@@newSolution5 <prompt> /fast /module <lowerCamel>
@@newSolution5 <prompt> /fast
@@newSolution5 /rebuild all <module>
```

- `/module` fixes the folder name. Without it, `module10` proposes a lowerCamel name.
- `/fast` skips reserved clarification anchors (they have no screen) and auto-approves each
  implemented step.
- `/rebuild all` calls `solution/removeModule`: unlinks exact `l4/l1/l2/l5/<module>/**`,
  strips the module from `l5/config.json`, `l5/project.json` (nested `routeKeys` too) and
  the organization registry, then recreates the pipeline. Neighbouring modules stay.
- An existing module without `/rebuild all` is refused.
- Never dispatches CB/CF.

Flow (`docs/flow.json`): `module10 → journeys20 → ontology30 → {rules40, workflows50, access60}
→ integration70 → finalize80`. `finalize80` is deterministic (oracle I1–I9, organization
registry, l5 `config.json` / `project.json`, `pipeline.status: complete`). Oracle errors fail
the run; warnings do not. I7: files in `journeys/` and `ontology/` must equal the index plus
`index.defs.ts` (`NS5_FINALIZE_I7_ORPHAN_FILE`). I2: an `act` on an already-provided entity
with lifecycle needs a transition from a reachable origin state
(`NS5_FINALIZE_I2_ACT_WITHOUT_TRANSITION`); a locate→inspect journey is valid and I2
does not apply to it. I4: a cited `transitions[].ruleRefs` exists in `rules.defs.ts`.
Rules are `{ruleId, description}`. Ontology fields may declare `unique` / `uniqueKeys`
and intrinsic `constraints`; `details` are `{ type, description }`; each relationship
has a `description`; enum values are `{ value, title }` (the phrases catalogue does
not label domain enums). Organization-wide aggregates live in `module.details`
(ontology30). After the entity fan-out, ontology30 lifts a core/supporting entity that
only stores aggregates into `module.details` and does not write its `.defs.ts`
(`liftNs5AggregateOnlyEntities`; gate `NS5_ONTOLOGY_AGGREGATE_ONLY_ENTITY` stays as the
net). The lifted ids are stored on `pipeline.json` `ontology30.liftedAggregateEntities`;
finalize80 I1 accepts a journey `entity`/`affects` that names one of them when
`module.details` still has keys. I9: `uniqueKeys` fieldIds exist on the entity.
`/rebuild all` calls `removeModule` (exact
`l4/l1/l2/l5/<module>/**` plus l5 jsons and the registry; `localStor.deleteFile`
on the host); `journeys20` / `ontology30` drop defs that left the index.
access60 normalizes unrestricted `fieldsOnly` to `fullRecord` and drops `anchorEntity` outside
`own`/`assigned`/`related`. ontology30 rejects persisted `id → id` realizations.

## How to certify

1. Both tsconfigs — see [`certificacao.md`](certificacao.md).
2. `node scripts/run-tests.mjs 102035 l2` against the baseline in that file (the NS5 suite,
   including `replayRealRuns.test.ts`).
3. `ns5CreateAgentGraph.test.ts`, prompt `modelType` markers, i18n guard, no `todo/` paths.
4. Fixtures in `steps/*/fixtures/` are byte copies of the two complete runs
   (`comandaRestaurante5`, `ordenServicio5`). Gate tests run on those drafts. The replay
   `normalize → gate → writeDefs` must match the recorded defs (hashes stripped).
5. `nsArtifactFieldRatchet.test.ts`: every structured key of the source contracts has a
   declared non-LLM reader.
6. Neighbour: `controleChamados` file counts stay 160 / 53 / 44 (l4 / l1 / l2). NS4
   (`agentNewSolution`) stays on disk and untouched.

Live proof (`@@newSolution5 … /fast /module <name>` on `mls-102047`) is owned by the
supervisor, not the executing session.

*Written 11/09/2026 (ns5_10); I7 / host unlink ns5_11; form normalizations ns5_12;
rules/module.details/read-only journey/MDM skill ns5_13; aggregate-only lift ns5_13 T7;
I1 lifted-entity ref ns5_13 T8; MDM ontology emitted by 102034 ns5_14;
`/rebuild all` via `removeModule` ns5_20;
ontology unique/uniqueKeys, typed details, relationship description, enum titles,
intrinsic constraints, I9 ns5_19.*
