# agentDefsL1 — generate L1 definitions

Developer documentation for `mls-102021/l2/agentDefsL1/`, verified on 22/09/2026.
This is not a prompt skill and changing it has no runtime effect. The text injected
into a later materializer lives under `agentDefsL1/skills/`.

## Responsibility and boundary

`agentDefsL1` reads the canonical L4, the approved planning pool and the L1 inventory,
then writes declarative L1 defs. It does not materialize `.ts` files, change L4, write
`effort.json`, `backend.json`, `todoBackend` or the planner `pipeline.json`, and it does
not dispatch `agentCbMaterialize`, `agentChangeBackend` or `agentChangeFrontend`.

Invoke it as `@@agentDefsL1 <lowerCamel> /run`. `/resume` continues an intact checkpoint
and does not rewrite it. `/help` writes nothing.

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

From `mls-base/` run:

```sh
npx tsc --noEmit
node scripts/run-tests.mjs 102021 l2
```

Compare normalized diagnostics and named test failures, not only the exit code.
A live `/run` on this bench stops at `input20` while L2 contracts are absent. That stop
is `CONTRACT_ABSENT`, not a completed defs run.
