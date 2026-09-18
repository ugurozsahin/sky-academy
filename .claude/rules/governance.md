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
  freeze history, records-have-readers, the stale-block adoption rule's four conditions (#161) and the
  second-item rule (#97) — change all three together. A rail in `tests/unit/guardrails.test.ts` holds them to
  it. **One exception (#216 §1):** #161's session-URL requirement (#191, below) has real code enforcement, so
  its prose lives here once, as a pointer from the three files, rather than triplicated like the rest — the
  other three rules stay triplicated until each individually earns the same bar.
- **A `REVIEW: CLEARED` comment that is itself a #161 adoption carries its own session URL too (#191)** — the
  same footer every comment carries (#199), so a later reader is not left guessing which session cleared a
  stale block from an unmarked comment. Enforced in code: `hasSessionUrl()` inside `scripts/review-gate.mjs`'s
  `blockState()` flags an adoption-clear that has none (`#191`/`#195`) — that is what makes this the one
  #161-family rule collapsible under #216 §1's bar. `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md`
  each carry a pointer here instead of restating it.
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
