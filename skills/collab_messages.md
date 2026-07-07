# Skill: collab-messages (tasks, steps and agents)

How the collab.codes task/step engine actually works, so an LLM can build agents and checkpoints
without re-deriving it. This is a **reference index** — it points to the real source instead of
copying it. Read the referenced file when you need detail.

## Projects involved

- **Frontend** — `mls-102025` (collab-messages UI): renders threads, tasks, steps and mounts
  clarification widgets.
- **Orchestration client** — `mls-102027` (collab-common): the client-side agent runtime (hooks,
  pooling, intent helpers). Imported as `/_102027_/...`.
- **Backend** — `collab-messages` (separate repo at repo root, NOT inside `mls-base`): applies intents
  to the task tree, schedules step execution, calls the LLM.
- **Types** — `mls-base/types/mls.d.ts` (`mls.msg.*`): `AIPayload`, `AIAgentStep`,
  `AIClarificationStep`, `AgentIntent*`, `ExecutionContext`, `TaskData`.

Import alias: `/_102027_/l2/x.js` → `mls-102027/l2/x.ts`, `/_102025_/...` → `mls-102025/...`.

## Mental model (read this first)

- A **task** (`TaskData.iaCompressed`) is a **tree of steps** (`nextSteps[]`). The first step
  (`stepId: 1`) is the **root agent**. A step's children live in its `nextSteps[]` OR, for
  LLM output, in its `interaction.payload[]`.
- Agents never mutate the tree directly. They return **intents**; the client sends them with
  `mls.api.msgApplyIntents({ userId, intents })`; the **backend** applies them and re-runs the
  scheduler. See `collab-messages/src/layer_2_controllers/applyIntents.ts` (`executeApplyIntents`).
- Step types (`mls.msg.AIPayload`): `agent`, `tool`, `clarification`, `result`, `flexible`.
- Agent code = **hooks** (client side). The backend enqueues a hook, the client runs it and returns
  intents. Hook contract: `mls-102027/l2/aiAgentBase.ts` (`IAgentAsync`).

## Agent hooks (client) — `mls-102027/l2/aiAgentBase.ts`

- `beforePromptImplicit(agent, ctx, userPrompt)` — entry for a free-text `@@agent` message. Usually
  returns one `add-message-ai` intent to create the task/root step. (`@@agent` with no text arrives
  as an empty `userPrompt` — the runtime strips the mention: see `executeBeforePrompt` in
  `aiAgentOrchestration.ts`.)
- `beforePromptStep(agent, ctx, parentStep, step, hookSequential, args?)` — runs before a step's LLM
  call. Return a `prompt_ready` intent (systemPrompt/humanPrompt/tools) to trigger the LLM, or an
  `update-status` to finish the step with no LLM (see the no-LLM wrapper pattern below).
- `afterPromptStep(agent, ctx, parentStep, step, hookSequential)` — runs after the LLM answered
  (`step.interaction.payload[0]`). Validate/persist, then return intents (add-step, update-status).
- `beforeClarificationStep(agent, ctx, parentStep, step, hookSequential, json)` — returns the
  `HTMLElement` widget for a pending `clarification` step. Distinguish widgets by `planning.planId`.
- `openStepView(agent, ctx, step)` — re-openable read-only view of a finished step (optional).

## Intents — `mls.msg.AgentIntent` (types in `types/mls.d.ts`, applied in `applyIntents.ts`)

- `add-message-ai` — creates the task + root step (only valid before the task exists). Enqueues
  pooling and adds the task to the scheduler. Backend: `intentAddMessageAI` → `addMessageAI.ts`.
- `prompt_ready` — sets the current step's prompt/tools and schedules the LLM call; the result lands
  in that step's `interaction.payload`. Backend: `intentPromptReady` → `tasks.ts:continueBeforePrompt`.
