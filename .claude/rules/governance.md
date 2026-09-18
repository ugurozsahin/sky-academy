---
paths:
  - "CLAUDE.md"
  - "BACKLOG.md"
  - "docs/ROUTINE-PROMPT.md"
  - "docs/WATCHDOG-PROMPT.md"
  - ".github/**"
  - ".claude/**"
---

# Governance files (#101)

- The three-file rule: `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` carry identical wording for the
  freeze history, records-have-readers, the stale-block adoption rule (#161) and the second-item rule (#97) —
  change all three together. A rail in `tests/unit/guardrails.test.ts` holds them to it.
- **The code-health freeze (2026-09-06 → 2026-09-10).** The owner held it while any issue labelled `review` or
  `debt` was open, so the 6 September code review's refactors could land *before* feature work resumed —
  refactors move code around, and features written first would have conflicted with them. He lifted it once
  every such issue was closed (the last four on 2026-09-10); the decision is recorded on issue #36. What made
  it work — review/QA by a different agent, the guard rails, budgets that only go down — stays; only the
  blanket bar on feature work is gone, permanently: the lift does not re-arm on a future `review`/`debt` issue.
- A PR touching a governance file states in one line whether it **tightens** the constraints on a run (a check,
  a rail, a rule, or describing behaviour that already exists — ordinary work) or **loosens** them (a
  constraint removed, a budget raised, a gate that no longer gates — owner-gated, never routine-merged). See
  the `open-pr` skill §6 for the full rule and worked examples.
- The review-block mechanism, in one line: a reviewer blocks a PR by marking it draft and posting a comment
  starting `REVIEW: CHANGES REQUESTED`; only its setter clears it with `REVIEW: CLEARED`, except under the
  stale-block adoption rule (#161) — see the `review-pr` skill for the full protocol.
- No agent ever writes an `OWNER: APPROVED` or `OWNER: REJECTED` marker, whatever the context.
- **The three ordering tools (agreed with the owner, 2026-09-11).** The project board is a read-only view, not
  a second list — `docs/ROUTINE-PROMPT.md` STEP 1 has why a cloud session cannot write to it. The owner
  reorders work with three things, all set on the issue itself: **`priority:P0`** means now — two or three
  cards at most, oldest first within it (`docs/ROUTINE-PROMPT.md` STEP 3 rule 5); **`Blocked by #<n>` as the
  first line of the issue body, plus the `blocked` label**, means after that one — STEP 3 rule 2 already skips
  an issue blocked by an open issue it references, and the label is what puts the card in the board's Blocked
  column, coming off by hand once the blocker closes; **`later`** means not yet, the parking label. There is
  no hand order inside a priority — oldest issue number first, full stop — which is acceptable because the
  routine merges roughly fifteen PRs a day, so a `priority:P1` bucket drains in a day or two, not a week.
