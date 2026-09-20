---
paths:
  - "CLAUDE.md"
  - "docs/ROUTINE-PROMPT.md"
  - "docs/REVIEWER-PROMPT.md"
  - "docs/WATCHDOG-PROMPT.md"
  - ".github/**"
  - ".claude/**"
---

# Governance files (#101)

- **Each rule has one home; every other file points at it** (`docs/decisions/001-one-home-per-rule.md`, which
  replaces the three-file rule and #216 §1's enforcement bar). Removing a duplicate is ordinary work as long
  as the home still carries the rule. Two paragraphs are still copied into `CLAUDE.md` and
  `docs/ROUTINE-PROMPT.md` — the freeze history and records-have-readers (the #97 second-item conditions went to their home, the developer prompt, with #145). That is debt: until a paragraph is reduced to its home, change its copies together,
  which `tests/unit/guardrails.test.ts` still checks. **While this reduction is under way it is done in
  sessions with the owner** (issues labelled `owner-session`), not by the routine; removing a rule rather than
  a copy, or removing any other rail, is still a loosening under the `open-pr` skill §6.
- **A `REVIEW: CLEARED` comment that supersedes another reviewer's block (#161)
  carries its own session URL too (#191)** — the same footer every comment carries (#199), so a later reader
  is not left guessing which session cleared a stale block from an unmarked comment. Enforced in code: `hasSessionUrl()` inside `scripts/review-gate.mjs`'s
  `blockState()` flags such a clear that has none (`#191`/`#195`). The `review-pr` skill §6, the home of the
  #161 rule, says so where a reviewer reads it.
- **The run's heartbeat snapshot (issue #62) must say whether it took a second item and, if not, which of the
  four #97 eligibility conditions failed (#239).** Enforced in code: a `PreToolUse` hook in
  `.claude/settings.json` denies an `issue_write` update to issue #62 whose body has no `- second item: `
  line. The four eligibility conditions themselves (are more than three reviews waiting, is
  there time left in the run, are the second item's files disjoint from the first's, did the first item
  actually finish) have no such enforcement yet — nothing stops a run from taking an ineligible second item,
  only from failing to say so. Their home is `docs/ROUTINE-PROMPT.md` STEP 3; `CLAUDE.md` points there. `docs/ROUTINE-PROMPT.md` carries a pointer here for the
  recording obligation instead of restating it.
- **The routine heartbeat (issue #62) must be overwritten each run, never appended to (records have readers,
  #98).** Enforced in code: a `PreToolUse` hook in `.claude/settings.json` denies an `issue_write` update to
  issue #62 whose body carries two or more of the heartbeat's own `YYYY-MM-DDTHH:MMZ — ` summary lines — the
  structural signature of a new summary tacked onto the old one instead of replacing it. **This is not a
  collapse like the two bullets above**: records-have-readers
  spans several kinds of record (the PR body, an issue or `docs/decisions/`, `git log`), of which this hook
  covers only the one instruction a run still needs to see inline while it is running STEP 5 — the same reason
  the `- second item:` line above stays inline rather than collapsing to a bare pointer. `CLAUDE.md`
  and `docs/ROUTINE-PROMPT.md` keep "overwritten every run, never appended" verbatim; only this
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
  other concrete action to catch. The
  freeze's broader one-time-lift narrative above (the dates, the reasoning, "does not re-arm") has no such
  enforcement point — nothing stops a run from *arguing* a class of work should be barred again, only from
  applying this one label — and that narrative is still copied in `CLAUDE.md` and
  `docs/ROUTINE-PROMPT.md` (debt, first bullet). `docs/ROUTINE-PROMPT.md` carries a pointer here instead of
  restating it. **`frozen` is not a way to park work — `later` is.**
- **When a decision needs a `docs/decisions/` record and not just an issue.** The record-routing rule offers
  "the issue, or `docs/decisions/NNN-title.md`" and gives no test for choosing, so everything drifted to the
  issue — and `docs/decisions/001-one-home-per-rule.md` §1 already assigns *why a rule exists, and its history* here. The test:
  **write the ADR when the decision binds work beyond the issue that prompted it, or when a real alternative
  was rejected.** A decision that settles one issue's scope belongs on that issue. One that changes how every
  future run behaves — what may block a pull request, what a run records, where a rule lives — belongs in
  `docs/decisions/`, **with the alternatives that were dropped and why**, because the next person to propose
  one of them will otherwise argue it from scratch. The pull request body says what changed and the rail says
  what is pinned; neither survives as the answer to "why this and not that". Written after 2026-09-19, when
  two decisions of exactly that kind were recorded only in pull request bodies: the review-block bar and round
  cap (#305/PR #306), now `docs/decisions/004-what-a-review-block-is-for.md`, and the run pulse (#314/PR #315),
  now `docs/decisions/005-the-run-pulse-says-when-a-run-started.md`. **The number is claimed by the pull
  request, and nothing reserves it**: those two were written concurrently and each picked its own number
  without seeing the other. Take the next free number at the moment you write the file, and if an open pull
  request has already claimed it, renumber yours rather than the other way round — a merged record's number is
  the one pointers are written against. Every record is pointed at by a live instruction file, which
  `tests/unit/instructions.test.ts` checks (#98).
- A PR touching a governance file states in one line whether it **tightens** the constraints on a run (a check,
  a rail, a rule, or describing behaviour that already exists — ordinary work) or **loosens** them (a
  constraint removed, a budget raised, a gate that no longer gates — owner-gated, never routine-merged). See
  the `open-pr` skill §6 for the full rule and worked examples.
- The review-block mechanism, in one line: a reviewer blocks a PR by marking it draft and posting a comment
  starting `REVIEW: CHANGES REQUESTED`; only its setter clears it with `REVIEW: CLEARED`, or a later run's
  fresh review supersedes it (#161) — see the `review-pr` skill for the full protocol.
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
- **The labels (#218 moved the list here).** `priority:P0`/`P1`/`P2`/`P3` — P0 outranks P1,
  the ordering `docs/ROUTINE-PROMPT.md` STEP 3 and `scripts/board-sync.mjs`'s `PRIORITIES` array both use;
  `routine-ok` (the developer routine may take it); `owner-session` (changed only in a session with the owner —
  the routine never takes it); `owner-input` (needs the owner's art or decision); `owner-approval` (on a pull
  request: holds the merge until the owner writes his marker — for a genuinely new look only); `loosening` (on
  a governance pull request that loosens a constraint: the same hold, #112); `later` (parked
  by the owner); `blocked` (cannot move until another issue or a decision lands — it is what puts a card in
  the board's Blocked column, #87); `new-ui` (gates the `frontend-design` skill, #99); `watchdog` (opened by
  the watchdog); and the area labels `mode`, `curriculum`, `art`, `reward`, `platform`, `playtest`, `review`,
  `perf`, `debt`, `tests`, `guard-rail`, `accessibility`.
  **Default priority when filing (owner, 2026-09-19):** work a player would notice is `priority:P2`; a finding
  about a rail, a test or a prompt is `priority:P3`. Hardening findings arrive daily, and at the same priority
  as the game they queue ahead of whatever game issue is filed after them. This has no such enforcement — it
  is a convention for whoever files an issue, and the owner re-orders by label as before.
