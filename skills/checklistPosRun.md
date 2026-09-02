# Skill: Post-run checklist — did the agent deliver what the defs asked?

Run these AFTER an agent finishes, outside the pipeline. They block nothing; they answer one
question: **the `.defs.ts` asked for something — does the generated `.ts` match?**

Run from `mls-base`. `P` = project id (e.g. `102047`), `M` = module.

## Reading rules (the ones that cost the most)

1. **`tsconfig.frontend.json` covers `l2` and EXCLUDES `**/*.test.ts`;** `tsconfig.backend.json`
   covers `l1`. One `tsc` is never proof. To include the tests, copy the frontend config without the
   exclude line, run it, and **delete the copy**.
2. **The test runner exits 0 even when tests fail** — compare red files one by one against the
   baseline in [`certificacao.md`](certificacao.md).
3. **Compare against the NEIGHBOUR module, not against memory.** If the older module in the same
   project has the defect too, it is not this round's regression.
4. **`mtime` arbitrates nothing** — the browser→disk sync stamps everything alike. Date things by
   content: `savedAt`, `runId`, the run's `Agent build:` stamp.
5. **Count, do not eyeball.** "Looks fine" is what let 15 organisms through on a single page.

## agentChangeBackend (l1)

```bash
ls mls-$P/l4/$M/operations/ | sed 's/\.defs\.ts//' | sort > /tmp/ops.txt
ls mls-$P/l1/$M/layer_2_application/usecases/*.defs.ts | xargs -n1 basename | sed 's/\.defs\.ts//' | sort > /tmp/uc.txt
comm -23 /tmp/ops.txt /tmp/uc.txt          # operation with NO usecase
npx tsc -p tsconfig.backend.json --noEmit  # the CB's product is l1
python3 -c "import json;d=json.load(open('mls-$P/l4/$M/pipeline/trace/l1/cb-health-report.json'));print(d['outcome'],d.get('reason'));print(d['operationsMissing'])"
```

- [ ] `comm` output empty. Each line is a route that will answer `ROUTINE_NOT_FOUND`.
- [ ] Every usecase has a `.ts`, not only a `.defs.ts`.
- [ ] `operationsMissing.declared == covered`.
- [ ] `costByPhase["gen-usecase"].calls` equals the number of pending operations — fewer means the
      scan skipped owners, not that the LLM failed.
- [ ] `repairHistory` dated **by content**: entries can belong to a previous run (state is only
      cleared when a run ends well). Compare their timestamps with `savedAt`.
- [ ] No impossible finding burning the repair budget (e.g. a pure arithmetic loop accused of N+1).
- [ ] `seeds.ts` carries **all** waves of the `*-agent-cb-seeds.json` dumps, not only the first.
- [ ] `l4/$M/pipeline/runNN_changebackend.json` exists — including when the run failed.
- [ ] The task closes as `completed`.

## agentChangeFrontend (l2)

```bash
for g in page11 page21 page31; do echo "$g: $(ls mls-$P/l2/$M/web/desktop/$g/*.defs.ts 2>/dev/null | wc -l)"; done
ls mls-$P/l4/$M/workspaces/ | wc -l
grep -oE '"organism": "[^"]+"' mls-$P/l2/$M/web/desktop/page*/*.defs.ts | sort | uniq -c
```

- [ ] The three genomes have the **same** page count, and it equals the number of l4 workspaces.
- [ ] One pipeline item per page, and the `.ts` carries the same name as the `.defs.ts`.
- [ ] No id repeated with a numeric suffix (`richText2`, `primarySurface3`) — that is a generator
      loop, not a big page.
- [ ] Every `outputPath` in the defs has a file on disk; no orphan `_O<n>.ts`.
- [ ] `definition` is a **string** (prose) in all three genomes.
- [ ] `l5/config.json`: page count matches, and the menu lists no page that does not exist.
- [ ] No NEIGHBOUR module lost a page.
- [ ] `runNN_changefrontend.json` exists, `verdict` matches reality, `degradations[]` lists what
      degraded — and if it failed, WHICH module caused it.

## agentNewSolution (l4/l5)

- [ ] Read `command` in `runNN_newsolution.json` and list what the request implies; each item has an
      operation in `l4/$M/operations/`. What vanished, vanished at which step?
- [ ] No extra actor: a persona or a demographic does not create an actor.
- [ ] On-demand entities (export, report) come out as `kind: projection` +
      `storage.target: derived` — no table, no catalogue.
- [ ] `ls l4/$M/workspaces/` matches the screens the request implies, no more, no less.
- [ ] `pipeline.json`: e1..e10 all `approved`.
- [ ] Every `l5/<module>/todoBackend.defs.ts` owner starts as `toCreate`.
- [ ] After `/rebuild all`: the target module was wiped and the **neighbour is intact** — count the
      neighbour's files before and after.

*Written 31/08/2026. Trace paths follow the per-layer layout (`pipeline/trace/l1`, `pipeline/trace/l2`).*
