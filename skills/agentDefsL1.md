# agentDefsL1 — generate L1 definitions

Developer documentation for `mls-102021/l2/agentDefsL1/`. The call report below
was verified on 22/09/2026. The definition export was aligned to v2 on 25/09/2026.
This is not a prompt skill and changing it has no runtime effect. The text injected
into a later materializer lives under `agentDefsL1/skills/`.

## Responsibility and boundary

`agentDefsL1` reads the canonical L4, the approved planning pool and the L1 inventory,
then writes declarative L1 defs. It does not materialize `.ts` files, change L4, write
`effort.json`, `backend.json`, `todoBackend` or the planner `pipeline.json`, and it does
not dispatch `agentCbMaterialize`, `agentChangeBackend` or `agentChangeFrontend`.

Invoke it as `@@agentDefsL1 <lowerCamel> /run`. `/resume` continues an intact checkpoint
and does not rewrite it. `/help` writes nothing.

## Definition export (v2)

Each `.defs.ts` exports one value, `definition`, and may default-export that
same object. Schema `2026-09-24-d1-definition-v2`. Fields: `artifactType`,
`artifactId`, `moduleName`, `status`, `dependencies`, `data`. There is no
`export const pipeline` and no `agent`.

`status` is `pending`, `generated`, `blocked` or `failed`. The model does not
choose it. A new def is `pending`. A concrete external gap is `blocked`, and
the reason is on the materialization receipt next to the def, not inside the
hash. `generated` is only a later materializer status, and only with a receipt
whose semantic hash, dependency hashes, outputs and verifications still match.
Status and timestamps are outside the semantic hash, so a status edit is not a
new source and does not regenerate the file.

`dependencies` are the files the def actually consumes, qualified as
`_NNNNN_/lN/...`, sorted and unique: L2 contracts, rules, ontology, access and
platform sources. Skills and future output paths are materializer conventions.
They are not written into the def. Business references stay in `data`.

The internal checkpoint `l1/<module>/pipeline/agentDefsL1/` stays, including
its own `pipeline.json`. Removing the pipeline export does not remove rules,
access, MDM bindings or runtime contracts from `data`. A v1 file is refused
on read. It is not converted in place and the module is not deleted to force
another run.

The agendaClinica bench on disk stays at the previous export until the client
regeneration. An isolated replay reads those sources and writes defs only in
the test host.

`entry10 → input20 → domain30 → persistence40 → usecases50 → controllers60 → support70 → finalize80`

| step | output | LLM |
|---|---|---|
| `input20` | snapshot, source hashes, file closure | no |
| `domain30` | domain defs. Enum values are emitted here | no |
| `persistence40` | port, table and adapter. Enum values stay on the domain draft | no |
| `usecases50` | one usecase def per selected usecase. Operation steps only | one worker per usecase |
| `controllers60` | one controller def per page | no |
| `support70` | scope, authority, registry, seed plan, effect plan | no |
| `finalize80` | `report.json`. Integrity, coverage, stale, receipt | no |

`usecases50` is the only step with `prompt.md`. finalize80 does not open another repair
cycle. One repair per unit, eight attempts globally, stays on the earlier steps.

## Report

`finalize80` reads the checkpoint, `input.json`, the drafts and the defs already on disk.
It does not run those phases again. A step that is not `approved` or `failed` on the
checkpoint is `executed: false`. A run held at `input20` does not become a completed
generation of the later phases.

The report separates three facts:

- defs complete, incomplete, or not run
- future `.ts` outputs pending materialization (absence is expected)
- contract and business gaps (`CONTRACT_ABSENT`, `PAYLOAD_UNDECLARED`, `INTEGRATION_UNBOUND`, `MECHANISM_INCOMPATIBLE`, an enum whose covered analysis found no consumer)

An enumeration row separates catalog owner, writer (`derived` wins over `platform`) and restriction (`inherited`, `subset`, `own`, `invalid`, `unresolved`). `consumed` means a seed scenario, route contract or domain/usecase def named that entity and path. A TypeScript union is not runtime enforcement. A platform owner does not remove a local restriction. `ENUMERATIONS_NOT_CONSUMED` is not used for a field that has a covered consumer. Schema `2026-09-24-d1-report-v3`.

`calls` is a receipt, not a bill and not a unit count. `repliesDelivered` counts host payloads on a worker or repair `afterPrompt`, one file per plan and invocation. A repeated delivery does not add another. `promptsAssembled` is a prompt handed to the host and does not prove the call finished. `repairsScheduled` is a repair the barrier opened, not a call. `invocationReplies` is what this invocation added. A resume that does not call records 0 and leaves earlier receipts in place. A missing log, an unreadable file, or a resume with no generation observations leaves the generation total null and names the reason. It is not zero. `finalizeCalledModel` and `finalizeOpenedRepair` are the local finalize step. They stay false and do not describe the generation. `interaction.cost` is not read. The usecase draft's `llmCalls` is not copied here.

`executableBackend` is false. A round-trip through `readL1Inventory` recovers ids, routes,
ports and tables. That recognition is not a runnable backend.

An error keeps `pipeline.status` at `awaitingStep`, names `finalize80`, and stores
`CODE:count` on the step. The step is not `approved`. The same report bytes are not rewritten.

## Certification

From `mls-base/` run the project checker and the project tests. The monorepo
`tsc` is not the gate.

```sh
node scripts/run-tests.mjs 102021 l2
node --input-type=module -e 'import {typeCheckProject} from "./scripts/typeCheckRun.mjs"; const r=typeCheckProject({root:process.cwd(),projectId:"102021"}); console.log(r.marker); console.log(r.excerpt.join("\n")); process.exit(r.verdict.fatal || r.verdict.type || r.verdict.blocking ? 1 : 0);'
```

Compare normalized diagnostics and named test failures, not only the exit code.
A live `/run` on the client bench is a separate regeneration. It is not required
to prove the v2 export, and it does not turn defs into an executable backend.
