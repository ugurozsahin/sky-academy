# 014 — Records have readers: the test for any record is who opens it, and when

**Status:** accepted — owner, in session, 2026-09-10 (#98). Written as a backfill by #638 (#322 row 3); it
records a decision already taken and changes no behaviour. The routing table itself stays inline.

## Context

`WORKLOG.md` reached 51 KB on 2026-09-10, up from 1.5 KB on 2026-09-07: about 17 KB a day, twelve-plus
writers, and no reader *by rule* (`CLAUDE.md` said "nothing reads it"). The previous file had grown to 94.8 KB
and killed a run on the token limit. There was no rotation logic, and the one rotation was by hand. Most of
what it held was a narrative copy of things recorded better elsewhere: what changed and why is the pull
request, when is git history, what is in flight is the open PR list.

One part had no other home: the run's checks (was last night's CI on `main` green, how old is the watchdog
pulse, what was anomalous and deliberately not acted on). That moved to the `routine: heartbeat` issue, which
must be overwritten each run, because appending there would recreate the problem in a place that is read.

## Decision

**The test for any record is who opens this, and when. With no answer, do not write it.** Routing:

| What | Where |
| --- | --- |
| A change and why, including what was deliberately not done | the pull request body |
| A decision that binds future work | the issue it came from, or `docs/decisions/NNN-title.md` |
| Operational state | the `routine: heartbeat` issue body, overwritten every run, never appended |
| History | `git log` and the PR list |

`WORKLOG.md` is archived under `docs/worklog/` and nothing appends to it again. A note for the next run is not
a record; it is an issue. When a decision needs `docs/decisions/` and not just an issue is the test in
`.claude/rules/governance.md`.

## Considered and dropped

- **Rotate `WORKLOG.md` by script.** Rejected: it would keep a file with no reader and twelve writers.
- **Keep the paragraph word for word in both process files.** Rejected: a copied paragraph is debt. The
  routing a run consults while deciding where to write stays inline in each; the test's history is here.

## Consequences

- `CLAUDE.md` and `docs/ROUTINE-PROMPT.md` each carry the routing and the question, and point here for why.
- The heartbeat rule is enforced by a hook (`.claude/rules/governance.md`), the reason it is not a collapse.
- The last verbatim copy of this paragraph is gone, so `.claude/rules/governance.md` no longer lists it as debt.
