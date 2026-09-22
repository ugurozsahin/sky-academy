# 008 — The backlog is refined by a routine, which may set priority behind a one-day gate

**Decided** 2026-09-22, with the owner, in session. **Issue** #512. Supersedes nothing; it adds a fourth
routine beside the three `docs/decisions/003-two-routines.md` and `docs/WATCHDOG-PROMPT.md` describe.

## What was decided

A daily scheduled task, `docs/REFINER-PROMPT.md`, shapes the backlog: duplicates, dead issues, complexity,
epics, acceptance criteria, area labels, and a health report. It may **apply** the cheap, reversible changes
at once. It may **propose** the irreversible ones — closing an issue, `priority:*`, `blocked` — and apply them
on the next day's run if it still derives the same proposal and nothing objected.

## Why a routine may touch priority at all

`CLAUDE.md` and `.claude/rules/governance.md` call `priority:*`, `blocked` and `later` **the owner's three
ordering tools**, agreed with him on 2026-09-11. This changes that, for the first two, and it is therefore a
**loosening** under the `open-pr` skill §6 — owner-gated, and it was gated: the pull request carried the
`loosening` label and his own marker.

The reason the rule was written was to stop a run promoting its own work. That reason does not reach a routine
that cannot develop anything: the refiner opens no pull request, so it has nothing to promote itself into.
What it can do instead is the thing nothing else does — notice that nine issues carry no priority label at all
and therefore sort behind all 130, which STEP 3 rule 4 makes indistinguishable from parked.

`later` stays untouched, and so does `owner-session`. Those two are how the owner says "not yet" and "not by a
routine", and a refiner that could overrule them would be overruling the very instruction that put them there.

## Why the gate is a day rather than a count

A per-run ceiling was the first proposal — at most five closes, five priority changes, the rest deferred.
It was dropped because it bounds the **wrong** quantity. A ceiling says how much damage one run can do; it
says nothing about whether any single act was right, and a wrong close is just as wrong as the fifth one. The
two-phase gate bounds by time instead: a proposal has to survive a day and be re-derived from the repo as it
stands tomorrow, so an act that was only ever right about a stale tree never happens.

It also costs nothing on the cheap half. Applying `complexity:*` or an acceptance criterion behind the same
gate was considered and dropped: a wrong label is one click back, and the first run would otherwise write 73
proposal comments and change nothing.

**Re-derive, do not replay.** The ledger in the `refiner: backlog` issue body stores only *when* a proposal
was first made, never the reasoning. A replayed proposal is a claim about a tree that has since moved; a
re-derived one is a claim about the tree in front of it. That distinction is the gate — without it the delay
would only be a delay.

## Why the objection signals are the ones they are

`refine-hold` is a standing per-issue exemption. For a single proposal the signals are **a reopened issue** and
**a value changed after the refiner set it**, both read from state rather than from words — from the issue's
own `events` timeline, never from the ledger.

**That last distinction was a defect before it was a principle (#513 round 1, B1).** The rule first read "a
priority you set, that someone changed back, is never set again", with the ledger as its only memory — and the
ledger holds *outstanding* proposals, dropping a line the moment it is applied. So the sequence that mattered
was unprotected: apply `P2`, the owner corrects it to `P1`, and days later an unrelated re-scan re-derives
`P2` against a ledger that never knew. The safety case this whole loosening rests on did not hold for the one
act it was written about.

The fix is **structural first, remembered second**, and the owner chose both halves on 2026-09-22:

- **A missing `priority:*` may be set. An existing one may never be changed** — not behind the gate, not with
  evidence. If the refiner derives that an existing priority is wrong it comments its reasoning and stops.
- **A value it did set is checked against the issue timeline** before it would ever be set again.

The first half is what makes this safe rather than merely careful: the moment any hand touches a priority the
label exists, and an existing label is out of reach whatever any record says. A ledger that is lost, truncated
or garbled cannot make it fail open. A memory-based fix — a permanent "do not touch" list in the ledger — was
considered and rejected for exactly that: its failure direction is *unsafe*, because a forgotten entry means
the refiner overwrites the owner, and it would have made the ledger store a plan, which the gate above forbids
for the same reason.

Under #153 one GitHub account serves every agent and the owner, so `author_association: OWNER` proves nothing
and a comment saying "no" could have been written by any run. This is survivable **only** because every
authority the refiner holds fails safe under forgery: a forged objection stops a change from happening, and
there is no approval it can be tricked into granting, because it has none to give. A `REFINE: YES` marker —
anything where a forged signal would cause an act rather than prevent one — was ruled out for that reason, and
the reasoning does not transfer to any other routine here.

## Why the epic's progress bar is GitHub's

An `epic` parent carries `- [ ] #<child>` lines and no number. GitHub counts them, renders the bar, and ticks
the box when the child closes. A count the refiner wrote would be correct until the moment it was not, and
would look identical either side of that moment — *something was absent and the absence was read as a pass*,
which `docs/WATCHDOG-PROMPT.md` opens by naming as this project's signature defect. Handing the count to the
thing that observes the closure removes the failure rather than guarding it.

## What this does not settle

- **Whether refining works.** The health report is there to answer that from numbers in a few weeks; if the
  P3 bucket does not shrink, the answer is that the intake is the problem and not the tidying.
- **The shared-account problem (#153).** This routes around it; it does not solve it.
- **Who watches the watchers.** The refiner's pulse is read by the watchdog and the watchdog's by the
  developer routine, so the loop is now four deep and still not closed: if everything stops at once, the
  silence reads as all-clear one level up. That cannot be fixed from inside this repo.
