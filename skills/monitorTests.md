# monitorTests — how the generated app's own test cases actually run

> **Owner of the executor:** `mls-102034/l1/monitor/layer_3_usecases/testsUsecases.ts`.
> **Owner of the frontend contract:** `mls-102034/l2/monitor/shared/contracts/tests.ts`.
> **Owner of the generator:** the `agentChangeFrontend` (CF) in `mls-102020` — it emits one
> `<page>.test.ts` per page under `l2/<module>/web/<device>/<template>/`.
> Read this **before** designing or changing a generated test case. Every mechanic below was
> measured in the executor (02/09/2026), not inferred from the case format.

## The case is a single BFF call — there is no `steps` array

```ts
interface PageTestCase {
  id: string;
  routine: string;
  params: Record<string, unknown>;
  paramFieldRefs?: Record<string, string>;   // wire name -> `Entity.fieldId`
  expect: { ok: boolean; errorCode?: string; minItems?: number; shape?: 'object'|'array'|'paginated'; itemsKey?: string };
  mutating: boolean;
  expectedFail?: string;                     // a failure already owned by a named wave
}
```

One routine, one params, one expect. A multi-step scenario is expressed as **sibling cases in the
same file**, not as one case — see the ordering rules below, which make that reliable.

## Two GLOBAL phases, not one pass per file

`runPageTests` runs **every** read case of **every** file first, then everything else:

```
isReadCase(c)  ===  c.expect.ok && !c.mutating

Phase A: for (file) for (case) if (isReadCase)  -> feeds the id pool
        fillPoolFromSeedRows(pool)              -> covers what the reads could not
Phase B: for (file) for (case) if (!isReadCase) -> commands and negative cases
```

Consequences that decide a design:

- **A case with `expect.ok: false` is NOT a read case**, whatever it reads. It lands in Phase B,
  next to the commands. That is how a "read it back and it must be gone" case ends up **after** the
  delete that removed it.
- **Inside a phase the order is declaration order** (`for (case of tests.cases)`). Two sibling cases
  run one after the other, deterministically, with no `dependsOn` needed.
- **Across phases there is no way to interleave.** A read that must happen *after* a command cannot
  be expressed as a read case — it has to be a Phase B case (i.e. carry `ok:false`, or `mutating`).
- Both phases are global, so **file order matters between pages**, not just within one.

## The id pool: one per run, first value wins, never overwritten

`<seedRef>` / `<seedValue>` / `<seedSpare>` are the only markers a generated case may carry — the
frontend never sees a row value. Resolution (`resolveParams`):

| marker | resolves from |
|---|---|
| `<seedRef>` | `pool['<module>.<Entity>.<fieldId>']` when `paramFieldRefs` names the fieldRef; else `fieldId`, else the wire name |
| `<seedValue>` | same, entity-qualified only |
| `<seedSpare>` | `pool['spare:<module>.<Entity>.<fieldId>']`, from `seedSpares` in the module's `seeds.ts` |

Two properties that are load-bearing:

1. **The pool is one per RUN** (not per page), so an id harvested by any page's read is usable by
   every other page.
2. **`harvestRecord` never overwrites an existing key** — the first value harvested for a key wins.

Together: **two cases with the same marker and the same `paramFieldRefs` resolve to the same id**,
deterministically. There is no need for a "reference the previous step's id" token; sameness of the
key IS the reference.

An unresolved marker is **omitted** from the request and the verdict becomes `inconclusive` — the
runner never invents an id, and a case whose request no longer matches its declaration is never
counted as a defect.

## Statuses: `fail` has to keep meaning "something new broke"

| status | when |
|---|---|
| `pass` / `fail` | the expectation held / did not |
| `inconclusive` | the case could not verify what it claims (unresolved `<seedRef>`; a `.required` case rejected on a *different* field). **Not** an app defect |
| `knownFail` | the case declared `expectedFail: '<wave>'` and failed as declared. Counted apart from `failed`; when it *passes*, the run reports the mark as stale |
| `skipped` | `mutating` case under `skipMutating` |

## Gotchas that have already cost runs

- **An id ending in `.required` changes the verdict logic.** `fieldUnderTest` derives the field
  under test from the id's suffix (`cmd.<field>.required`) and downgrades to `inconclusive` unless
  the rejection names that field. Never end an id in `.required` unless it really is a
  field-required case.
- **The delete case must stay LAST in its file.** The generator already emits create → update →
  delete. Move the delete earlier and every later case on the same seeded id fails on a deleted
  row — a false red that looks like a backend defect.
- **The pool being global cuts both ways:** a delete in page A consumes the id a later page's
  update would have used. Spare rows (`<seedSpare>`) are the mechanism for a case that must
  consume a row; they exist for create-collision today.
- **`ok: true` proves the call answered, not that it did anything.** A delete that returns ok
  without deleting passes. Verify the *effect* (read it back and require `NOT_FOUND`), not the
  response.
- **`NOT_FOUND` / 404 is the generated convention** for "no row with that id": generated usecases
  `throw new AppError('NOT_FOUND', ..., 404)` when the repository returns `null`. Confirmed across
  `mls-102046/buildFlowFsm` and `mls-102047/controleChamados`. Still worth one `grep` per module
  before relying on it.
- **The run is sandboxed** (`createMemoryDataRuntime`): one disposable in-memory store per run,
  seeded from the definitions. Mutating cases need no rollback because the store is discarded —
  and the generator must not assume any rollback *between* cases.
- **Pages can run AS an actor.** `PageTestsFile.actor` names the l4 actor; the executor resolves
  the seeded MDM Person by tags and builds a context with `actorId` **only** (no `actorScope` — a
  bare actorId as scope 403'd every route).

## Where this is exercised

Only the **page11** generated tests execute anything. The many other generated `.test.ts` are
**type assertions** (`type _X = Assert<Assignable<...>>`) with zero runtime execution — counting
them as delete coverage is a mistake already made once (02/09/2026).

*Written 02/09/2026, from the executor source.*
