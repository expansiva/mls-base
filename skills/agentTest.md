# Skill: Agent Testing — every step gets a `.test.ts`

Applies to **every agent** in the platform — `agentNewSolution`, `agentChangeBackend`,
`agentChangeFrontend`, and any future `agent*`. The method below is agent-agnostic; the agent-specific
names (step ids, tool names, gate functions) are placeholders you fill per agent.

## Rule (definition of done)

- **Every** step agent `.../<step>/<agent>.ts` MUST ship a sibling `.../<step>/<agent>.test.ts`.
  - e.g. `.../steps/e2-journeys/agentNsJourneys.ts` → `.../steps/e2-journeys/agentNsJourneys.test.ts`.
- The **shared test bases live in `mls-102025`** and are imported by every agent via `/_102025_/…`, so all
  agents test the same way with zero duplication. Never copy a base into an agent.
- Tests run under `node:test` (harness: `node scripts/run-tests.mjs <project>`), and the pure bases run in
  the browser too.

## Two levels, matched to the two failure classes

| Level | Catches | Network | Runs in | Deterministic |
|-------|---------|---------|---------|---------------|
| **Static** | tool-schema bugs (enum/`$id`/`$ref`/strict) + all mechanical logic | no | CI, always | yes |
| **Live** (gated) | provider-specific content: the model returns gate-failing args | yes | on-demand only | no (diagnostic) |

Static is the guard rail (free, deterministic). Live is a diagnostic you run before a big change; it is
gated so the normal suite/CI never touches the network.

## The shared bases (in `mls-102025`)

Pure, dependency-free, isomorphic:

1. **`toolSchemaLint.ts`** *(exists)* — `lintToolSchema(parametersJson: string): string[] | null`.
   Static validation of a tool's `function.parameters`: enum/const need `type`; `$id` must be a URI; every
   `#/…` `$ref` must resolve from the root; no union types; `additionalProperties:false`. Errors (with
   path) or `null`. See agentsBestPractices.md §9.

2. **`testLlmClient.ts`** *(exists)* — browser-safe (uses only `fetch`; no node imports, since mls-102025
   has no `@types/node`):
   - `liveTestsEnabled(): boolean` — the single opt-in flag (`AGENT_LIVE_TESTS=1`); agents call this, never
     hardcode an env name.
   - `parseEnvFile(content: string): CollabLlmConfig` — pure parse of a `.env` file's CONTENTS
     (`COLLAB_LLM_BASE_URL/TOKEN/ORG_ID`). The `.test.ts` (node) reads the file and passes the text here —
     the one unavoidably-node line stays in the test; all logic lives in the base.
   - `callToolProvider(cfg: CollabLlmConfig, opts: { modelType: string; system: string; human: string; tool: unknown; maxTokens?: number }): Promise<{ modelType; status; text; args; schemaReject }>`
     — POSTs to collab-llm `/v1/chat/completions` (Bearer from `cfg`; **token never logged**), forces
     `tool_choice`, returns the raw response + parsed `result` args + whether it was a schema-definition
     rejection. `modelType` is the marker value (`<!-- modelType: X -->`); collab-llm resolves it to a model.
   - `callBothModelTypes(cfg, opts)` — convenience: runs the same prompt for `code` AND `design`.

**Live tests always make TWO calls — `modelType: 'code'` and `modelType: 'design'`** — for the SAME prompt,
regardless of the step's production modelType. `code` and `design` route to the two strict-tool providers;
a step that only ever works on one is a latent failure the day it falls back to the other. Assert both.

