# 007 — A pulse stamp is read from the clock, and checked against its own write

**Date:** 2026-09-21 · **Issue:** #439 (watchdog) · **Supersedes nothing**; extends
`005-the-run-pulse-says-when-a-run-started.md`, which introduced the stamp this record makes trustworthy.

## What happened

The watchdog read issue #435 (`reviewer: heartbeat`) twice, 21 seconds apart, at a real
`2026-09-21T11:05:10Z`. The body opened `2026-09-21T11:40Z`. GitHub's `updated_at` for that edit was
`2026-09-21T11:02:55Z` — the stamp written *inside* the body was **37 minutes ahead of the write that carried
it**, and ahead of the clock at which it was read. The developer routine's pulse at the same check was 2–3
minutes *behind* its write, which is what an honest stamp looks like: the clock is read, then the write lands
a moment later. Eight hours later the same routine stamped `12:47Z` against a real `12:38Z`, so it was not a
one-off.

## Why a wrong stamp is worse than a missing one

Every staleness check in this repo is the same arithmetic — `now - the timestamp written inside the pulse
body`. `docs/ROUTINE-PROMPT.md` STEP 1 does it for the watchdog's pulse and the board's, `docs/REVIEWER-PROMPT.md`
STEP 1 stamps one, and `docs/WATCHDOG-PROMPT.md` check 3 does it three times: for a stale snapshot, for an
`IN PROGRESS` stamp left by a run that never finished, and for the board sync. **None of them consulted
GitHub's `updated_at`.** The stamp was trusted absolutely and checked nowhere.

That makes the forward direction the dangerous one. A stamp ahead of the real clock makes `now - stamp`
artificially small — or negative — however long the run actually ran, or however long ago it died. A run that
stalled at a permission prompt an hour ago, holding an `IN PROGRESS` stamp 38 minutes in the future, reads as
comfortably inside the ~90-minute bar the watchdog applies. This is this project's signature failure (an
absence read as a pass) displaced one level down: not the pulse's absence, but its accuracy.

A stamp *behind* its write is the benign direction and stays unflagged. It makes a run look older than it is,
so a check errs toward raising a finding — the direction we want to be wrong in.

## The decision

**A pulse stamp is read from the system clock at the moment of writing, never computed, estimated or
remembered — and the watchdog checks it against the write GitHub recorded.**

Two halves, in one file (`scripts/pulse-stamp.mjs`) so they cannot come to disagree about the format:

- **Prevention.** `node scripts/pulse-stamp.mjs` prints the stamp. Its only source of a time is
  `new Date()`, so a run that calls it cannot produce one that is not now. All three prompts now say to take
  the stamp from it. This is the weaker half and we should be honest about why: nothing can *force* a run to
  run the command, and a prompt is an instruction, not a rail.
- **Detection.** `node scripts/pulse-stamp.mjs --check <body> <updated_at>` compares the stamp against the
  write and exits 1 when the stamp runs ahead by more than `AHEAD_TOLERANCE_MIN` (2 minutes, for skew between
  the session host's clock and GitHub's). `docs/WATCHDOG-PROMPT.md` check 3 runs it on all three pulses. This
  is the half that has teeth, because `updated_at` is the one field the writing run cannot author for itself.

`tests/unit/pulse-stamp.test.ts` holds both directions, with the incident's real numbers as a case.

## Alternatives rejected

1. **A `PreToolUse` hook that refuses a heartbeat write whose stamp is ahead of the server clock.** The
   strongest option, and the one the existing heartbeat rules use (`.claude/settings.json` already denies a
   body with no `- second item:` line). Rejected because **a routine run may not write under `.claude/`**
   (#342, `006-a-routine-never-writes-under-claude.md`): the hook is in a protected path, so no unattended
   run can add this one. It remains the right fix for a session with the owner, and is worth taking there.
2. **Stop trusting the stamp; read `updated_at` everywhere instead.** Tempting, and wrong for the
   `IN PROGRESS` stamp specifically: `005` makes that stamp say *when the run started*, while `updated_at`
   says when the edit landed — for the final snapshot they nearly coincide, for the opening stamp they must
   not. Replacing one with the other would quietly change what the pulse means, and lose the ~45-minute
   run-length signal `005` was written to preserve. The comparison keeps both numbers and asks that they
   agree in the right direction.
3. **Seconds in the stamp.** Rejected: the checks that read it work in hours, and a seconds field is false
   precision that invites the same estimation with two more digits of confidence.
4. **Flag a stamp that lags its write as well.** Rejected for now. Lag is the safe direction, and the honest
   lag is unbounded by design: STEP 1's stamp says when the run *started*, so by the time STEP 5 replaces it
   the run may legitimately be 45 minutes old. A bound would either be too loose to catch anything or would
   fire on correct runs, and a check that cries wolf on the safe direction is how the useful direction stops
   being read.
5. **Have the script write the pulse itself, over the API.** It would close the prevention gap properly, but
   it puts a network call and a token into a file that is currently pure and unit-tested in both directions,
   and it would have to know each pulse's title, body shape and hook rules. The stamp is the part that was
   wrong; widening the script to own the whole write is a larger change than the finding justifies.

## What this deliberately does not establish

That a run *ran* the command. A run can still type a stamp from memory, and the prompts cannot stop it —
which is exactly why the detection half exists and why it reads a field the run cannot write. The watchdog
will catch the next one within six hours instead of never.
