# 005 — The run pulse says when a run started, not only when one finished

**Status:** accepted — owner, in session, 2026-09-19. Amends the "Last, not first" rule in
`docs/ROUTINE-PROMPT.md` STEP 5 (#98). Implemented by #314 / PR #315.
**Extended to the reviewer routine — owner, in session, 2026-09-21 (#327).** Same decision, second routine;
the amendment is at the end of this file rather than in a record of its own, per
`docs/decisions/001-one-home-per-rule.md`.

## Context

Since #98 the `routine: heartbeat` issue (#62) is the routine's only record: `WORKLOG.md` is archived and
nothing writes it. STEP 5 rewrites that body as the **last** thing a run does, and the prompt said why in as
many words:

> **Last, not first.** A run that dies halfway must leave the *previous* run's stale pulse. Stamping on the
> way in hides exactly the deaths the pulse exists to expose.

That reasoning is correct and is the reason this decision amends the rule rather than dropping it.

What it did not consider is a run that neither finishes nor dies: one that **stops and waits for a human**.

On 2026-09-19 the developer routine went quiet between 20:33Z and 23:26Z. It had not crashed and had not hit
a limit. It was waiting at a Claude Code permission prompt, asking to edit `.claude/rules/governance.md` while
answering the review block on PR #294. The owner approved it by hand, at which point the run completed; he
confirmed earlier runs had failed to finish the same way. Established at the time:

- the prompt is not one of this repository's hooks — `.claude/hooks/io.mjs` exports exactly one decision,
  `deny`, and a hook can refuse a call but never queue it behind a person;
- there is nothing to fall through to — `.claude/settings.json` carries `hooks` and no `permissions` block,
  and the untracked settings.local.json beside it — gitignored, so it exists on the owner's Mac and in no
  clone — allows `Bash(gh issue *)` and nothing else. Deliberately not written here as a code span: it is not
  a path anything may follow, and `tests/unit/instructions.test.ts` resolves every one that is;
- the run left **nothing**: no commit, no comment, no pulse;
- the watchdog's 23:04Z pass read the 2h31m-old pulse as healthy, *"inside the ~3h stale bar, not a finding"* —
  correct by the rule as written;
- PR #294 sat blocked and unanswered for 7h33m as a result; #295 and #303 for hours more.

This is not an edge case in this repository. Most of the open queue is hardening work whose home is
`.claude/rules/`, `.claude/skills/` and `.claude/agents/`, so a run answering a review block on a governance
pull request meets the prompt nearly every time.

The deeper problem is that three states looked identical from outside: a run that **died**, a run that is
**busy** (runs here routinely take 45 minutes and overlap the hour), and a run that is **waiting for a human**.
A pulse written only at the end cannot tell them apart, and the third had no name at all.

## Decision

1. **STEP 1 stamps the pulse before the work**: the `routine: heartbeat` body becomes
   `<UTC> — IN PROGRESS: <what this run will do>` plus a `- second item: pending` line. STEP 5 replaces it
   with the finished snapshot exactly as before.
2. **The stamp is not a pass and must never read as one.** That is the whole of the amendment to "Last, not
   first", whose reasoning is kept: a *finished-looking* pulse written on the way in would hide the deaths the
   pulse exists to expose. A marker that cannot be mistaken for a finish does not.
3. **The watchdog reads it.** A stamp older than one interval plus slack — about 90 minutes at the hourly
   cadence — is a finding, and the finding **quotes the stamp's line**, because that line names what the run
   was about to do and is the only evidence such a run leaves. A fresh stamp is explicitly not a finding.
4. **Nothing is permitted by this.** No `permissions` block, no hook change, no change to how a run is
   launched.

The `- second item: pending` line is load-bearing, not decoration: `requiredLines()` in
`.claude/hooks/github-write-guard.mjs` denies any write to the pulse whose body lacks that line, so without it
the stamp would be refused and never land. (It was `secondItem()` until #359 collapsed the two mandatory
lines into one rule over one list.)

## Considered and dropped

- **Permit the edits instead — a `permissions.allow` block in `.claude/settings.json`.** ~~This is the actual
  fix for the *stall*~~ — **struck 2026-09-20 (#340): it is not a fix at all.** Allow rules are evaluated
  *after* the protected-path check, so the entry would have had no effect and would have looked like a
  remedy. The decision above remains the fix for the *blindness*; the fix for the stall is
  `docs/decisions/006-a-routine-never-writes-under-claude.md` — a run does not make the write. The owner's
  deferral (2026-09-19) — measure what really stops runs before deciding what to permit — was right for a
  better reason than the one recorded here at the time, and the measurement is what found this.
- **Run the routine in a mode that never prompts.** Simplest and widest: it would end the stalls tomorrow and
  leave the layer-0 hooks as the only defence. Not taken without the measurement above, and it would still
  have left a dead run and a busy run indistinguishable.
- **Leave "Last, not first" alone and have the watchdog infer a stall from the cron schedule.** Rejected: the
  watchdog cannot see a run that left nothing. It would be reasoning from absence — which this project has
  already ruled out elsewhere ("a check reports a pass by evidence, never by absence") — and it would still not
  know *what* the run was doing, which is the one thing that makes the finding actionable.
- **Write the stamp as a comment rather than a body edit.** Rejected: a comment notifies, and #98's whole
  point is that the pulse is silent; it would also reintroduce the append the hook exists to prevent.

## Consequences

- One extra API write per run, at the cheapest point in it.
- A stalled run becomes visible in ~90 minutes instead of never, and the finding says what it was doing.
- "Last, not first" now means specifically *no finished-looking pulse on the way in*. The rail in
  `tests/unit/governance.test.ts` (in `guardrails.test.ts` until #321 split it out) pins both halves — the stamp and the "not a pass" — because either alone
  decays into the other's failure.
- `ROUTINE_PROMPT_BUDGET` falls 21,503 → 21,436; the addition is paid for in prose, and three first attempts
  at paying hit text that rails pin word for word and were reverted.
- **Still open:** STEP 0's own limit record (`<UTC> — stopped: limit`) carries no `- second item:` line, so the
  same hook denies it on the MCP path — a run stopping on a limit still leaves nothing. And that hook matches
  `mcp__github__*` tools only, while STEP 1 tells runs to post authored bodies with the REST API, so the
  heartbeat rules are enforced on the path the prompt steers away from. Both recorded on #314.

## Amendment, 2026-09-21 (#327): the reviewer routine gets a pulse of its own

Everything above was written about the developer routine, and left the reviewer routine with **no trace of any
kind**. `docs/REVIEWER-PROMPT.md` STEP 0 said so in as many words — *"This routine has no heartbeat issue, so
post nothing half-finished"* — so a reviewer run that died at the token limit, stalled on a permission prompt,
or was killed mid-review left no commit, no comment and no pulse. The watchdog had nothing to read. It was the
only moving part in the project that nothing watched, and it merges pull requests.

**Decision.** The same three points, applied unchanged: STEP 1 stamps `<UTC> — IN PROGRESS: reviewing #<n>`
before the work; the finished snapshot replaces it last; the watchdog reads it as part of check 3, at the
reviewer's own cadence (`17 * * * *`, so the same hourly numbers). Two points are new, and both come from the
reviewer routine having a shape the developer routine does not:

1. **The cheap exit writes a pulse too — `<UTC> — nothing waiting`.** STEP 1 has a deliberate one-API-call
   exit when no pull request is waiting, and an idle reviewer is the common case. Left silent, "idle" and
   "dead" would look identical from the watchdog, which is the whole blindness this record is about. It costs
   a second API call on a cheap run, and that is the price of the fix.
2. **Two pulses, not one shared issue.** Rejected: one body with two writers, and the developer's
   `- second item:` shape (#97) does not fit a routine that has no second item. Separate issues make the
   record disciplines separable, which is what the hook now does — `heartbeatAppend` covers both pulses,
   because replace-never-append is the same rule for any of them, and `requiredLines` covers the developer's
   alone. Matching on **title** rather than number (#353) is what made that separation free: a reviewer pulse
   inherits nothing by construction, so nothing had to be untangled.

**Consequences.** One extra API write per reviewer run, two on an idle one. A stalled reviewer becomes visible
in ~90 minutes instead of never. `REVIEWER_PROMPT_BUDGET` falls 10,034 → 9,998; the additions are paid for in
prose, and one first attempt shortened STEP 2's priority order, which the #194 rail pins word for word, and was
reverted. #323 argues that paying for additions this way is what has been degrading these files, and it is
right; this landed first because it is `priority:P0` and #323 is `priority:P1`, which is a recorded exception
rather than a disagreement.

**Still open**, inherited unchanged from the developer side: the hook matches `mcp__github__*` only while
STEP 1 steers authored bodies to the REST API, so both pulses are enforced on the path the prompts steer away
from. And nothing obliges a run to replace `IN PROGRESS` with a real snapshot; the watchdog greps for it, which
is the check that catches a run that never did.
