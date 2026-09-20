# 005 — The run pulse says when a run started, not only when one finished

**Status:** accepted — owner, in session, 2026-09-19. Amends the "Last, not first" rule in
`docs/ROUTINE-PROMPT.md` STEP 5 (#98). Implemented by #314 / PR #315.

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

The `- second item: pending` line is load-bearing, not decoration: `secondItem()` in
`.claude/hooks/github-write-guard.mjs` denies any update to issue #62 whose body lacks that line, so without it
the stamp would be refused and never land.

## Considered and dropped

- **Permit the edits instead — a `permissions.allow` block in `.claude/settings.json`.** This is the actual
  fix for the *stall*; the decision above is the fix for the *blindness*. The owner deliberately deferred it
  (2026-09-19): measure what really stops runs, and how often, before deciding what to permit. Writing an
  allow-list from one incident would have guessed at the list. Revisit once the stamp has produced data.
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
  `tests/unit/guardrails.test.ts` pins both halves — the stamp and the "not a pass" — because either alone
  decays into the other's failure.
- `ROUTINE_PROMPT_BUDGET` falls 21,503 → 21,436; the addition is paid for in prose, and three first attempts
  at paying hit text that rails pin word for word and were reverted.
- **Still open:** STEP 0's own limit record (`<UTC> — stopped: limit`) carries no `- second item:` line, so the
  same hook denies it on the MCP path — a run stopping on a limit still leaves nothing. And that hook matches
  `mcp__github__*` tools only, while STEP 1 tells runs to post authored bodies with the REST API, so the
  heartbeat rules are enforced on the path the prompt steers away from. Both recorded on #314.
