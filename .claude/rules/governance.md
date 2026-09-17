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
- A PR touching a governance file states in one line whether it **tightens** the constraints on a run (a check,
  a rail, a rule, or describing behaviour that already exists — ordinary work) or **loosens** them (a
  constraint removed, a budget raised, a gate that no longer gates — owner-gated, never routine-merged). See
  the `open-pr` skill §6 for the full rule and worked examples.
- The review-block mechanism, in one line: a reviewer blocks a PR by marking it draft and posting a comment
  starting `REVIEW: CHANGES REQUESTED`; only its setter clears it with `REVIEW: CLEARED`, except under the
  stale-block adoption rule (#161) — see the `review-pr` skill for the full protocol.
- No agent ever writes an `OWNER: APPROVED` or `OWNER: REJECTED` marker, whatever the context.
