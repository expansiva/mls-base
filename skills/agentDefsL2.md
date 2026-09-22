# agentDefsL2 — generate typed frontend definitions

Developer documentation for `mls-102020/l2/agentDefsL2/`, verified on 22/09/2026.
This is not a prompt skill and changing it has no runtime effect.

## Responsibility and boundary

`agentDefsL2` reads the canonical L4 plus the approved web planning pool and writes the declarative
L2 layer. It does not materialize `.ts` UI files, change L1, repair L4 meaning, publish, or mark an
application complete. Invoke it as `@@agentDefsL2 <module>`.

The flow is deterministic at its boundaries:

`entry10 → input20 → contracts30 → shared40 → pages50 → finalize60`

| step | output | LLM |
|---|---|---|
| `input20` | immutable source snapshot, hashes, page selection and destinations | no |
| `contracts30` | one typed `web/contracts/<page>.defs.ts` per selected page | no |
| `shared40` | one `web/shared/<page>.defs.ts` per selected page | per page, at most one repair |
| `pages50` | paired desktop/mobile `page11/<page>.defs.ts` | per page, at most one repair |
| `finalize60` | integrity reconciliation, ownership receipt and final report | no |

The graph, step contracts and barriers are under `agentDefsL2/createAgentGraph.ts` and
`agentDefsL2/steps/`. Do not infer completion from child status: every barrier validates the
persisted artifact.

## Inputs and ownership

`input20/io.ts` is the canonical loader. It reads module, indexed journeys/entities, rules,
workflows, access, integration, menu, needs, backend and effort, then records a digest for every
source. Its gate validates versions, identity, cross-references and exact effort totals.

Journey detail artifacts deliberately do not carry `moduleName`; their identity is the indexed
`journeyId` plus canonical module path. Ontology entity details do carry `moduleName`. Do not add a
journey identity field that is absent from `Ns5JourneyArtifact` merely to satisfy a fixture.

The agent owns only its manifest and defs recorded by its receipt. Removal requires the prior
owned inventory and unchanged hashes. It never treats an unowned path as removable.

## Output inventory

For each selected page there are four defs:

- `web/contracts/<pageId>.defs.ts` — TypeScript types and exact backend routes; no materialization item.
- `web/shared/<pageId>.defs.ts` — shared behavior definition; one future materialization item.
- `web/desktop/page11/<pageId>.defs.ts` — desktop description; one future item.
- `web/mobile/page11/<pageId>.defs.ts` — mobile description; one future item.

Thus `N` selected pages predict `4N` defs and `3N` future materialization items. Pages marked
`done` are preserved, `toCreate`/`toUpdate` are generated, and `toRemove` is limited to prior owned
outputs. Selection is page-grained.

## Contract derivation and failures

`contracts30/contracts.ts` derives types from ontology records, access disclosure and backend
operations. Routes are copied exactly; list outputs remain arrays. Transition operations require
an explicit ontology `transition.payload`: `[]` means identity only; otherwise each relative record
path names command input, for example `details.attendanceNote`. Missing payload is a source failure reported as
`D2_CONTRACT_TRANSITION_PAYLOAD_MISSING`; do not invent it in L2.

No downstream LLM or molecule context may run until contracts are approved. A failed upstream
phase must be recorded as failed and downstream phases as not run—never as an approved zero-unit
phase.

## Restart and integrity invariants

- The accepted input snapshot is reused only when its hash matches.
- Source and contract hashes are reread before promotion and finalization.
- Identical writes and duplicate/late callbacks are idempotent.
- A failed unit can resume without re-running approved siblings.
- Finalization requires the expected defs, paired pages, manifests and an acyclic graph.
- A complete barrier becomes a no-op before workers are dispatched.

`steps/finalize60/finalize.test.ts`, `steps/shared40/run.test.ts`, and
`steps/pages50/run.test.ts` are the executable references for partial maintenance, interruption,
restart and duplicate callbacks.

## Certification

From `mls-base/` run:

```sh
rtk proxy node_modules/.bin/tsc --noEmit
rtk proxy node scripts/run-tests.mjs 102020 l2
```

Compare normalized TypeScript tuples and named test failures, not only exit codes or totals.
Generated-app sources used as evidence must be pinned to a commit; never read concurrent dirty
bytes as a reproducible snapshot. Keep run evidence under
`mls-102020/l2/certificacao/runs/<task>/` and state clearly when a real source blocks downstream
generation.
