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
