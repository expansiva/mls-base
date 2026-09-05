# Skill: Index — which skill to read before touching what

Map of the shared knowledge base in `mls-base/skills/`. Read the entry for the area you are about
to change **before** you open the code. Everything here is developer-facing documentation.

## ⚠ Two different things are called `skills/` in this repo

| path | what it is | changing it changes |
|---|---|---|
| `mls-base/skills/*.md` | **developer documentation** (this folder) | nothing at runtime |
| `mls-102020/l2/agentNewSolution/skills/*.md`, `agentChangeFrontend/.../skills`, any `<agent>/skills/` | **text injected into generation prompts** | the apps the agents generate |

Editing an agent's `skills/` file is a **product change**, not documentation. It ships in the next
generated app. Never edit one to "improve the docs".

## The generation chain

| agent | project | writes | skill |
|---|---|---|---|
| `agentNewSolution` (NS) | `mls-102020` | `l4` (product contracts) + `l5` (delivery contracts) | [`agentNewSolution.md`](agentNewSolution.md) |
| `agentChangeBackend` (CB) | `mls-102021` | `l1` (backend) | [`agentChangeBackend.md`](agentChangeBackend.md) |
| `agentChangeFrontend` (CF) | `mls-102020` | `l2` (frontend) | [`agentChangeFrontend.md`](agentChangeFrontend.md) |
| runtime / publish | `mls-102033`, `mls-102034`, `mls-base/scripts` | the running app | [`runtimeEnvironment.md`](runtimeEnvironment.md) + [`publishGitBackend.md`](publishGitBackend.md) |

Cross-cutting:

- [`certificacao.md`](certificacao.md) — how to prove a change to an agent is safe (the two
  tsconfigs, the test baseline). **Read before claiming any agent change is done.**
- [`checklistPosRun.md`](checklistPosRun.md) — after a run: did the generated `.ts` match what the
  `.defs.ts` asked? Commands per agent.
- [`supervisor.md`](supervisor.md) — **the working agreement with Wagner**: what to decide alone
  vs escalate, how to prove a claim (measure against `HEAD`, the detector wins), access model
  (admin is administration; never build a back-door), the one-execution-at-a-time loop. Read this
  before acting as supervisor.
- [`executora.md`](executora.md) — how work is specified and handed to the executing session.
- [`agentsBestPractices.md`](agentsBestPractices.md) — designing a new agent.
- [`agentTest.md`](agentTest.md) — every agent step gets a `.test.ts`.
- [`monitorTests.md`](monitorTests.md) — how the GENERATED app's own cases run (two global phases,
  one immutable id pool, `<seedRef>`, what `inconclusive`/`knownFail` mean). **Read before designing
  or changing a generated test case** — the case format is a single BFF call, not a script.
- [`collab_messages.md`](collab_messages.md) — the task/step engine the agents run on.
- [`modelTypes.md`](modelTypes.md) — model preference per prompt.
- [`mlsProjectsArch.md`](mlsProjectsArch.md) — project layout in production; three implementations of the mls lib surface (cfe / host CLI / runtime VM).

## Rules that hold everywhere

1. **Generated apps are evidence, not workspaces.** `mls-base/mls-1020xx` client projects are
   written by the agents. Never hand-edit one to fix a defect: fix the generator and regenerate.
   A hand-fixed app hides the bug and the next run brings it back.
2. **What the code can say, the code says.** These files carry what the code cannot: cross-project
   contracts, failure history, and recipes. If a rule can be a test, write the test instead.
3. **A stale line here is worse than no line.** Every claim carries a `file:line` or a date. If you
   cannot re-verify it, do not write it.
4. **Strong types, always.** Anything that travels — queue args, step payloads, seed rows — needs a
   declared interface and a typed builder. A bare `JSON.stringify({ … })` or
   `Record<string, unknown>` gives the compiler nothing to check, and the defect surfaces in a user's
   run instead of at build time (31/08/2026: two runs lost because one producer of the page args
   omitted a newly required field). Prefer a compile error to a test, and a test to a runtime guard.
5. **The same agent runs in the browser AND on the host.** (01/09/2026.) The Studio browser stays
   valid; the `collab-msg` CLI (Deno) is an additional host, never a replacement. So: branch on
   **capability**, never on host — `typeof mls.editor?.getModel === 'function'`, never
   `"Deno" in globalThis` to change agent logic. Where the capability exists, browser behaviour is
   byte-identical to before. A missing capability is a **state, not an error**: a field like
   `tscGate: 'unavailable'` is not a degradation, a finding, or a worse verdict. Verdicts record
   the host, and family counts only compare **within the same host**. Every new path needs a test
   on **both** sides. The graph guards (`nsCreateAgentGraph`, `cfeCreateAgentGraph`,
   `cbCreateAgentGraph`, `libStor`) prove no static Monaco/DOM import creeps back into the
   `createAgent()` graph — see the am1–am8 wave.
6. **No `todo/` paths in committed code.** `todo/` is disposable and gitignored; code keeps the
   motivation, never the pointer. Guard: `mls-102020/l2/aura/molecules/shared/localDocRefs.test.ts`.

*Written 31/08/2026; rule 5 (multi-host) added 01/09/2026.*
