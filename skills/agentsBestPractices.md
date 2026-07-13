# Skill: Agent Best Practices (building new agents)

How to design and build a new agent pipeline on the collab-messages engine so it stays fast,
maintainable, and understandable by an LLM as it grows. Guidance only — no source code here.
Lessons come from three generations of agents: `agentNewSolution` v1/v2 (flat folders that became
unmaintainable), `agentNewSolution3` (the reference pattern), and the audits of `agentChangeBackend`
and `agentChangeFrontend` (see `todo/modernizeChangeBackend.md` and `todo/modernizeChangeFrontend.md`).

Engine mechanics (hooks, intents, scheduling, parallel system, auto-completion traps) live in
`mls-base/skills/collab_messages.md`. Read that first; this skill is about *how to use* the engine well.

---

## 1. Spec first: flow.json is the contract, not documentation

- Write `flow.json` BEFORE the code: steps, planIds, agent names, `dependsOn`, goals, inputs/outputs,
  gates, model aliases. The code is then validated against it.
- Keep it true forever. A flow.json that describes an aspirational design while the code does
  something else is worse than none — it actively misleads every future LLM session
  (this happened to agentChangeFrontend: its `steps[]` listed agents that never existed).
- When behavior must change, change the spec first, then the code. Record the decision.
- Document in flow.json the runtime-generated planIds too (repair rounds, fan-out groups), as naming
  conventions — otherwise nobody can tell a real step from a dynamic one.
- Give the flow a `schemaVersion` and bump it on structural change.

## 2. One folder per step — the step is the maintenance unit

The single biggest lesson from v1/v2 → v3: flat folders with dozens of sibling `agentXxx.ts` files
make the LLM lose context. Instead:

- `steps/{slug}/` per pipeline step, containing everything that step owns: the agent hook file, the
  prompt (`prompt.md`), the deterministic gate/validator with its test, a short `readme.md`
  (input, output, invariants, known LLM traps), a golden fixture when useful, and a `CHANGELOG.md`.
- `helpers/` at the agent root for shared cross-step code only. This folder is mandatory once more
  than one step imports the same helper. Keep entrypoints (`agentX.ts`, CLI scripts), `flow.json`,
  `spec.md`, `steps/`, `skills/`, `schemas/`, `tools/` and domain-specific asset folders at the root;
  move reusable plumbing, shared gates, persistence adapters, repair state helpers, and CLI clients
  into `helpers/`.
- `CHANGELOG.md` per step, one dated line per change, including dead ends and superseded approaches
  with the why. This local history is what keeps an LLM oriented months later.
- Dispatcher and worker of the same fan-out live in the same folder but in separate files. Never
  discriminate "which role am I playing" via fields smuggled through the prompt JSON when separate
  agents are possible.
- Shared helpers stay minimal, generic, and policy-frozen: they live in `helpers/` and must not know
  about any specific step. If a fix requires touching helpers, stop and review — that is a boundary.
- Versioned JSON schemas for LLM tool outputs live centrally (one `schemas/` folder), each with an
  `$id` + version; bump the version and update fixtures together.

## 3. Deterministic first — spend LLM calls only on judgment

- Derive everything derivable (names, file paths, indexes, orderings, wiring, registrations)
  deterministically from the source artifacts. LLM calls are for creative/judgment work only:
  generating an entity, a usecase, a layout, criticizing an output.
- Never keep an LLM step whose output is not persisted and consumed. agentChangeBackend accumulated
  four "index" steps whose results were silently discarded while downstream re-derived everything —
  pure cost, latency, and confusion. If the output isn't used, delete the step.
- Deterministic naming (stable, derivable identifiers) is what makes reruns, staleness checks, and
  repair targeting possible. Design ids before designing prompts.
- Every LLM output crosses a deterministic gate (schema + semantic invariants) before it is trusted.
  Gate failures produce a bounded retry/repair, never an open loop.

## 4. Parallelism by default (this is the speed lever)

Whenever a step processes N independent items (entities, pages, operations, files), use the
collab-messages parallel fan-out (`parallel_dynamic`) instead of a sequential chain. It is
dramatically faster AND gives the user a live, pleasant progress UI. Defaults and rules:

- **Default `maxParallel: 5`** slots. Raise or lower deliberately (LLM rate limits, cost), but start
  at 5. The engine pre-allocates slots, reuses them as items finish, and deletes finished children,
  so the task record and the UI stay clean at any N.
- **Always set a progress title** on the fan-out parent using the engine placeholders, e.g.
  "Generating {{completed}}/{{total}} pages, failed {{failed}}". This one line is most of the
  "beautiful interface": the user sees real-time progress with control instead of a frozen spinner.
- Keep the per-item ARG compact and unique (it is the hook argument, not a payload).
- **Fan-out children never return `failed`** — a failed child fails the parent and the whole task.
  Children complete-with-trace on error; a downstream finalize/verify step checks artifacts on disk
  and runs a bounded sequential repair for the missing ones.
- **Children never add steps** — the parent owns slots and counters.
- Need ordering between item kinds (e.g. contracts before pages)? Chain separate fan-outs through
  small no-LLM phase steps acting as barriers. One barrier = one phase step; don't overload a single
  fan-out with mixed ranks.
- Host the fan-out under the step that must wait for it, so its completion anchors the next
  `waiting_dependency` step (or a done-anchor, see below).

## 5. Prompts are data, not code

