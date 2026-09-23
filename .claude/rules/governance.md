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
- **An unattended run never writes under `.claude/` (#342).** Not a preference — a platform constraint.
  `.claude/` is a Claude Code **protected path**, like `.git/`: a write there is never auto-approved, and no
  routine setting changes it. `permissions.allow` does not reach protected paths, a cloud session cannot use
  `bypassPermissions`, `defaultMode` is ignored there, and a routine has no permission-mode picker at all
  (#340 has the documentation trail). What a run meets instead is a prompt nobody is there to answer, and the
  approval that prompt offers is scoped to **that session**, so it never carries to the next scheduled run:
  PR #294 stalled 7h33m and PR #318 overnight, both on this very file.
  `docs/decisions/006-a-routine-never-writes-under-claude.md` has the documentation trail and the five
  alternatives ruled out. Enforced in code, on the three routes a write can take, all asking one shared
  question — `protectedKind()` in `.claude/hooks/paths.mjs`, so no two of them can come to disagree about
  which paths count, the `.claude` directory itself and the marker included. The routes: `claudeDir()` in
  `.claude/hooks/write-guard.mjs` for the `Write` and `Edit` tools; `claudeWrite()` in
  `.claude/hooks/bash-guard.mjs` for the shell, so `sed -i` on this file is refused as surely as an `Edit` of
  it (#346); and `filePath()` in `.claude/hooks/github-write-guard.mjs` for
  `mcp__github__create_or_update_file`, `push_files` and `delete_file`, which commit a path straight to a
  branch and so would land the same edit on the remote. None of them will bring the marker into existence,
  `touch .owner-machine` included. The shell rule judges a target **by its spelling as well as by where it
  lands**, because nothing tracks `cd`; which tools it reads as writing is the lists in `bash-guard.mjs`, not
  restated here, since a copy of them would drift. **What no command-line rule sees**, and no guard claims to:
  a script that opens the file itself (`python3 - <<EOF`, `node -e`), a target assembled at run time
  (`$DIR/settings.json`), a working directory changed to a computed path, or a tool absent from those lists —
  `git apply`, `patch`, `ed` and `rsync` among them. The marker is a switch, not a seal — the
  seal is that a routine has no reason to be writing here at
  all. `PreToolUse` runs before the permission system, so the call is refused in milliseconds rather than
  waiting hours for a person. **Reads are untouched**: a tool only counts in command position, so `cat`,
  a `grep` whose *pattern* is `touch`, `git diff` and a `.claude/` path as the *source* of a copy all pass. What a run does
  instead: say on the issue what needed changing here and why, label it `owner-session`, take the next item.
  The owner's own checkout carries the marker; he creates it by hand, once, and nothing else does.
  That is the same answer the bullet below already gives for the one-home reduction; this makes it true of
  everything under `.claude/`, and enforces it.
- **A `REVIEW: CLEARED` comment that supersedes another reviewer's block (#161)
  carries its own session URL too (#191)** — the same footer every comment carries (#199), so a later reader
  is not left guessing which session cleared a stale block from an unmarked comment. Enforced in code: `hasSessionUrl()` inside `scripts/review-gate.mjs`'s
  `blockState()` flags such a clear that has none (`#191`/`#195`). The `review-pr` skill §6, the home of the
  #161 rule, says so where a reviewer reads it.
- **The run's heartbeat snapshot (issue #62) must say whether it took a second item and, if not, which of the
  four #97 eligibility conditions failed (#239).** Enforced in code: a `PreToolUse` hook in
  `.claude/settings.json` denies an `issue_write` create or update to the heartbeat whose body has no
  `- second item: ` line. It finds the heartbeat by **title** — `routine: heartbeat` — falling back to the
  number for an update that carries none, because STEP 5 tells a run to recreate the issue if it is gone and a
  recreated one carries a new number (#353); issue #62 is the one it has today. The four eligibility conditions
  themselves (are more than three reviews waiting, is
  there time left in the run, are the second item's files disjoint from the first's, did the first item
  actually finish) have no such enforcement yet — nothing stops a run from taking an ineligible second item,
  only from failing to say so. Their home is `docs/ROUTINE-PROMPT.md` STEP 3; `CLAUDE.md` points there. `docs/ROUTINE-PROMPT.md` carries a pointer here for the
  recording obligation instead of restating it.
- **A run that develops anything other than the issue its query named says so, and says which documented way
  past the order it used (#338).** STEP 3's query is meant to be mechanical: two runs reading the same repo
  state pick the same issue. On 2026-09-20 a run developed #20 while the query named #18, and the only bridge
  between the query and the pick was the run's own comment reasoning that #18 was parked on the owner — which
  `CLAUDE.md` does not accept as evidence, `owner-input` being the label that would have said it mechanically.
  **No rule needed relaxing: STEP 3 already forbade it.** What was missing was a record — nothing obliged the
  run to say it had departed from the query at all, which is why it took a watchdog run reconstructing the
  query at a past moment to notice. So the obligation is symmetrical with `- second item:` above, and for the
  same reason: the pull request body names the issue the query returned and which of the three documented ways
  it took (a `playtest` label or an unplayable game, the owner's own words on the issue, an open `watchdog`
  issue), and the heartbeat carries a `- query top pick: ` line saying the same. Enforced in code for the
  heartbeat half only: the same `PreToolUse` hook denies an `issue_write` create or update to the heartbeat
  whose body has no such line. The two mandatory lines are **one rule over one list** since #359 — a third line
  is an entry in that list, not a third copied rule, and a body missing both is refused once, naming both,
  rather than denied twice for the same write.
  What the hook cannot catch, the same gap `- second item:` has: it reads
  that the line is *there*, never that the issue named is the one the query would return or that the way past
  the order was really available — both are the reviewer's, against the query re-run on the current state. The
  pull request half has no enforcement at all; a rail would have to re-run the query from CI, which would make
  the build depend on live issue state. **And the hook matches `mcp__github__*` only**, while STEP 1 steers
  authored bodies to the REST API (#207), so it is enforced on the path the prompt steers away from — the
  same bypass `docs/decisions/005-the-run-pulse-says-when-a-run-started.md` records for `- second item:`.
  The `method: 'create'` exemption these lines used to carry is closed (#353): STEP 5 permits a create for a
  heartbeat that does not exist, so the one write that establishes a fresh pulse was the one escaping every
  body rule, and a create carries the title the hook now matches on. **One gap is left, true of both lines:
  the STEP 1 sentinel satisfies them forever** — nothing obliges STEP 5 to replace `pending` with a real value,
  and the watchdog greps for `IN PROGRESS`, never for these lines. That one is still the reviewer's to catch;
  pinning it needs a rule about what STEP 5 must replace, not about which write the hook watches, and that is
  a decision rather than a patch. Their home is `docs/ROUTINE-PROMPT.md` STEP 3.
- **The routine heartbeat (issue #62) must be overwritten each run, never appended to (records have readers,
  #98).** Enforced in code: a `PreToolUse` hook in `.claude/settings.json` denies an `issue_write` create or
  update to the heartbeat (issue #62 today, or whatever number carries its title — #353) whose body carries
  two or more of the heartbeat's own `YYYY-MM-DDTHH:MMZ — ` summary lines — the
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
  **Two of the three are no longer his alone (#512, owner 2026-09-22).** The refiner routine
  (`docs/REFINER-PROMPT.md`) may set `priority:*` and `blocked` — never `later` — but only behind a one-day
  gate: it proposes today, re-derives the proposal from the repo tomorrow, and applies it then. That is a
  **loosening** under the `open-pr` skill §6 and was gated as one. The rule it relaxes existed to stop a run
  promoting its own work, and it does not reach a routine that opens no pull request and so has nothing to
  promote itself into; `docs/decisions/008-the-backlog-is-refined-by-a-routine.md` has the reasoning, the
  alternatives dropped, and why a forged objection is survivable here when a forged approval would not be.
- **The labels (#218 moved the list here).** `priority:P0`/`P1`/`P2`/`P3` — P0 outranks P1,
  the ordering `docs/ROUTINE-PROMPT.md` STEP 3 and `scripts/board-sync.mjs`'s `PRIORITIES` array both use;
  `routine-ok` (the developer routine may take it); `owner-session` (changed only in a session with the owner —
  the routine never takes it); `owner-input` (needs the owner's art or decision); `owner-approval` (on a pull
  request: holds the merge until the owner writes his marker — for a genuinely new look only); `loosening` (on
  a governance pull request that loosens a constraint: the same hold, #112); `later` (parked
  by the owner); `blocked` (cannot move until another issue or a decision lands — it is what puts a card in
  the board's Blocked column, #87); `new-ui` (gates the `frontend-design` skill, #99); `watchdog` (opened by
  the watchdog); `complexity:S`/`M`/`L`/`XL` (how big the work is, not how long it takes — the refiner sets it
  and splits `L` and `XL`, #512); `epic` (split into sub-issues: `docs/ROUTINE-PROMPT.md` STEP 3 rule 1 drops
  it, so a run takes the children and never the parent, and the parent's `- [ ] #<child>` lines are counted by
  GitHub rather than by any agent); `refine-hold` (the refiner never touches this issue again — the owner's
  standing exemption from it); and the area labels `mode`, `curriculum`, `art`, `reward`, `platform`, `playtest`, `review`,
  `perf`, `debt`, `tests`, `guard-rail`, `accessibility`.
  **Default priority when filing (owner, 2026-09-19):** work a player would notice is `priority:P2`; a finding
  about a rail, a test or a prompt is `priority:P3`. Hardening findings arrive daily, and at the same priority
  as the game they queue ahead of whatever game issue is filed after them. This has no such enforcement — it
  is a convention for whoever files an issue, and the owner re-orders by label as before.
