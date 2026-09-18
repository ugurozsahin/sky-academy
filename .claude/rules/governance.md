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

- **Each rule has one home; every other file points at it** (`docs/decisions/001-one-home-per-rule.md`, which
  replaces the three-file rule and #216 §1's enforcement bar). Removing a duplicate is ordinary work as long
  as the home still carries the rule. Four paragraphs are still copied into `CLAUDE.md`, `BACKLOG.md` and
  `docs/ROUTINE-PROMPT.md` — the freeze history, records-have-readers, the #161 adoption conditions, the #97
  second-item conditions. That is debt: until a paragraph is reduced to its home, change its copies together,
  which `tests/unit/guardrails.test.ts` still checks.
- **A `REVIEW: CLEARED` comment that is itself a #161 adoption carries its own session URL too (#191)** — the
  same footer every comment carries (#199), so a later reader is not left guessing which session cleared a
  stale block from an unmarked comment. Enforced in code: `hasSessionUrl()` inside `scripts/review-gate.mjs`'s
  `blockState()` flags an adoption-clear that has none (`#191`/`#195`) — that is what makes this the one
  #161-family rule collapsible under #216 §1's bar. `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md`
  each carry a pointer here instead of restating it.
- **The run's heartbeat snapshot (issue #62) must say whether it took a second item and, if not, which of the
  four #97 eligibility conditions failed (#239).** Enforced in code: a `PreToolUse` hook in
  `.claude/settings.json` denies an `issue_write` update to issue #62 whose body has no `- second item: `
  line — that is what makes this one piece of the #97 rule collapsible under #216 §1's bar, the same way
  #191's session-URL requirement was. The four eligibility conditions themselves (is a review waiting, is
  there time left in the run, are the second item's files disjoint from the first's, did the first item
  actually finish) have no such enforcement yet — nothing stops a run from taking an ineligible second item,
  only from failing to say so — so they stay triplicated in `CLAUDE.md`, `BACKLOG.md` and
  `docs/ROUTINE-PROMPT.md` until each individually earns the same bar. `BACKLOG.md` and
  `docs/ROUTINE-PROMPT.md` (the two of the three that stated this recording obligation) each carry a pointer
  here instead of restating it.
- **The routine heartbeat (issue #62) must be overwritten each run, never appended to (records have readers,
  #98).** Enforced in code: a `PreToolUse` hook in `.claude/settings.json` denies an `issue_write` update to
  issue #62 whose body carries two or more of the heartbeat's own `YYYY-MM-DDTHH:MMZ — ` summary lines — the
  structural signature of a new summary tacked onto the old one instead of replacing it. **This is not a
  collapse like the two bullets above**: records-have-readers
  spans several kinds of record (the PR body, an issue or `docs/decisions/`, `git log`), of which this hook
  covers only the one instruction a run still needs to see inline while it is running STEP 5 — the same reason
  the `- second item:` line above stays inline rather than collapsing to a bare pointer. `CLAUDE.md`,
  `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` keep "overwritten every run, never appended" verbatim; only this
  bullet is new. What the hook cannot catch: an append that drops or reformats the previous summary's leading
  timestamp before concatenating, or one that appends a second paragraph with no bare timestamp of its own —
  both need a diff-aware check against the previous body, which this PR does not attempt.
- **The code-health freeze (2026-09-06 → 2026-09-10).** The owner held it while any issue labelled `review` or
  `debt` was open, so the 6 September code review's refactors could land *before* feature work resumed —
  refactors move code around, and features written first would have conflicted with them. He lifted it once
  every such issue was closed (the last four on 2026-09-10); the decision is recorded on issue #36. What made
  it work — review/QA by a different agent, the guard rails, budgets that only go down — stays; only the
  blanket bar on feature work is gone, permanently: the lift does not re-arm on a future `review`/`debt` issue.
- **No issue ever carries the retired `frozen` label again (#101).** Enforced in code: a `PreToolUse` hook in
  `.claude/settings.json` denies an `issue_write` create or update whose `labels` include `frozen` — the one
  actionable rule the freeze's history leaves behind, since "no run reinstates a freeze on its own" has no
  other concrete action to catch. That is what makes this one piece of the freeze-history rule collapsible
  under #216 §1's bar, the same way #191's session-URL requirement and the #97 recording obligation were. The
  freeze's broader one-time-lift narrative above (the dates, the reasoning, "does not re-arm") has no such
  enforcement point — nothing stops a run from *arguing* a class of work should be barred again, only from
  applying this one label — so that narrative stays triplicated in `CLAUDE.md`, `BACKLOG.md` and
  `docs/ROUTINE-PROMPT.md` until it, too, earns real enforcement. `BACKLOG.md` and `docs/ROUTINE-PROMPT.md`
  (the two of the three that ever mentioned the retired label) each carry a pointer here instead of restating
  it.
- **CANON's two mechanical conditions (age of the block, silence of its setter — the figures themselves live
  only in `docs/ROUTINE-PROMPT.md` STEP 2, never restated here or anywhere under `.claude/`, per the rail two
  bullets below) now have real enforcement.** `canAdoptNow()` in `scripts/adoption-check.mjs` — deliberately
  NOT in `scripts/review-gate.mjs`, which must never read a clock (see the guard rail two bullets below: a
  block that ages itself out on every CI re-run is #74 again) — is wired to a `PreToolUse` hook in
  `.claude/settings.json`: before an agent's comment matching `isAdoptionClear()` (the same litmus test
  `blockState()` already uses for "claims to adopt another reviewer's block", not a new heuristic) is allowed
  to post, the hook fetches the pull request's live comments from the GitHub API and denies the write unless
  both conditions hold right now. Conditions 3 and 4 — re-deriving the original objection, and the clearing
  comment's own wording — are a judgment call no function can make, so they stay the reviewing agent's
  responsibility exactly as `docs/ROUTINE-PROMPT.md` STEP 2 already asks. If the GitHub API call fails for any
  reason the hook denies rather than allows — a deliberate departure from this file's other `mcp__github__`
  hooks' fail-open `jq` pattern, because failing open here would let a stale block clear with nobody able to
  verify it should have. Not a triplication collapse: the CANON paragraph still needs reading by an agent
  doing the judgment-call half, so `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` are untouched by
  this.
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