- `add-step` — inserts a step under `parentStepId` (into the parent's `nextSteps`). Backend:
  `intentAddStep` → `tasks.ts:addTaskAISteps` → `aiOrchestrator.ts:addSteps`. An added `agent`/`tool`
  step that is NOT `waiting_dependency` is enqueued to run immediately; a `waiting_dependency` step
  waits for its `dependsOn` to complete.
- `update-status` — changes a step's status (`pending|in_progress|completed|failed|...`). Completing
  a step **unlocks** downstream `waiting_dependency` steps. Backend: `intentUpdateStatus` →
  `tasks.ts:intentUpdateStatus` + `unlockWaitingDependencySteps`.
- `remove-hook` — removes a processed hook from `queueFrontEnd`.
- `pause-or-continue`, `parallel-steps` — pause/resume and dynamic fan-out.

## Scheduling / dependencies — `collab-messages/src/layer_3_usecases`

- Every intent ends with `llmStepScheduler.addTask(...)` (`llmStepScheduler.ts`); the scheduler picks
  the next runnable step and enqueues its hook.
- Dependency rule (`tasks.ts:unlockWaitingDependencySteps`): a `waiting_dependency` step becomes
  runnable when **every** `planning.dependsOn` planId belongs to a step whose status is `completed`.
  This is how `e1-draft` runs after `e1-clarification-answer`, and `e2-journeys` after the checkpoint.
- Client-side re-run of the loop after applying intents: `continuePoolingTask(ctx)` in
  `aiAgentOrchestration.ts`.

## Rendering a checkpoint / custom widget (IMPORTANT)

A `clarification` step only renders if the frontend can resolve its **owning agent**, and it does
that by walking agent `interaction.payload` (`aiAgentHelper.ts:getInteractionStepId`, used by
`mls-102025/l2/collabMessagesTaskDetails.ts:renderClarification`). So:

- **The clarification must live in an agent step's `interaction.payload`.** A flat clarification in
  `nextSteps` renders as "No found parentInteraction" and never mounts.
- **The reliable way is: an agent step EMITS the clarification into its own payload.** `beforePromptStep`
  returns `prompt_ready`; the LLM returns `{ "type": "clarification", "json": {...} }`; `afterPromptStep`
  returns `[]` to keep the payload; `beforeClarificationStep` mounts the widget (any widget — questions
  or a custom one). Examples: `mls-102020/l2/agentNewSolution2/agentNewSolution2Requirements.ts` and ns3
  `e1-clarification` + `checkpoint-draft` (`steps/e1-draft/agentNs3Draft.ts`, `checkpointSystemPrompt`).
  Cost = one cheap `codefast` call; the widget can ignore the emitted content and rebuild from disk.
- After the human answers/approves, create a completed `result` step (e.g. `*-answer`) that the next
  step `dependsOn`; that both completes the emitting agent (via `setStepCompletedIfChildrenCompleted`)
  and unlocks downstream. Examples: `e1-clarification-answer`, `checkpoint-draft-answer`.
- **Do NOT use a "wrapper" agent step with a child clarification in `nextSteps`.** It deadlocks (see
  "What NOT to do"). The `agentNewSolutionFinal` shape (wrapper + child) looks like this but is not a
  safe pattern to copy for a mid-pipeline checkpoint.

## Common client functions — `mls-102027/l2/aiAgentHelper.ts`

- `getAllSteps(firstSteps)` — flatten the tree (BFS over `nextSteps` + `interaction.payload`).
- `getStepById`, `getRootAgent`, `getAgentStepByAgentName`.
- `getNextPendentStep(task)` — first step with status `pending` (what the UI tries to render).
- `getInteractionStepId(task, stepId)` — the owning agent of a nested step (payload walk; see rule above).
- `getNextStepIdAvaliable(task)` — next free stepId.
- `appendLongTermMemory(ctx, {...})` — persist small key/values on the task (read back at
  `ctx.task.iaCompressed.longMemory`). Useful to pass flags between the root and later hooks.
- `notifyTaskChange` / `notifyThreadChange` — UI refresh events.

Orchestration — `mls-102027/l2/aiAgentOrchestration.ts`: `continuePoolingTask`, `processIntents`,
`getClarificationElement`, `finishClarification`, `loadAgent`, `executeBeforePrompt`.

## What NOT to do

- **Don't add a checkpoint clarification as a flat sibling** in the root's `nextSteps` — it won't
  render (see rule above). Emit it from an agent's payload (`prompt_ready` -> LLM clarification).
- **Don't use an agent step as a passive CONTAINER for a child step (deadlock).** A parent step only
  completes when its `nextSteps` children complete (`aiOrchestrator.ts:setStepCompletedIfChildrenCompleted`),
  and a `waiting_dependency` child only unlocks when its `dependsOn` parent completes
  (`tasks.ts:unlockWaitingDependencySteps`). So "agent step with a child that dependsOn it" = parent
  waits for child, child waits for parent = the step sits `in_progress` forever with no LLM. This is
  the ns3 checkpoint bug (msgtask3). Emit clarifications into `interaction.payload` instead.
- **Don't mutate `TaskData` directly.** Every change is an intent applied via `msgApplyIntents`.
- **Don't `add-step` or `update-status` on a parent whose status is `completed`/`failed`** — the
  backend rejects it (`addTaskAISteps` throws "Parent step cannot be modified"). Update-status to a
  non-terminal parent (see ns3 `findMutableParentStep`).
- **`update-status` cannot change a step's `prompt`.** To re-run with new args, `add-step` a fresh
  agent step with a unique `planning.planId` (beware duplicate planIds breaking dependency lookups —
  `getInteractionStepId`/`findStepByPlanId` return the first match).
- **Don't re-emit `prompt_ready` from `afterPromptStep`** to retry — it can orphan the original
  `beforePromptStep` hook. Add a controlled new step instead (ns3 gate retry pattern).
- **Don't rely on `nextSteps` for rendering routing on the frontend** — only `interaction.payload`
  is walked by `getInteractionStepId`. (Backend `getParentStepByChildStepId` checks both; the
  frontend is the stricter one.)
- **Don't put language-specific strings in agent code.** Localized titles/labels come from the root
  plan; declare `userLanguage` and pass labels down.

## Canonical examples to copy

- Clarification via LLM + custom logic: `agentNewSolution2/agentNewSolution2Requirements.ts`.
- No-LLM widget checkpoint (wrapper + child clarification): `agentNewSolution/agentNewSolutionFinal.ts`.
- Spec-first step pipeline with gates + pipeline.json + resume: `agentNewSolution3/` (see its
  `flow.json`, `agentNewSolution3.ts`, `steps/e1-draft/agentNs3Draft.ts`).

## Backend map (collab-messages) — where to add/understand intents

- Intent dispatch: `src/layer_2_controllers/applyIntents.ts` (`executeApplyIntents`, one `intent*`
  handler per intent type). **Add a new intent type here.**
- Task tree ops: `src/layer_3_usecases/tasks.ts` (`addTaskAISteps`, `intentUpdateStatus`,
  `unlockWaitingDependencySteps`, `getParentStepByChildStepId`, pooling).
- Tree primitive: `src/layer_3_usecases/aiOrchestrator.ts` (`addSteps`, `updateStepStatus`,
  `getStepById`, `getAllSteps`).
- LLM scheduling: `src/layer_3_usecases/llmStepScheduler.ts`, `schedulerManager.ts`.
- Task creation: `src/layer_2_controllers/addMessageAI.ts`, `addTaskAISteps.ts`.
