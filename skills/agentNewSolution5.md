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
| journeys | `journeys/<journeyId>.defs.ts` + `journeys/index.defs.ts` | `2026-09-10-ns5-journey-v1` (`act.effect`) |
| ontology | `ontology/<Entity>.defs.ts` + `ontology/index.defs.ts` | `2026-09-11-ns5-ontology-v2` (`writer`, `uniqueKeys`, typed `details`) |
| rules | `rules.defs.ts` | `2026-09-10-ns5-rules-v1` |
| workflows | `workflows.defs.ts` | `2026-09-12-ns5-workflows-v2` |
| access | `access.defs.ts` | `2026-09-12-ns5-access-v3` |
| integration | `integration.defs.ts` | `2026-09-12-ns5-integration-v2` |
| integration request | `l4/<target>/tobe/integration/<mod>--<eventId>.defs.ts` | `2026-09-12-ns5-integration-request-v1` |

Pipeline: `pipeline/pipeline.json`, per-step `pipeline/<step>-draft.json`,
`pipeline/finalize-report.json`, `pipeline/runNN_newsolution5.json`.
`steps.<step>.normalizations[]` (and ontology30 `liftedFields` /
`liftedAggregateEntities` / `writerDerived`) is what the system adjusted — Fase 2 reads it.

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

## Form (final, Fase 1)

Flow (`docs/flow.json`): `module10 → journeys20 → ontology30 → {rules40, workflows50, access60}
→ integration70 → finalize80`. `finalize80` is deterministic. Oracle errors fail the run;
warnings do not.

**Languages.** `pt` → `pt-BR` (BCP-47 with region). `en` stays `en`. Recorded as `ptToPtBR`.

**`act.effect`.** Required: `'create' | 'update' | 'transition'`. `transitionRef` only with
`transition`. Lifecycle is required when there is a `transition` act or a `decide` on the
entity (`collectNs5LifecycleSignal`); `create`/`update` do not count.

**`writer`.** `'journey' | 'crud' | 'inbound'` (omitted = journey). Normalize drops conflicting
crud/inbound when an act already writes the entity. A child of a written parent (`parent`) and an
MDM attached by a create act (`attach`) also count (`ns5ResolveEntityWriter`; `writerDerived`).

**Ontology v2.** `unique` / `uniqueKeys` (I9: every fieldId exists); `details` are typed
`{ type, description }`; relationship `description`; `enum[{value,title}]`; intrinsic
`constraints` (never a business policy).

**Workflows.** Process `trigger` (`manual` / `scheduled` / `event`) and stage
`human` / `mechanical` / `llm` / `wait`.

**Integration v2.** `inbound[{ writes, effect, transitionRef? }]` is a writer; `outbound.on` is
`Entity.transitionId` or `Entity.create`; registry stores `entities` / `events`. A sibling that
does not publish queues `integration-request-v1` under `l4/<target>/tobe/integration/` (I11).

**`module.details`.** Organization-wide aggregates. After fan-out, an aggregate-only entity
(no writer and no fields besides `idField`) is lifted into this map and not written as `.defs.ts`.
The panel is the source of overlapping keys; plan-only keys stay. Extra panel fields become
`liftedFields`.

**Recorded adjustments.** Every mechanical change lands on `pipeline.json` `steps.<step>`:
`normalizations[]` (`ptToPtBR`, `dropCrud`, `dropTransitionRef`, `replacePlanModuleDetails`,
`writerDerived`, …), `liftedFields`, `liftedAggregateEntities`. The Fase 2 screen reads these;
they are not a finding.

### Oracle I1–I13

| check | meaning | on fail |
|---|---|---|
| I1 | every id ref between sources exists. A journey `entity`/`affects` naming a lifted id is a `module.details` ref when that map has keys | error |
| I2 | `effect: 'transition'` cites a declared `transitionRef` (`by` includes the actor, `from` reachable from source-SCC births). `create` is not an I2 error; `update` with a declared actor transition is a warning. Every `decide` has two transitions from the same origin. Same citation on workflow `mechanical`/`llm` stages | error (warning does not fail) |
| I3 | every `access.actors` row has at least one journey and one grant | error |
| I4 | every cited `transitions[].ruleRefs` exists in `rules.defs.ts` | error |
| I5 | every mdm entity has `mdmSubtype`; every non-mdm entity on an `own` grant reaches a `party: person` | error |
| I6 | a `handoff` without a covering human `journeyRef`; a `by: system`/`time` transition that is not a mechanical/llm `effect: transition` or `trigger.event` | warning |
| I7 | `journeys/*.defs.ts` and `ontology/*.defs.ts` on disk equal the index plus `index.defs.ts` | error |
| I8 | a login person is registered by an internal `act` (entity/`affects`), `writer: 'crud'` with an internal grant, an `act` of her own external actor, or derived `parent`/`attach` | error |
| I9 | every `uniqueKeys` fieldId exists on the entity | error |
| I10 | written entity is an `act` `entity` or `affects`, or `writer: 'crud'` / `'inbound'`, or derived `parent`/`attach`; crud has an internal-actor grant; inbound appears in `inbound.writes` | error |
| I11 | inbound event from a sibling that does not publish it; queues `l4/<target>/tobe/integration/` | warning |
| I12 | `outbound.on` is `Entity.transitionId` or `Entity.create`; `plugins.usedBy` exists; `from: organization` events are in the platform catalog | error |
| I13 | remaining `custom` grants (count in `checks.I13.warningCount`) | warning |

I7: files in `journeys/` and `ontology/` must equal the index plus `index.defs.ts`
(`NS5_FINALIZE_I7_ORPHAN_FILE`). access60 writes actors + grants; the grant is the
authority. Unrestricted `fieldsOnly` becomes `fullRecord`; `anchorEntity` only on
`own`/`assigned`/`related`. ontology30 rejects persisted `id → id` realizations.

## How to certify

1. Both tsconfigs — see [`certificacao.md`](certificacao.md).
2. `node scripts/run-tests.mjs 102035 l2` against the baseline in that file (the NS5 suite,
   including `replayRealRuns.test.ts`).
3. `ns5CreateAgentGraph.test.ts`, prompt `modelType` markers, i18n guard, no `todo/` paths.
4. Fixtures in `steps/*/fixtures/` are byte copies of the two seed runs
   (`comandaRestaurante5`, `ordenServicio5`) plus the 11 complete modules of the final
   leva. `financeiro` has no pack: leva 1+2 failed on content (`journeys20` collapsed
   to 1 journey). Gate tests run on those drafts. The replay `normalize → gate → writeDefs`
   must match the recorded defs (hashes stripped).
5. `nsArtifactFieldRatchet.test.ts`: every structured key of the source contracts has a
   declared non-LLM reader.

Live proof (`@@newSolution5 … /fast /module <name>` on `mls-102047`) is owned by the
supervisor, not the executing session.

*Written 11/09/2026 (ns5_10); form closed 12/09/2026 (ns5_33 T6, leva final 11/12).*