**Repeat each case `liveRuns()` times (env `AGENT_LIVE_RUNS`, default 1).** LLM content/tool-emission
failures are INTERMITTENT — the model drops a required field on one roll, emits text instead of a tool call
on another. A single call can pass while production hits a bad roll (real case: Grok dropped a required
`purpose` on one run's first workspace; Kimi returned the JSON in `content` instead of `tool_calls`). Loop
the call+assert `liveRuns()` times and fail if ANY run fails; run `AGENT_LIVE_RUNS=5` before a big change.

**Testability requires pure boundaries.** A step is testable only if its tool builder, its gate, and
(ideally) its prompt assembly are pure functions (data in → value out), not buried in a DOM/stor-coupled
hook. If a step builds its tool/prompt inline in a `beforePromptStep`, extract that into a pure helper
first (the tool builder should be a pure function the test can call).

## Step categories & how to test each

### A. LLM step (calls a submit tool)

Two tests in the `.test.ts`:

- **Static (always, CI):** assemble the step's tool schema with its pure builder and assert the lint is
  clean: `assert.equal(lintToolSchema(JSON.stringify(buildTool(resultSchema).function.parameters)), null)`.
- **Live (gated), one case per modelType (`code` and `design`):** build the REAL prompt from **mock fixture
  data** (the step's system `.md` + a representative human + the real tool), send it, then run the step's
  **real gate** on the returned args:
  - hard-assert: no schema-definition rejection (`schemaReject === false`, status 200);
  - diagnostic: `prepare → attach → validate` the args and assert no gate errors (a *consistent* failure =
    a systematic prompt/schema bug to fix — e.g. a misleading prompt example surfaces here).

### B. Mechanical step (no LLM: barriers, finalize, emitters, deterministic gates, id/route derivation)

Not every `agent*` calls the LLM — many are deterministic. Test them as **pure unit tests**: feed mock
inputs to the deterministic function, assert the exact output/intents. No network, always CI, fully
deterministic. A mechanical step with no test is a gap. (Examples that already exist: gate unit tests,
contract-emit tests, the tool-builder hoist test.)

## Example 1 — LLM step (`.../steps/e2-journeys/agentNsJourneys.test.ts`)

Generic skeleton — replace the placeholders with the step's real builder/gate:

```ts
/// <mls fileReference="…/agentNsJourneys.test.ts" enhancement="_blank"/>
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintToolSchema } from '/_102025_/l2/toolSchemaLint.js';
import { liveTestsEnabled, callToolProvider, parseEnvFile } from '/_102025_/l2/testLlmClient.js';
// pure, step-owned: the tool builder + the gate (extract to a pure helper if currently inline)
import { buildStepTool, prepareArtifact, validateArtifact } from './gate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MLS_BASE = path.resolve(HERE, /* up to mls-base */ '../../../../..');
const schema = JSON.parse(readFileSync(path.join(HERE, '../../schemas/<step>.schema.json'), 'utf8'));
const MOCK = { /* minimal representative upstream artifact for THIS step */ };
const config = () => parseEnvFile(readFileSync(path.join(MLS_BASE, '.env'), 'utf8')); // node-only line

// Static — always runs, no network.
void test('<step> tool schema is provider-clean', () => {
  assert.equal(lintToolSchema(JSON.stringify(buildStepTool(schema).function.parameters)), null);
});

// Live — gated. TWO calls: modelType code AND design, same prompt.
for (const modelType of ['code', 'design'] as const) {
  void test(`<step> live @ ${modelType}`, { skip: !liveTestsEnabled() }, async () => {
    const system = readFileSync(path.join(HERE, 'prompt.md'), 'utf8'); // + the tool instruction
    const human = buildHumanFromMock(MOCK);                            // mirror beforePromptStep
    const r = await callToolProvider(config(), { modelType, system, human, tool: buildStepTool(schema) });
    assert.ok(!r.schemaReject && r.status === 200, `schema rejected: ${r.text.slice(0, 200)}`);
    const gate = validateArtifact(prepareArtifact(r.args), /* mock ctx */);
    const errors = gate.issues.filter(i => i.severity === 'error');
    if (errors.length) console.log(`[${modelType}]`, errors.map(e => e.code).join(', '));
    assert.equal(errors.length, 0);
  });
}
```

Working exemplar of this exact shape: `agentNewSolution/steps/e5-behavior/e5OperationLive.test.ts`.

## Example 2 — Mechanical step (pure unit test)

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareArtifact, validateArtifact } from './gate.js';

void test('<step> gate rejects an invalid reference', () => {
  const gate = validateArtifact(prepareArtifact(MOCK_BAD_INPUT), MOCK_CTX);
  assert.ok(gate.issues.some(i => i.code === '<expected.error.code>'));
});
```

## Conventions

- **Naming**: sibling `<agent>.test.ts` next to `<agent>.ts`; one test file per step agent.
- **Two modelTypes**: every live case runs for `code` AND `design` (loop). Never test just one provider.
- **Gating**: every network case uses `{ skip: !liveTestsEnabled() }`. The normal suite makes zero network
  calls; only the opt-in flag exercises the live level.
- **Bases only in 102025**: import `lintToolSchema` / `callToolProvider` from `/_102025_/…`; never copy.
- **Mocks**: small, representative, kept with the test. Live catches *systematic* content issues (they
  reproduce); a one-off model wobble is not a bug — re-run to confirm.
- **Static first**: mechanical steps and the static half of LLM steps must always be green in CI. Live is
  opt-in.

## Coverage template (per agent — fill it in)

One table per agent project; mark each step `LLM` or `mechanical`:

| Step | Kind | static `.test.ts` | live (code+design) |
|------|------|--------------------|--------------------|
| `<step-1>` | LLM / mechanical | ▢ | ▢ / — |
| `<step-2>` | … | ▢ | ▢ / — |
