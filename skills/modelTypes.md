# Context

Each prompt to use in collab-messages must have a modelType preference, example:

const prompt = `<!-- modelType: code -->
 ...`;

# Model Types

Use this guide to select the best `ModelType` for each task.

```ts
type ModelType =
  | "classifier"
  | "general"
  | "reasoning"
  | "code"
  | "design"
  | "image"
  | "translate"
  | "audio";
```

## Selection

| ModelType | Use when the main task is |
|---|---|
| `classifier` | Classifying, routing, tagging, detecting intent, extracting simple structured data, or validating a result |
| `general` | Answering questions, summarizing, rewriting, documenting, or handling simple instructions |
| `reasoning` | Planning, architecture, analysis, debugging complex problems, comparing alternatives, or making multi-step decisions |
| `code` | Creating, changing, reviewing, testing, or refactoring source code |
| `design` | Designing UI, UX, layouts, pages, components, design systems, Lit 3 interfaces, HTML, CSS, or Tailwind structure |
| `image` | Generating, editing, analyzing, or transforming images |
| `translate` | Translating content between languages while preserving meaning, terminology, and tone |
| `audio` | Transcribing, generating, analyzing, or processing speech and audio |

## Optional prompt markers

Besides `modelType`, a system prompt may carry these OPTIONAL `<!-- key: value -->` markers
(parsed by `getCommentsInPrompt` in collab-messages and forwarded to collab-llm):

| Marker | Values | Effect |
|---|---|---|
| `<!-- x-tool-strict: true -->` | `true` | Tool-call arguments are schema-validated server-side (ajv in collab-llm, one alternate-alias retry on violation). Use on every tool-calling step whose output crosses a gate. |
| `<!-- reasoningEffort: high -->` | `none` \| `minimal` \| `low` \| `medium` \| `high` \| `xhigh` \| `max` | Sets `reasoning.effort` for reasoning-capable models (`supports_reasoning` in the model registry); silently ignored otherwise. Omit to use the model default. Prefer `high` only on whole-artifact planning calls (e.g. agentNewSolution e2/e3/e4) — on parallel fan-outs of small items it multiplies latency and cost for little gain. |

Example:

```ts
const prompt = `<!-- modelType: reasoning -->
<!-- x-tool-strict: true -->
<!-- reasoningEffort: high -->
 ...`;
```