- Every LLM prompt lives in a `.md` file inside the step folder, never as a template string inside
  TypeScript. Prompt edits must not touch code; prompt history must be a clean diff.
- Carry per-prompt metadata as comment markers at the top (model type, strict-tool), so model
  selection is declared where the prompt lives.
- One prompt file per LLM call: steps with plan-then-fanout shapes get `prompt.md` +
  `promptItem.md`, not one mega-prompt.
- Pick the model per step deliberately (cheap/fast models for summaries and bootstraps, strong
  models for generation and judging) via the flow's model aliases.
- Prompts must stay generic: never embed a fix for one specific example/module into a prompt or a
  gate. This is a system that builds systems — either the fix generalizes or it doesn't go in.

## 6. Orchestration: declare, don't hardcode

- Sequence steps through `dependsOn` in the planned tree, driven by flow.json — not by a chain of
  "enqueue the next step" calls with successor names hardcoded inside each step's after-hook
  (agentChangeBackend's pattern; reordering required editing ~20 files).
- Use stable **done-anchors** (a tiny completed marker step like `{step}-done` emitted when a gate
  passes) as dependency targets, so retries and repair rounds don't break downstream `dependsOn`.
- Autonomous agents bootstrap deterministically (skip the root LLM call) and expose a tiny CLI
  (`/run`, `/rebuild`, `/help`) — cheap, predictable entry.
- Persist pipeline state and artifacts on disk (a pipeline/status file per module plus one artifact
  per step), not in the task record. The task is orchestration; the disk is truth. This is what
  makes resume/rerun possible.
- Write a trace file per step attempt; never `console.log` as a logging strategy.
- Once a step's artifact is safely on disk, complete the step with the interaction cleaner
  (`input_output`) so the task record stays small — DynamoDB caps items at 400KB and a full run
  without cleaning WILL exceed it. Never clean a step hosting a pending clarification.

## 7. Validation, judging and repair

- Three faces per checkpoint artifact: the machine artifact (schema-versioned), a short human
  summary, and a deterministic no-LLM gate. The gate decides; the LLM never grades itself.
- An adversarial judge step (LLM critic comparing generated defs against the upstream contract) is
  worth its cost for generation-heavy pipelines — but route its findings into a bounded repair
  state with explicit budgets (per-component and global). Budgets exhausted = surface to the human,
  never loop.
- Repair state that multiple steps share must live in one owned file with one owner module; document
  it as a boundary in flow.json.
- Keep validators in ONE shared module when two steps need the same checks. agentChangeBackend ended
  up with ~9 near-identical validator functions duplicated across two step files — the classic
  "fixed one, forgot the other" trap.
- A final validate-all barrier (integrity, coherence, completeness, staleness) runs before finalize;
  it is deterministic and is allowed to trigger one global repair round.

## 8. User experience checklist

- Fan-out parents show live progress counters (see §4) — this is the default, not a nice-to-have.
- Step titles are short, human, and localized from the root plan's declared user language; no
  hardcoded language strings in agent code.
- Human checkpoints render through the supported pattern only (clarification emitted into an agent's
  payload — see collab_messages.md "Rendering a checkpoint"); a widget that silently fails to mount
  is a broken pipeline, not a cosmetic bug.
- A finished pipeline ends with a short final summary step on a cheap model, and the finalize step
  flips owner statuses so reruns are idempotent.
- No-work runs must exit fast and clean ("nothing to do" path straight to the summary), not walk the
  whole pipeline.

## What to avoid (hard-earned)

- **Flat folders.** Dozens of sibling agent/helper files with no `steps/` and `helpers/` boundary —
  the v1/v2 disease.
- **God-modules.** One shared file accumulating scan + schemas + prompt building + persistence +
  intents (cbShared 868 lines, cfeCreateShared 2,653 lines). Split by responsibility from day one;
  a shared module every step imports is a change with total blast radius.
- **flow.json drift.** Aspirational specs, phantom steps, referenced files that don't exist.
- **Discarded LLM output.** If nothing reads it, the step shouldn't exist.
- **Inline prompts** in TypeScript; prompt+code mixed diffs.
- **Multi-role agent files** (dispatcher + worker + validator + repair in one file, switched by a
  mode field).
- **Engine invariants living only in comments.** Rules like "children never fail", "add the next
  open step before the completed answer", "planIds must be unique" belong in flow.json and step
  readmes, and ideally in gates.
- **Unbounded repair loops** or retries by re-emitting `prompt_ready` from an after-hook.
- **Sequential chains for independent items** — if items don't depend on each other, fan out.
- **Secrets in versioned config files** (a real incident: an API token committed in a materialize
  config). Local, ignored config files only.
- **Re-scanning the world in every hook.** Cache or pass reduced context; a full l4/l5 re-scan in
  the before AND after of every step is pure waste.
- **Two runtimes drifting apart.** If Studio and a Node CLI share a generation core, budgets and
  policies live in the shared core as data, never mirrored by hand in comments.
- **Improving while migrating.** Structural refactors ship with identical external behavior;
  functional improvements go in their own cycle with their own todo.

## Canonical references

- Pattern to copy: `mls-base/mls-102020/l2/agentNewSolution3/` (its `flow.json`, `steps/`,
  `skills/maintenance.md`, `helpers/`).
- Engine mechanics and traps: `mls-base/skills/collab_messages.md`.
- Anti-pattern audits: `todo/modernizeChangeBackend.md`, `todo/modernizeChangeFrontend.md`.
