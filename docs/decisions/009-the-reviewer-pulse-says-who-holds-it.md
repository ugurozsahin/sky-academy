# 009 — The reviewer pulse says who holds it, so a finish never erases a live run

**Status:** accepted, routine session, 2026-09-25 (#460). Amends `docs/REVIEWER-PROMPT.md` STEP 1's pulse
discipline; does not touch `docs/decisions/005-the-run-pulse-says-when-a-run-started.md`, which is why this is
a record of its own rather than an amendment there
(`docs/decisions/001-one-home-per-rule.md` §1).

## Context

`docs/decisions/005-the-run-pulse-says-when-a-run-started.md`'s reviewer amendment gave the reviewer routine
a single-tenant pulse: STEP 1 stamps
`<UTC> — IN PROGRESS: reviewing #<n>` on the way in and replaces it with the finished snapshot as the very
last thing a run does. That assumed one run at a time. On 2026-09-21 two were live together for 1h55m (#460's
evidence table: session `01ApUM…` blocked three pull requests between 13:20 and ~14:0x while session
`01UkLc…` stamped its own `IN PROGRESS: reviewing #430` at 14:57, inside that window). The older run declined
to write its own finished snapshot at all, because doing so — replacing the whole body, as STEP 1 says — would
have erased the younger run's still-live stamp, and with it the watchdog's only way to tell a live run from a
dead one for the next ~90 minutes.

Nothing in STEP 1 told either run the other existed. A run only reads the pulse to decide whether to stop
(nothing waiting) or stamp (something is); it never compares what it is about to write against what is already
there. **The class is every unconditional pulse replace, not only the one #460's evidence table caught**: STEP
1's "nothing waiting" cheap exit and STEP 0's `stopped: limit` write are the same shape — a run reaches one of
them, reads nothing, and overwrites — so a run finishing idle or hitting a limit can erase a concurrent run's
live stamp exactly as the finished-snapshot write could.

## Decision

**Every pulse replace but the `IN PROGRESS` stamp itself re-reads the pulse and compares only its header
line** (the first, timestamped line) **against the stamp this run itself wrote — never the whole body.** The
stamp is unchanged: it still always overwrites, because a fresh `IN PROGRESS` stamp is itself the "who holds
it" signal a later run reads, and overwriting it with a newer one of the same shape loses nothing.

Comparing the whole body, the first cut of this decision, does not survive its own success case. Run A stamps,
run B stamps over it (the header always overwrites), A finishes first and — correctly, seeing B's header, not
its own — appends `- also reviewed #<n>: <verdict>` under B's still-current header. That append changes the
*body* but not the *header line*. When B then finishes and re-reads, a whole-body compare sees a body that is
no longer byte-identical to what B wrote (A's line is now under it) and wrongly concludes a second run is
live — B, the sole remaining holder, appends a note instead of its real finished snapshot, and the header is
stuck reading `IN PROGRESS: reviewing #<n>` forever: a false stall the watchdog cannot tell from a dead run.
Comparing headers instead of bodies fixes this directly, because an append never touches the header line it
was appended under: B's re-read still shows its own header, so B correctly replaces — but the replace must
*keep* the lines already appended beneath that header (A's note) rather than discard them, or the fix only
moves the #460 erasure from "whichever run finishes second" to "whichever run finishes second under the
now-corrected rule". So a replace, in full, is: write the new header line, then every `- also reviewed
#<n>: <verdict>` line already under the old one, then this run's own `- #<n>: <verdict>` lines if any — all of
them unstamped, so STEP 1's "a second timestamped line is refused" rule is untouched.

If the header a run reads back is *not* the one it itself wrote (a different, still-fresh `IN PROGRESS` line,
or a finished snapshot newer than its own stamp), a second run is or was live, and this run does not touch the
existing body at all: it appends its own note — `- also reviewed #<n>: <verdict>` per pull request it
reviewed — to the body it just read.

**STEP 0's `stopped: limit` write is not a bare pointer at this discipline; it needs its own read.** The first
cut of this decision left STEP 0 saying only that it "inherits" STEP 1's rule, while STEP 0's own text — "that
is one API call... budget is running out mid-run, so the record must be cheap" — told a run under real
pressure it could skip straight to a single overwrite, which is the exact erasure this decision exists to
close, in the run most likely to coincide with a second live one. STEP 0 now reads "one read and write, no
merge" instead, naming the header check as part of that one cheap step rather than an optional second one.

**Round 2 (PR #704 review): the check has nothing to compare against in either branch that fires before this
run has stamped anything of its own.** Both STEP 1's "nothing waiting" cheap exit and STEP 0's `stopped: limit`
write can happen before this run ever writes its own `IN PROGRESS` header — a run with an empty PR list, or one
that hits a limit during setup, has no "stamp this run wrote" to compare the pulse's current header against.
The first cut's wording only covered the finished-snapshot write, where that stamp always exists. The rule now
reads: replace when the header is unchanged from this run's own stamp **or no other run's stamp is currently
live** — the second disjunct is what lets an unstamped run tell "safe to write" from "another run holds this"
without ever having stamped itself. The append payload for that case was also undefined before now: a run with
no PR verdict to report had nothing to write under `- also reviewed:` line beneath a live stamp it found. STEP
1 now names both shapes directly — `nothing waiting (N open, 0 waiting)` and `stopped: limit — <what>` — so
`- also reviewed: nothing waiting (N open, 0 waiting)` or `- also reviewed: stopped: limit — <what>` is what
either branch appends when a second run's stamp is live.

A run at STEP 1 already reads the pulse before deciding whether to stop or stamp; that existing read is what
now lets it "tell... that another reviewer run is live before it starts a pull request" (#460's acceptance
criterion) — a fresh `IN PROGRESS` stamp under the ~90-minute watchdog window is exactly that tell, and this
decision's only job is to stop the finished write from erasing it before the next run gets to see it.

**Round 3 (PR #704 review): "no other's live" had no age threshold in `docs/REVIEWER-PROMPT.md` itself, only
in this ADR's own aside above.** A run under STEP 0's own time pressure, comparing a genuinely live but
long-running stamp (rule 4 sets no depth limit on a review) against nothing, could read it as dead and erase it
— reproducing the very erasure this decision exists to close, through the disjunct round 2 added specifically
to cover the unstamped case. STEP 1 now reads "no other's live (under ~90min old)" inline, so the number a run
has to judge a stamp against is in the file it actually follows at runtime, not only in this record.

**Round 4 (PR #704 review): "no other's live" tested only the header's age, never its shape, so a completed
finished-snapshot header read as "live" for as long as it was merely recent.** Trace the routine's own hourly
cadence with a single reviewer session, no overlap at all: run k finishes idle, replaces the header with its
`nothing waiting (N open, 0 waiting)` snapshot. Run k+1, an hour later, has stamped nothing of its own; the
header is 60 minutes old, under the ~90-minute threshold, so the age-only test reads it as "another's live" and
appends instead of replacing — even though the run that wrote it finished an hour ago and no longer exists. The
header then only advances on whichever run happens to catch it stale enough, drifting up to ~2 hours out of
date for the one reader (the watchdog) this mechanism exists to serve, while `- also reviewed:` lines
accumulate forever — the exact unbounded growth this decision was written to prevent, caused by a false
positive rather than genuine concurrency. STEP 1 now reads "no other's live `IN PROGRESS:` (under ~90min old)":
the comparison is keyed on the header actually being an `IN PROGRESS:` stamp, not merely a recent one, so a
finished write of any shape (`nothing waiting`, `stopped: limit`, or a finished snapshot) never counts as
"another's live" regardless of its age.

**Round 5 (PR #704 review, round 5, then a live owner session the same day): the ~90-minute age threshold**
**round 3 gave the shape check round 4 added is too tight, because rule 4 sets no depth limit on a review and**
**#460's own evidence records a real review spanning close to two hours.** A run genuinely still reviewing a
pull request past 90 minutes is permitted behaviour, not a bug — and a second run reaching STEP 0's
`stopped: limit` write before it has stamped anything of its own has no way to tell that apart from a stamp
abandoned 90 minutes ago. Read literally, it erases the live run's header anyway, reproducing this decision's
own opening failure through the one clause meant to close it. The number was borrowed from
`docs/WATCHDOG-PROMPT.md`'s own threshold for *flagging* a stuck `IN PROGRESS` stamp as a finding for a human to
look at — a use where a false positive costs nothing, since a person just checks and moves on. Reused here to
decide whether to *overwrite shared state autonomously*, the same false positive is irreversible: the live run's
header is gone before it ever gets to finish.

An automated review round's own first fix for this dropped age from the comparison entirely — treating another
run's `IN PROGRESS:` stamp as always live, regardless of age, and only ever appended to — reasoning that no
finite age is ever *provably* safe given rule 4's "no time box on depth." Put to the owner directly in the same
session: that traded a rare, never-observed risk (a live review outlasting the threshold at the exact moment a
second run hits `stopped: limit` with no stamp of its own) for a certain, common one — a run that genuinely dies
mid-review, with no clean shutdown, would then leave a stamp nothing ever replaces again, requiring manual
intervention every time rather than the ordinary hourly cadence eventually recovering on its own. The owner's
call: keep the recovery property, raise the number instead of removing it — **150 minutes**, comfortably above
the ~115-minute duration #460's evidence actually recorded, revisit if a real case is ever hit. So the
comparison keeps an age term: **an `IN PROGRESS:` stamp that is not this run's own is live under ~150 minutes
old** — append instead of replacing — **and no longer live past that** — replaces normally, the same as a
header that is not an `IN PROGRESS:` stamp at all (round 4's shape check, unchanged). The ordinary single-session
hourly case keeps advancing exactly as round 4 fixed it, and a genuinely dead run's stamp still recovers on its
own within 150 minutes rather than needing a human to notice `docs/WATCHDOG-PROMPT.md`'s stuck-`IN PROGRESS`
finding and act on it.

This is alternative 1 of the three #460 proposed: the pulse names who holds it, cheaply, without a lock, a
label or a slowed cadence.

## Considered and dropped

- **Lease the pull request, not the routine** (#460's second alternative): before starting a pull request, a
  run records a claim keyed on the PR number, and a second run skips a fresh claim. This also closes the
  round-budget half of #460 (two runs blocking the same PR at different rounds) that the chosen fix does not
  touch. Dropped for now, not because it is wrong: it is a second, independent mechanism (a claim per PR,
  rather than a claim on the one shared pulse), and #460's own acceptance criterion only asks that a run "can
  tell from the pulse that another reviewer run is live before it starts a pull request" — which the chosen
  fix already gives it, at a third of the surface area. Worth its own issue if the round-budget collision
  recurs.
- **Slow the trigger to match the work** (`17 */2 * * *`): one line, no code. Dropped on #460's own reasoning,
  unchanged here: it halves review throughput, the wrong direction while pull requests are open and waiting,
  and it does not fix the underlying blindness — two runs 2h10m apart instead of 1h55m can still overlap on a
  review that runs long, which #460's own evidence shows happens routinely.
- **Qualify the never-append rule for every pulse, not just this one case.** Dropped: `heartbeatAppend` in
  `.claude/hooks/github-write-guard.mjs` already permits any number of non-timestamped lines under one
  timestamped summary line — the developer pulse's `- second item:`/`- query top pick:` lines are exactly
  that shape. The `- also reviewed:` line above needs no hook change: it is not a second timestamped line, so
  `heartbeatAppend`'s existing check (denies at two `SUMMARY_LINE` matches) never sees it. Writing a new rule
  for it would duplicate one that already does the job.

## Consequences

- A run's finished write no longer risks erasing a second run's live stamp or its own finished snapshot; the
  older run's results are preserved as `- also reviewed:` lines under the younger run's record instead of
  vanishing.
- The pulse can carry more than one run's results after an overlap, which is new: a reader (the watchdog, the
  next run, the owner) sees every `- also reviewed:` line as well as the summary line, rather than only ever
  the most recent writer's account.
- Still open, inherited from #460: this does not prevent two runs from reviewing the *same* pull request
  concurrently, only from destroying each other's pulse record when they do. The round-budget collision
  (`review-pr` §7) is unchanged.
- **Still open, new here:** `scripts/pulse-stamp.mjs` truncates to the minute, so two runs stamping in the same
  UTC minute produce byte-identical headers — neither can then tell "unchanged because I still hold it" from
  "identical by coincidence, someone else does now", and the header check silently takes the first reading.
  Narrow (it needs two runs racing to the same minute, on top of #194's ordering already making them pick the
  same PR), and not fixed here.
- **Still open, new here:** a run that skips the re-read (or whose read is a stale/cached copy of its own
  prior write) produces a body byte-identical to one that checked correctly — nothing attests that the
  comparison happened, the same limit #460 itself names for its own claim comment ("not airtight"). This is a
  prose discipline, not a lock; a genuinely airtight version would need the pulse issue itself to carry a
  compare-and-swap primitive GitHub's API does not offer.
- **New in round 5:** the age threshold moved from ~90 to ~150 minutes, an owner call rather than a derivation —
  chosen to sit comfortably above the ~115-minute duration #460's own evidence recorded, not from any proof
  that 150 is itself safe against rule 4's "no time box on depth." A live review that ever ran longer than that
  would still have its stamp erased by a concurrent `stopped: limit` write with no stamp of its own; nothing in
  this repository's history says that has happened, and the owner's instruction on finding one is "revisit it
  then," not to remove the age term pre-emptively.
- `REVIEWER_PROMPT_BUDGET` is paid in `docs/REVIEWER-PROMPT.md` itself; the PR that lands this records the
  before/after byte count.
