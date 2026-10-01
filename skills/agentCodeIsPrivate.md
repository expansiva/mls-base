# Skill: An agent's code is private to that agent

**Rule (Wagner, 30/09/2026):** “Já coloca como padrão que dentro de um agente, não pode ser usado código
por outro, se precisar, promover o código para l2/helper ou algo parecido”.

## The rule

1. Nothing outside `mls-<project>/l2/<agentName>/` imports a file inside it. That covers runtime code,
   `import type`, dynamic `import()`, tests and fixtures. It also covers non-agent folders such as
   `l2/aura/…` and `l2/newRelease/…`.
2. When a second agent needs a piece of code, the **owner of that code promotes it** to a shared place.
   Both agents then import it from there:
   - `mls-<project>/l2/helpers/<topic>/…` — code shared by agents; the project is the one that owns
     the concept;
   - `mls-102035/l2/solution/…` — the existing solution-wide library (fs, pool, ontology paths, types).
     It is not an agent and stays valid.
3. What travels between agents as **data** is not code. Examples: `menu.json`, `needs.json`,
   `backend.json`, `.defs.ts`. Other agents read these files; they do not import the producer's
   parser. If a consumer needs the type or the parser, that type or parser is promoted (rule 2).
4. A promoted helper must not import back into any agent folder. A helper depends only on other
   helpers, `l2/solution`, the lib, and its own project.
5. Never copy the code. The owner promotes it and tells the consumer's owner (a `fromPlanner<X>_…`
   file in their backlog). The old path may stay only as a **dated, temporary re-export** of the
   helper. The consumer switches its import in its own task, and the owner then deletes the
   re-export. Until then the import stays listed in the baseline below as debt.

## Why

When agent A imports from agent B, rewriting or deleting B breaks A's compile or its tests, and
nobody sees it coming. This happened on 30/09/2026: deleting the old `agentDefsL2` would have broken
`agentDefsL1` (`steps/input20/regenHead.ts:22-24`) and `agentMaterializeL2` (`sha256Text`). The rule
turns "who depends on my internals" from a grep into a folder boundary.

## Baseline measured 30/09/2026 (static `from`/`import()` of `/_<p>_/l2/agent*/`)

| provider (owner) | cross-agent imports | test/fixture | importers |
|---|---:|---:|---|
| `102035/agentNewSolution5` (L4) | 50 | 22 | `l2/solution`, `l2/newRelease`, agentReviewSolution, planners L1/L2 tests |
| `102021/agentDefsL1` (L1) | 16 | 16 | agentMaterializeL1 tests |
| `102020/agentMaterializeL2` (L2) | 13 | 0 | `l2/aura/agentManagePage*`, `agentManageLanguages` |
| `102021/agentPlannerL1` (L1) | 10 | 6 | agentDefsL1 |
| `102020/agentPlannerL2` (L2) | 9 | 3 | agentDefsL1 (`regenHead.ts`, `gate.test.ts`), planners L1/L4 |
| `102021/agentMaterializeL1` (L1) | 6 | 2 | agentDefsL1 (`d1Artifact.ts`, `d1Identity.ts`) |
| `102020/agentDefsL2` (L2) | 5 | 0 | agentMaterializeL2 (`sha256Text`), agentDefsL1 `regenHead.ts` |
| `102021/agentChangeBackend` (L1) | 1 | 1 | agentPlannerL1 test |
| `102035/agentReviewSolution` (L4) | 1 | 0 | `l2/newRelease/helpers/reviewRun.ts` |

To re-measure, scan every `mls-*/l2/**/*.ts` for imports whose `/_<p>_/l2/<agent>/` differs from the
importing file's own agent folder. The measurement ignores `.generated/`.

## How to apply

- **New code:** the rule holds from 30/09/2026. A spec that makes one agent import another is wrong
  by definition; it must promote the code first.
- **Existing debt:** no big-bang refactor. The owner of each provider row plans the promotion when
  it next touches that agent, or earlier if the import blocks a rewrite. When a row goes to zero,
  remove it from the table.
- **Guard:** a test in the shape of the `localDocRefs` guard should fail on any cross-agent import
  that is not in the table above, and fail again when a listed pair grows. Owner: whoever implements
  it first, with its own spec.
