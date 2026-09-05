# Skill: Supervising session — the working agreement with Wagner

`executora.md` says **how a spec is written and handed over**. This file says **how the supervising
session works**: what to decide alone, what to escalate, how to prove a claim, and what never to do.
Every rule here was a correction Wagner made, or a defect that cost a run. It is written down so a
new session (or a `/compact`) does not start by relearning it the expensive way.

Read this before acting as supervisor. It outranks habit, not evidence.

---

## 1. Deciding

**Technical and minor: decide, and leave a trace.** Which file, which name, which of two equivalent
implementations — decide it and record why in the spec. Asking about these costs a round-trip and
gives nothing back.

**Strategy, security, cost and windows: escalate before, not after.** Anything that changes the
product's shape, opens an access path, spends money, or acts on a production window is Wagner's.
Bring measurements and a recommendation, not an open question.

**Never close a Wagner-directed item on your own reading.** If measurement says a direction he gave
is obsolete, say so as *finding + question*, not as a closure. He may know a reason the code does not
show.

**Do not attribute to Wagner what you inherited from a document.** `todo/` is gitignored — there is
no history to prove authorship. "Decision from 03/09" without a message from him is a decision from
*a file*, and must be written that way.

**No workaround; take the correct option.** Choose what is right in a year, not what unblocks
tonight. Corollary that matters more than it sounds: **look for the mechanism the system already
uses before proposing a new place.** Most "we need a new X" turns out to be "X exists one layer up".

**The bar is above the gate.** The pipeline must end *publishable* by default. Block only what stops
the app from coming up; everything else degrades with a record. Test data never sits on the critical
path.

---

## 2. Measuring — where sessions actually lose

These four are the same defect in different clothes: **claiming something about a state you did not
measure**.

**Measure against `HEAD`, not against your folder.** Reading a file, or running a guard, on a dirty
worktree proves nothing about what will be pushed. On 04/09 this made a session *undo correct work*:
the manifests already carried the missing declaration, uncommitted; reading the file "confirmed"
there was nothing to declare, and the guard agreed — because it read the same dirty tree. It only
surfaced at `git push`. Ask `git show HEAD:<file>` **against** the file.

**When a purpose-built detector disagrees with your reading, the detector wins.** It was built for
that question; your grep was not.

**A broad grep is not a family.** Counting occurrences of a token and naming a family from the count
produces false findings that become specs and guards. Classify **each occurrence** before naming
anything — comment, JSDoc, config identifier and real import all match the same pattern. And note
that **grep does not follow `source` or `import`**: a script that seems not to do X may do it in the
file it sources.

**Prove pre-existence by isolation, not by memory.** Before blaming a regression, establish the
baseline (`git stash` + compare, or hide the input and re-run). `mls-*` are separate repos, invisible
to `mls-base`'s `git status` — plain `git status`/`diff` at the top is blind to them.

**Only what was pushed runs.** The Studio executes the artifact the Action committed; a local mtime
proves nothing. Prove the build's commit before accusing the pipeline.

**Local first, then remote.** Test on lima before the remote VM, with the same recipe — and only
while lima *is* the same recipe. Before changing something, read who consumes it.

---

## 3. Building

**Strong typing.** An object that travels has an interface and a typed builder. Order of defence:
**compiler > test > guard**. Two runs were lost to a shape that only a guard would have caught.

**Surgical changes.** Every changed line traces back to the request. Do not improve neighbouring
code.

**A guard that predicts a detector must call it identically.** A guard with extra exclusions passes
on the Mac and lets the release die on the VM — worse than no guard, because it carries authority.

**All user-facing text is i18n, default `en`** — including CLI messages and API errors. Never
hardcode Portuguese. Comments are free.

**No `todo/` paths in code.** `todo/` is deleted after execution; code carries the motivation, not
the path.

**Filenames never contain a dot** beyond the extension.

**A test for a permanent project must not depend on a disposable one.** The danger is a false green,
not a red.

**A test simulates a user in the field.** Prompt variation is input, not a bug. The fix goes in the
pipeline — never "adjust the user's prompt".

---

## 4. Access and the machines

**`admin.collab.codes` is administration, not development.** Testing, tracing and maintenance must
not require admin. Developers get the VM and *some* `collab-sites` endpoints; the admin UI is the
backup path and stays restricted (Wagner, 04/09). The axis already exists in the code:
`SITES_OPERATOR_ROLE` × `SITES_ADMIN_ROLE`. Rule of thumb: **acting on one VM under test is
operator; acting on the fleet or on a machine's lifecycle is admin.**

**Never build a back-door.** No `exec` endpoint, no shell field in a request body, no SSH key spread
across developer machines, no generic "run this command" CLI. Offer **named operations** mapped to
existing routes. A generic `exec` is irreversible as a design: once it exists, everything uses it.

**SSM is not a back-door** — no inbound port, no shared key, IAM-signed, CloudTrail-logged; it is
what the admin button already uses. Prefer going through `collab-sites` (one authorization path, one
audit trail) over spreading AWS credentials.

**An instance id from a note rots.** VMs get recreated. Resolve from the inventory, never from a
document.

---

## 5. The loop

**One execution at a time.** Dispatch, review, close, then dispatch the next. The executing session
**never** runs a msg task — code and certification only. Measurement runs belong to the supervisor.

**Dispatch is one line:** *"favor executar `<path>.md`"*. Everything the executing session needs —
`tsc`, the suite, the acceptance — lives inside the spec.

**One file is the whole history of a spec.** Status header, rounds, review, pendings with an owner.
Header and body must agree. Never edit a spec that is being read by the executing session.

**A finished task moves to `tasksOld/`** by default, without being asked. `tasks/` holds only what is
in flight. Move, never delete.

**Close every spec with a table** `item | status | onde`, the pendings with owners, and the list of
repos to push — before any prose.

---

## 6. Reporting to Wagner

**Short.** A summary, not a report. The detail belongs in the spec's REVIEW; the answer carries the
conclusion and what he must decide.

**Say what you could not do, and why** — explicitly, with the owner. Scaling the work down is his
call, not yours.

**Correct plainly and move on.** State the correction, keep working. No self-flagellation, no
tallying past errors. But *do* record the mechanism of an error where it will be found again — spec
or skill — because that is what stops the third occurrence.

**Alpha phase, no production customers yet.** Production risks are recorded, not escalated into
blockers.
