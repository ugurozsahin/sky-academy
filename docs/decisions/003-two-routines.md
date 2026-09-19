# 003 — Two routines: one develops, one reviews

**Status:** accepted — owner, in session, 2026-09-19. Follows `docs/decisions/001-one-home-per-rule.md` and
`docs/decisions/002-routine-prompt-is-flow-only.md`.

## Context

One scheduled routine did everything in each run: the limit check, set-up and three health checks, review and
QA of other runs' pull requests, a fix to a stalled blocked pull request, one item of development (sometimes
two), and the heartbeat. Three things followed from that:

- a pull request that became ready waited for the next scheduled run — up to an hour — before anyone looked,
  and longer when that run spent its time elsewhere;
- "no session reviews its own change" was a rule every run had to remember, not something the structure made
  true: the same run reviewed and then developed, and only its own memory of what it had opened kept the two
  apart;
- the prompt carried both flows, so every run read the half it would not use.

## Decision

1. **Two routines.** The **developer routine** keeps `docs/ROUTINE-PROMPT.md`, the same stored bootstrap, the
   same schedule (hourly, cron `37 */1 * * *`), the heartbeat in issue #62 and all the STEP 1 health checks. It
   never reviews and never merges. The **reviewer routine** reads `docs/REVIEWER-PROMPT.md`. It never develops.
2. **The reviewer is started by GitHub events, not a schedule**, with two triggers: a pull request that is
   not a draft is opened, marked "Ready for review" or pushed to; and a pull request is given the label
   `re-review`. A pull request is reviewed when it becomes ready, not when the next run comes round.
3. **The health checks and the heartbeat stay with the developer**, because they need a schedule: an
   event-triggered routine that never fires cannot notice that it never fired.
4. **The review-queue alarm.** The developer's STEP 1 gains a fourth check. A pull request is *waiting* if it
   has been in that state for more than 2 hours and is either not a draft with no `REVIEW:` comment, or
   labelled `re-review`. More than three waiting means nobody is reviewing: the run sends the owner a push
   notification saying how many and which, and records the value in the heartbeat's `- review queue:` line
   either way. Cloud routine runs can send the owner a push notification — his first-hand experience; the
   public documentation does not cover it — and a session that finds it cannot says exactly that, in the
   snapshot and in its report, rather than skipping the alarm silently.
5. **Second item (#97), condition 1 reworded, purpose unchanged.** It was "no open pull request is waiting for
   a review this run could do", with a list of the pull requests a run was barred from. A developer run
   reviews nothing, so that no longer means anything. It is now "at most three pull requests are waiting for
   review" — the same count STEP 1 has already made. The purpose is what it was: do not add to a review queue
   that is not draining. It is still a condition, not a quota, and the other three conditions are untouched.
6. **The `re-review` label.** A blocked pull request is a draft, and a push to a draft starts nothing. Nobody
   but a reviewer may undraft it or clear the block, so without another signal a fixed pull request would sit
   blocked for ever: the developer cannot clear it, and the reviewer is never started. Whoever pushes the fix
   (the developer's STEP 2.5, or the author) adds `re-review`; that starts a reviewer run, which removes the
   label as it begins — so the label always means "nobody has picked this up yet" — and reviews from scratch
   under the #161 rule in the `review-pr` skill §6.

The procedures did not move: how to review is still the `review-pr` skill and how to open a pull request is
still the `open-pr` skill. Each prompt is the order of its own run.

## Set-up the owner does once

**(a) The reviewer bootstrap.** Identical to the developer's except "autonomous reviewer" and the file name:

```
You are the autonomous reviewer for "Sky Ninja Academy" (repo ugurozsahin/sky-academy). The repo is cloned for you.

1. `git pull --ff-only` on main.
2. Read `docs/REVIEWER-PROMPT.md` and follow everything from "## The routine" onwards. That file is the source of
   truth for this run: it changes between runs, so read it every time and never work from memory of an earlier one.
3. If it is missing or unreadable, do nothing else: say so in your report, commit nothing, and stop.

Speak Turkish in any summary for the owner; code, comments and game text in British English.
```

**(b) At claude.ai/code/routines:**

1. New routine; the same repository and the same environment as the developer routine; paste the bootstrap
   above as its prompt; **no schedule**.
2. Add two triggers, each a "GitHub event" on this repository. A trigger can carry several pull-request
   actions, but its filters apply to all of them at once, which is why it takes two (names as the form showed
   them on 2026-09-19):

   | Trigger | Events to pick | Filter |
   | --- | --- | --- |
   | 1 — a pull request is waiting | **Ready for review**, **Opened**, **Commits pushed** | Is draft = false |
   | 2 — a blocked pull request was fixed | **Labeled** | Labels include `re-review` |

   "Ready for review" is the hand-over: the author marks the PR ready once CI is green. A blocked pull request
   is a draft, so trigger 1 never sees a fix pushed to it; the `re-review` label is what does. Do **not** pick
   "All pull request events" — every label, assignment and edit would start a run — and leave "Closed" out, so
   merging a pull request starts nothing.
3. The Claude GitHub App must be installed on the repository, or no event arrives.
4. The label `re-review` exists in the repository (created 2026-09-19).

**(c) The developer routine: nothing to paste.** Its stored bootstrap already reads `docs/ROUTINE-PROMPT.md`
from the heading "## The routine", and neither the file name nor that heading changed. Its schedule is
unchanged.

## Known limits

- **GitHub events are capped per hour during the research preview, and events beyond the cap are dropped**,
  not queued. A dropped event is a pull request nobody was started for. The review-queue alarm is the net
  under that — and the fallback in the reviewer's STEP 2 means any later reviewer run can sweep up what was
  missed.
- **Whether a run is told which pull request started it is not documented.** Hence the fallback in STEP 2: a
  run that cannot tell reviews every waiting pull request, in priority order.
- **Two events close together start two reviewer sessions**, each on its own pull request. If both fall back
  to the full list they can meet on the same one; the `re-review` label being removed on pick-up and the
  `REVIEW:` comments are what a second session sees.
- **The watchdog still runs on its own schedule** and its check 4 still flags a pull request open for too
  long, so a reviewer routine that never fires is reported from two directions.
- Several events can arrive for one pull request within seconds (opened, ready for review, a push), and each
  starts its own session. STEP 2 tells a run to stop when the pull request is closed or a verdict newer than its
  newest commit already stands; two sessions that start at the same moment can still both review it. That costs
  a run, not correctness: the second merge fails, and a second verdict is only a duplicate comment.
