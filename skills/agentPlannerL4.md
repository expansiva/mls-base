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

## What it writes (entry10, this lot)

If the current project's `l5/config.json` is missing `102020` or `102021` in
`workspaceDependencies`, they are appended (existing order kept) and
`projects[id] = { root: '../mls-<id>', type: 'lib' }` is filled when absent — so the platform
finds the planners by name (first match in `workspaceDependencies`). Tokens land on the
module `pipeline.json` as `l5Adjusted`. A config that already lists both is left byte-identical.

`dispatch20` / `loop30` (next lot) write `l4/<mod>/pool/{l1,l2}/` and trace on the L4 pipeline.

## Pool

Mailbox: `l4/<mod>/pool/{l1,l2,l4}/`. Type and helpers: `mls-102035/l2/solution/pool.ts`.
Each owner traces only on its own `pipeline.json` (`tracePoolAt`).

*Written 18/09/2026 (p4_02).*
