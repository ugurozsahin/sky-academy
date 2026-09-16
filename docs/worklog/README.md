# Worklog archive — closed 2026-09-10 (#98)

Two files, and nothing appends to either again:

| file | covers |
|---|---|
| `2026-09.md` | 2026-09-06 → 2026-09-07 (rotated by hand at 94.8 KB, after a run died on the token limit reading it) |
| `2026-09-07-to-10.md` | 2026-09-07 → 2026-09-10 (54.9 KB, the file this archive closed) |

They are kept because they are the record of the project's first week and read as history. They are **not** a
place to write to, and nothing in the repository reads them.

## Why it stopped

The file had twelve-plus writers a day and zero readers *by rule* — `CLAUDE.md` said "nothing reads it",
`docs/ROUTINE-PROMPT.md` STEP 1 said "do not read it" — while growing ~17 KB a day with no rotation logic
anywhere. The one rotation that ever happened was manual, and it happened because the file had already killed
a run. At 55 KB it was about three days from doing it again.

Most of what it held was a narrative copy of something recorded better elsewhere. The one part that had no
other home — the run's operational checks — moved into the `routine: heartbeat` issue body, which is
fixed-size and overwritten every run.

## Where a record goes now

The test for any record is **who opens this, and when?** If there is no answer, do not write it. The routing
is in `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md`, and the short version is:

| what | where |
|---|---|
| a change and why, including what was deliberately not done | the pull request body |
| a decision that binds future work | the issue it came from, or `docs/decisions/` |
| operational state — last run, each check and its verdict | the `routine: heartbeat` issue body, overwritten |
| history — what happened, when, in what order | `git log` and the pull request list |

`tests/unit/guardrails.test.ts` fails if `WORKLOG.md` comes back to the repository root, or if a live
instruction starts telling a run to write to it again. Habits survive their own rename (#89), which is why
that is a check rather than a note.
