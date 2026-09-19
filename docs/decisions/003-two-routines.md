# 003 — Two routines: one develops, one reviews

**Status:** accepted — owner, in session, 2026-09-19. Follows `docs/decisions/001-one-home-per-rule.md` and
`docs/decisions/002-routine-prompt-is-flow-only.md`.

## Context

One scheduled routine did everything in each run: the limit check, set-up and three health checks, review and
QA of other runs' pull requests, a fix to a stalled blocked pull request, one item of development (sometimes
two), and the heartbeat. Three things followed from that:

- review and development shared one run's time, so a pull request that became ready could wait well past the
  next scheduled run when that run spent its time elsewhere;
- "no session reviews its own change" was a rule every run had to remember, not something the structure made
  true: the same run reviewed and then developed, and only its own memory of what it had opened kept the two
  apart;
- the prompt carried both flows, so every run read the half it would not use.

## Decision

1. **Two routines.** The **developer routine** keeps `docs/ROUTINE-PROMPT.md`, the same stored bootstrap, the
   same schedule (hourly, cron `37 */1 * * *`), the heartbeat in issue #62 and all the STEP 1 health checks. It
   never reviews and never merges. The **reviewer routine** reads `docs/REVIEWER-PROMPT.md`. It never develops.
2. **The reviewer is scheduled hourly too**, cron `17 * * * *` — forty minutes after the developer's, so most of
   what a developer run opens is ready by the time the reviewer starts. Its first act is a **cheap exit**: list
   the open pull requests and, if none is waiting, report "nothing to review" and stop before `npm ci`, so an
   empty run costs one API call. A pull request is **waiting** for the reviewer if (a) it is not a draft and has
   no `REVIEW:` verdict newer than its newest commit, or (b) it is blocked — a draft carrying a
   `REVIEW: CHANGES REQUESTED` comment — and has a commit, or a `Pushed <sha>, addressing …` comment, newer
   than that block. (b) is how a fixed pull request is looked at again without anyone undrafting it: the run
   reviews it from scratch under the #161 rule in the `review-pr` skill §6. A pull request the session opened
   or pushed to is never its own to review.
3. **The health checks and the heartbeat stay with the developer**: one pulse for the watchdog to read is
   enough, and the developer's own STEP 1 is what watches the reviewer (item 4).
4. **The review-queue alarm.** The developer's STEP 1 gains a fourth check. A pull request counts there as
   *waiting* if it has been in that state for more than 2 hours and is either not a draft with no `REVIEW:`
   comment, or blocked with a fix pushed since the block. More than three waiting means nobody is reviewing:
   the run sends the owner a push notification saying how many and which, and records the value in the
   heartbeat's `- review queue:` line either way. A session that finds it cannot send one says exactly that,
   in the snapshot and in its report, rather than skipping the alarm silently.
5. **Second item (#97), condition 1 reworded, purpose unchanged.** It was "no open pull request is waiting for
   a review this run could do", with a list of the pull requests a run was barred from. A developer run
   reviews nothing, so that no longer means anything. It is now "at most three pull requests are waiting for
   review" — the same count STEP 1 has already made. The purpose is what it was: do not add to a review queue
   that is not draining. It is still a condition, not a quota, and the other three conditions are untouched.

The procedures did not move: how to review is still the `review-pr` skill and how to open a pull request is
still the `open-pr` skill. Each prompt is the order of its own run.

## Considered and dropped: starting the reviewer from GitHub events

The first version of this decision (same day) started the reviewer from GitHub events, so that a pull request
was reviewed the moment it became ready. It was dropped before it ran:

- the routines form allows **one** GitHub trigger per routine, carrying **one** pull-request event with filter
  conditions under it. Two signals were needed — "a pull request became ready" and "a fix was pushed to a
  blocked pull request", which is a draft and so invisible to the first — and that meant either a `re-review`
  label added on every hand-over or two reviewer routines;
- GitHub events are capped per hour during the research preview and dropped, not queued, beyond the cap;
- whether a run is told which pull request started it is not documented;
- a burst of events on one pull request starts duplicate sessions.

A schedule has none of these problems, and the owner's hourly routine has run reliably. The cost accepted: a
pull request waits up to an hour, and the account runs 24 developer + 24 reviewer + 4 watchdog runs a day.

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

**(b) At claude.ai/code/routines:** new routine; the same repository and the same environment as the developer
routine; paste the bootstrap above as its prompt; schedule it hourly, then set the cron to `17 * * * *` — with
`/schedule update` if the form only offers presets. **No GitHub trigger.**

**(c) The developer routine: nothing to paste.** Its stored bootstrap already reads `docs/ROUTINE-PROMPT.md`
from the heading "## The routine", and neither the file name nor that heading changed. Its schedule is
unchanged.

## Known limits

- **The daily run cap is not shown anywhere the owner could find.** 52 runs a day (24 developer, 24 reviewer,
  4 watchdog) is more than the 28 that are known to work. If runs start being refused, the developer heartbeat
  goes stale and the watchdog reports it.
- **A pull request waits up to an hour** for its review, and a fix to a blocked one up to an hour more.
- **That a cloud routine run can send the owner a push notification** is his first-hand experience; the public
  documentation does not cover it. Hence the rule that a session which cannot send one says so.
- **The watchdog still runs on its own schedule** and its check 4 still flags a pull request open for too
  long, so a reviewer routine that is not running is reported from two directions.
- A review that runs longer than an hour overlaps the next reviewer run. STEP 2 tells a run to check that a pull
  request is still waiting before it starts on it and again before it gives a verdict; two runs that pick the same
  one up within moments of each other can still both review it. That costs a run, not correctness: the second
  merge fails, and a second verdict is only a duplicate comment.
