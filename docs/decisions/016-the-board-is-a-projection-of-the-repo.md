# 016 — The project board is a projection of the repo, written from the owner's Mac

**Status:** accepted — owner, 2026-09; a backfill by #640 (#322 row 5) of the arrangement commit `1d7fe5d1` (PR #197, which names
the issue as #158) and #87 built.
It records a decision already taken and changes no behaviour.

## Context

The owner wanted the backlog on a project board (Projects v2). A cloud session cannot touch it: Projects v2 is
GraphQL-only, and the cloud GitHub proxy answers that API with 403 whatever token the session holds. The
backlog itself is GitHub Issues, with labels (`priority:*`, `blocked`, `later`) as the order.

The explanation was copied into four live files (`CLAUDE.md`, `docs/ROUTINE-PROMPT.md`, `.claude/rules/governance.md`,
`docs/WATCHDOG-PROMPT.md`). A run acts on none of it except "do not touch the board".

## Decision

1. **The board is a projection of the repo, never a second list.** Nothing is edited in two places: to move a
   card, change the label or the pull request, never the card.
2. **One writer: `scripts/board-sync.mjs`, run on the owner's Mac** every 15 minutes by a launchd agent
   (`scripts/board-sync.plist`). Its token lives in `.git/github-project-token`, beside and never inside
   `.git/github-credentials` (the credential file is the owner's, for Claude sessions to pull and push, and is
   never unset).
3. **No routine runs the sync.** A cloud session cannot reach the board, so it neither syncs nor reads it.
4. **The sync leaves a pulse** in the open issue `board: heartbeat` (label `watchdog`), rewritten with a UTC
   timestamp at least hourly (#87). A run reads the pulse in STEP 1; the watchdog's check 8 reads it too, and
   a timestamp older than about two hours is a finding for the owner.
5. **Only what a run acts on stays inline**: the instruction not to edit the card, that no routine runs the
   sync, where the token sits, and how to read the pulse. The reason a cloud session cannot write, and the
   cadence and launchd arrangement, live here.

## Considered and dropped

- **Run the sync from a cloud routine.** Impossible: the proxy blocks the GraphQL endpoint.
- **Let runs move cards by hand.** Rejected: a second place to edit means the card and the label disagree, and
  the label is what the routines read.
- **Keep the board token in the git credentials file.** Rejected: that file is the Mac-side session's
  pull/push credential, and the board token is a separate, expiring classic PAT with its own file.

## Consequences

- A reader who asks why a routine cannot write the board follows the pointer here; a run never needs to.
- A dead sync shows as an old or missing pulse, not as an error: the pulse is the only evidence a cloud session
  can read, which is why it is kept inline in STEP 1 and in the watchdog.
