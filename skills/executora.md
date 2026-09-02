# Skill: Executing session — how work is specified and handed over

Work on the agents is split in two roles: a **supervising** session analyses, writes the spec and
reviews; an **executing** session implements. This file is the contract between them. It also works
as a checklist for a developer implementing from a spec.

## The spec is the whole context

The executing session starts fresh and sees only the file. A spec that assumes a conversation is a
spec that produces the wrong change. Every spec opens with:

1. **Target project(s)** and an explicit **do NOT touch** list.
2. **Mandatory reading** — the skills and neighbouring specs needed to act.
3. **Evidence**, marked read-only: which generated app / run / trace proves the defect.
4. **The defect with `file:line`**, not a description of the symptom.
5. **Acceptance**: both tsconfigs, the suites and their baseline, and the specific proof that the
   neighbouring module/area is intact.
6. **Return**: an `id / status` table plus the list of repos to save.

## Rules the implementation must obey

- **Never commit to git.** The reviewer reads the working tree; commits make human review harder.
  (The Studio commits by itself when an agent runs — that is a different thing.)
- **Generated apps are read-only evidence.** Fix the generator, never the generated app.
- **No `todo/` paths in committed code.** Motivation goes in the code, the pointer does not.
  Guard: `mls-102020/l2/aura/molecules/shared/localDocRefs.test.ts`.
- **Surgical.** Touch only what the task requires. If the target file carries uncommitted work from
  another workstream, add to it — never revert, reformat or "clean" a line that is not yours. A
  cheap proof: the file's `git diff --stat` insertions must grow, and its deletions must not.
- **User-facing text is i18n / English by default**; internal docs follow the folder's language.

## When a deterministic gate already exists, fix the message

If the compiler or a guard already catches a class of error 100% of the time, do not add a written
rule for it — improve what the failure *says*. A rule that restates a gate is a rule that will be
broken later and become a false finding.

## What the review checks

- The change does what the spec asked, and only that.
- The riskiest line (whatever decides deletion, status or scope) read on its own.
- Both tsconfigs and the suites against the baseline — see [`certificacao.md`](certificacao.md).
- The neighbour proved intact.
- Claims verified independently: a report saying "green" is not evidence.

Findings go back as a numbered section appended to the same spec file, so one file tells the whole
story of the change.

*Written 31/08/2026.*

## Never dispatch an agent run

(01/09/2026.) The executing session writes code and certifies it (`tsc` + suites). It does **not**
start an agent run — not in the Studio browser, not through the `collab-msg` CLI. Whoever supervises
owns the run: they choose the moment, the command (`/run` vs `/rebuild all`), and the baseline it is
measured against.

Why it is a rule and not a preference: a generated app is the measurement instrument. On 01/09 an
executing session started a `changeBackend` on its own; it aborted after ~34 minutes and left
`mls-102047/l1` half-written — which destroyed the 20-error baseline the measurement existed to
compare against. The code was fine; the evidence was gone.

If a spec's acceptance needs a live run, the session finishes the code, says so in the return, and
stops.
