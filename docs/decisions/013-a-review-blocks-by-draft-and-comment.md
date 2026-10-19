# 013 — A review blocks by draft and comment, because a formal review is refused

**Status:** accepted — a backfill by #637 (#322 row 2) of the mechanism #88, #161 and #191 built. It records
decisions already taken and changes no behaviour; the grounds for using a block and the round cap are
`docs/decisions/004-what-a-review-block-is-for.md`.

## Context

Every agent and the owner act through one GitHub account (#153), so every pull request here looks
self-authored. GitHub refuses a formal `CHANGES_REQUESTED` review when reviewer and author are the same
account, so an empty reviews list means nothing and the platform's own "changes requested" state is never
available. A block had to be built from what that account can do: mark a pull request a draft and comment.

## Decision

1. **A reviewer blocks by marking the pull request a draft and posting a comment that begins
   `REVIEW: CHANGES REQUESTED`** (#88). `review-gate` goes red while the block stands.
2. **Only its setter clears it**, with `REVIEW: CLEARED` and "Ready for review", which re-runs CI. Pushing a
   fix does not clear it, and nobody undrafts to get past one.
3. **A block its reviewer leaves unanswered is superseded by a fresh review** (#161): a later run's, never a
   session that opened or pushed to the pull request. A block never expires by itself. `review-pr` §6 has the
   rule; this record does not restate it.
4. **Every marker comment carries its session URL** (#189, #191), since one account serves everyone and the
   URL is the only thing that tells a later run which session spoke.

## Considered and dropped

- **A formal `CHANGES_REQUESTED` review.** Refused by GitHub (HTTP 422) for a shared author and reviewer.
- **A second account for reviews.** Not available: one token serves every agent and the owner, by design.
- **A comment without the draft.** A draft also stops the merge button being offered, so the block shows on
  the pull request itself rather than only in `review-gate`.

## Consequences

- The mechanism a run performs (draft, comment, clear, supersede) stays inline in `CLAUDE.md`,
  `docs/REVIEWER-PROMPT.md` rule 3 and `review-pr` §6, where a run reads it. Only the reason lives here.
- `review-pr` §5 keeps "an empty reviews list means nothing" for the reviewer; the 422 behind it is here.
- The time a block may stand and how many rounds it may run are not decided here: see 004.
