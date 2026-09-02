# Skill: agentChangeFrontend (CF) — generating `l2` from `l4`

What you must know before changing the CF (`mls-102020/l2/agentChangeFrontend`). Read
[`certificacao.md`](certificacao.md) before reporting any change as done.

## The three genomes

Every screen is generated **three times**: `page11`, `page21`, `page31`. They are three alternative
proposals of the *whole* app — if the module has 10 screens, all 10 appear in each genome.

The screen's **category** (`contentLanding`, CRUD, …) says what kind of screen it is and selects the
**template** for `page21`/`page31`. It never picks a genome and never reduces the number of screens
(`helpers/cfePageRecipe.ts`).

`page11` differs in one way that matters: its `definition` is a **string** (prose), not a JSON
object — deliberate, to leave the generating LLM free.

Normal page pipeline: **one item per page**, and the generated `.ts` carries the same name as its
`.defs.ts`. No `_O<n>` organism split. Items multiplying, or names with numeric suffixes, mean
something upstream is wrong — that is the first thing the checklist counts.

## The run module comes from the command, never from a cache

The module of a run travels explicitly: `command.module` → the materialize step
(`args.module || inferRunModule(pages)`) → the finalize step payload, **including the repair round**.

Do not derive it from `window`-scoped state. `getCreateRuns()` is a `Map` on `window` that is never
pruned; taking its first entry returns the *oldest* run in the browser tab, so a second module
generated in the same tab finalizes nothing, silently. Two tests assert the function that did this
never comes back.

Without a module: do **not** filter pages, record a warning plus a degradation
(`missing-run-module`), and write no `todoFrontend`. A silent no-op is the failure mode this house
rejects.

## Writing status

`todoFrontend` writes are scoped to the run's module. Owner ids repeat across modules; a
module-blind write marks another module's homonyms as done. Same rule as the CB — see
[`agentChangeBackend.md`](agentChangeBackend.md), invariant 2.

Pending pages follow the same identity: a workspace `toCreate` in module B does not enqueue
the homonymous workspace of A. Fan-out args are `{moduleName, pageId, runId}` — two modules
with the same page name in one run are two items, never a silent dedupe.

A `.ok` input whose `fieldRef` points at an entity field is a marker, never an invented literal
(`<seedValue>` from the seeded row, `<seedSpare>` leftover for create). Identity fields stay
`<seedRef>`. Literals remain only for free input with no entity counterpart. Negative
`<field>.required` cases do not change. The runner (102034) resolves the markers; missing is
`inconclusive`, never a made-up value.

## Frontend rules for the generated code

`StateLitElement` (from `mls-102029`) **does not use Shadow DOM**: `static styles = css\`…\`` is
silently ignored. All CSS goes in a `.less` file with the same base name, scoped under the custom
element selector. Colour fallbacks never assume a theme — the runtime theme is dark, and a light
fallback disappears.

## Where the run leaves evidence

| file | what |
|---|---|
| `l4/<module>/pipeline/trace/l2/…` | per-call dumps and materialize plans |
| `frontend-create-report` (per module, in the trace) | pages done, owners done, skipped, incomplete |

`/rebuild all <module>` clears **only** `trace/l2` of that module — never the CB's `trace/l1`.

*Written 31/08/2026.*
