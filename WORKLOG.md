# Worklog

**Nothing reads this file.** It is a write-only record: a run appends a short entry so a human can read back
what happened and why, and then never opens it again. It used to be the handoff between runs, from before the
backlog moved to GitHub Issues — by 2026-09-07 it had reached 95 KB and ~24,000 tokens, every run read all of
it at STEP 1, and a run finally died on the token limit doing so. An unbounded thing that every run must
consume is the same failure this project has hit in five other places.

Everything a run actually needs is somewhere bounded:

| what a run needs | where it is |
|---|---|
| what to work on next | issue #46, the owner's ordered list |
| what is already in flight | the open pull requests |
| why a change was made the way it was | that PR's description and its review comments |
| what happened when | `git log`, and the PRs it references |
| whether the routine is alive | the `routine: heartbeat` issue (the watchdog reads it) |
| whether the watchdog is alive | the `watchdog: heartbeat` issue (the routine reads it) |

Older entries are archived per month under `docs/worklog/`. Archive the current month and start a fresh file
whenever this one passes ~40 KB; nothing depends on its contents, so archiving can never break a run.

<!-- Entries below, newest at the bottom. Keep them short: PRs reviewed/merged, item developed + PR link,
     tests, guard-rail budgets changed. Anything a future run must act on belongs in an issue, not here. -->
