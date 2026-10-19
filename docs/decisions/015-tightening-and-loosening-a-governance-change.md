# 015 — A governance change says which way it moves the constraint, and a loosening is the owner's to merge

**Status:** accepted — owner, 2026-09; a backfill by #639 (#322 row 4) of what #96/#112 built and #320 found
unwritten. It records decisions already taken and changes no behaviour.

## Context

A pull request that changes how the routines work (`CLAUDE.md`, the prompts, the workflows, the guard rails) was
once left for the owner as a class, on the reasoning that a run should not merge changes to its own rules. That
conflated two things: *an author must not land their own work* (true, and enforced by `open-pr` §5 and the
reviewer rules) and *a run must not land a rule change* (too broad: PR #96 sat open all day while the thing it
fixed was live and unfixed).

The cut was moved to the direction of the change. A **tightening** adds a check, a rail or a rule, or only
describes behaviour that already exists; it is merged like any other pull request, by a run that did not open
it. A **loosening** leaves a run able to do something it was not permitted to do; it is the owner's.

Four files then carried the rule and none the reasoning, so #320 happened: the reviewer prompt said a
`loosening` pull request was "held the same way" as `owner-approval`, which lifts on his marker and lets a run
merge, while the skills said a loosening is never routine-merged even after he approves.

## Decision

1. **Every governance pull request states, in one line near the top, whether it tightens or loosens.** The
   classification a run performs, and the three things to get right (judge the constraint and not the signal;
   "it only documents existing behaviour" is the cheapest cover story; the reviewer's job includes disagreeing
   with the label), stay in `open-pr` §6 and `review-pr` §5, where a run reads them while deciding.
2. **A loosening carries the `loosening` label**, which `review-gate` reads and stays red on until the owner
   approves, so the hold is a status a merge rule reads and not only a sentence (#112). A reviewer may
   put it on, never take it off.
3. **Approval does not make a loosening routine-mergeable (#320).** After the owner approves, the merge is still
   his; a reviewer run leaves it. "Held the same way" is true only up to the approval.
4. **A mixed change is a loosening**, owner-gated by the same label, and worth splitting instead.
5. **The asymmetry is the point:** an agent must not be able to vote itself more freedom, but an agent that
   wants the routine held to a higher standard should not wait a day for it.

## Considered and dropped

- **Leave every governance pull request to the owner.** Rejected: it left PR #96 open all day on a live defect,
  and it blocked tightening, which is the direction every rail and check moves.
- **Let `review-gate` enforce "never routine-merged" itself.** Rejected: the gate is a status the owner's own
  merge passes through, so a gate that stayed red after his approval would block him as well. The red status
  holds the merge until he decides; that the merge is then his stays a rule in the skills and the prompts.
- **Borrow `owner-approval` for governance.** Rejected: that label is for a new look only. Asking him to approve
  a change identical to the last one teaches him to approve without looking.
- **Judge the signal.** Rejected: PR #97 stopped the review gate failing its own job, which sounds like a
  loosening, but `review-gate` still goes red and a merge rule still reads it, so nothing a run may do changed.
  A change that quietly stops something being *reported* is how a constraint actually decays.

## Consequences

- A reader who asks why a loosening is the owner's, or why the gate does not enforce the merge itself, follows
  the pointer here; a run classifying a change needs only the skills.
- Removing a rule rather than a copy, or removing any rail, is a loosening and is gated as one.
- A `loosening` pull request that the owner has approved still shows as not routine-mergeable in the
  reviewer's run; that is this record working.
