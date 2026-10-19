# 017 — A developer run may take a second item, never a third

**Status:** accepted — owner, 2026-09-10; a backfill by #641 (#322 row 6) of #97, with the conditions refined
by #145 and the recording obligation by #239. It records decisions already taken and changes no behaviour.

## Context

The measured bottleneck was not development. Median pull-request open-to-merge was 1.2 hours and 64 pull
requests merged in 4.1 days; what stalled work was **review and conflict**: #150 sat blocked for ten hours,
#163 came back twice on stale green ticks, and three agents sharing a checkout corrupted each other's edits.
Giving every run two items would have doubled the review queue and the collision surface, the opposite of the
fix. Yet a run with idle capacity and nothing to review was wasted.

## Decision

1. **A run may take one more item, as a second, separate pull request, when four conditions hold**, checked in
   order after STEP 3 with the stop at the first that fails: at most three pull requests waiting for review;
   time left in the run; the second item's files disjoint from the first's; the first item actually finished.
   The conditions are acted on mid-run, so they stay verbatim in `docs/ROUTINE-PROMPT.md` STEP 3, which is the
   rule's home; `CLAUDE.md` points there.
2. **It is a condition, not a quota** (owner, 2026-09-10). The rule is self-limiting by construction: the moment
   second items produce a review backlog, condition 1 stops being true and the run goes back to reviewing.
   That property is the point; do not replace it with a counter.
3. **Never a third.** One extra is the cap because each further item adds review and conflict cost that the
   same measured bottleneck says is the scarce thing.
4. **Always a separate pull request**, never one closing two issues: the two must be reviewable, mergeable and
   blockable independently, and one going bad must not hold the other.
5. **The run records it either way**: the heartbeat's `- second item:` line says whether it took one and, if
   not, which condition failed (#239); a hook refuses a heartbeat without it. The hook cannot tell whether a
   skipped item was truly ineligible, only that the run said.

## Considered and dropped

- **Two items per run, always.** Rejected: it doubles the review queue, which is the bottleneck.
- **A counter or quota of second items per day.** Rejected: a counter needs tuning and can be met while the queue
  grows; the conditions track the queue itself.
- **Treat `Part of #<n>` as "not finished" for condition 4.** Rejected (#145): a complete, reviewable part of a
  larger issue passes; unfinished work does not.

## Consequences

- A reader who asks why two and not three, or why a counter was refused, follows the pointer here; a run reads
  the four conditions in STEP 3 and never needs this.
- Raising the cap or dropping a condition loosens a constraint on a run and is the owner's (see 015).
