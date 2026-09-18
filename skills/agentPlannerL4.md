# Skill: agentPlannerL4 — L4 planner (pool dispatch)

Cross-cutting notes for anyone touching `mls-102035/l2/agentPlannerL4` or consuming what it
writes. The agent's own contract lives in that folder's `README.md` and `docs/flow.json`.

Lives in **102035** (master solution) next to `agentNewSolution5`. Does **not** change NS5.
`agentPlannerL2` lives in 102020; `agentPlannerL1` (later) in 102021.

## Invocation

```
@@agentPlannerL4 <lowerCamel>
@@agentPlannerL4 <lowerCamel> /fast
```

- Module must already exist in `l4/` with `pipeline.status: complete`.
- Pending pool messages refuse (`module has pending pool messages; finish or dispute them first`).
- `/estimate` is not available yet. There is no `/rebuild`. Mode is implicit `implement`.
- No LLM. Lists artifacts; does not read ontology to opine.

## What it writes

If the current project's `l5/config.json` is missing `102020` or `102021` in
`workspaceDependencies`, they are appended (existing order kept) and
`projects[id] = { root: '../mls-<id>', type: 'lib' }` is filled when absent — so the platform
finds the planners by name (first match in `workspaceDependencies`). Tokens land on the
module `pipeline.json` as `l5Adjusted`. A config that already lists both is left byte-identical.

`dispatch20` lists every file under `l4/<mod>/` except `pipeline/`, `tobe/`, `pool/` and writes
two equal messages (`from: l4`, `to: l2` and `to: l1`, `round: 1`, `mode: implement`, subject
`Changed artifacts of <mod>`). It invokes `agentPlannerL2` by name (`prompt: { moduleName,
thread, file }`). `agentPlannerL1` is invoked only when that agent exists; otherwise the status
says the requests stayed in the box.

`loop30` counts rounds from the L4 `pipeline.json` pool trace and `listPoolBox`. It does not
read `l2/<mod>/pipeline/` or `l1/`. While a new message is in `pool/l2` or `pool/l1` and
`round < 3`, it creates the next step of that box's owner. At round 3 with a non-empty box it
records `outcome: disputed` and does not delete the message.

## Pool

Mailbox: `l4/<mod>/pool/{l1,l2,l4}/`. Type and helpers: `mls-102035/l2/solution/pool.ts`.
Each owner traces only on its own `pipeline.json` (`tracePoolAt`).

*Written 18/09/2026 (p4_02); dispatch20/loop30 18/09/2026 (p4_03).*
