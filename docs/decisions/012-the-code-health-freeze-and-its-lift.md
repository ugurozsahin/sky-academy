# 012 — The code-health freeze ended on 2026-09-10, and its lift does not re-arm

**Status:** accepted — owner, 2026-09-10, recorded on issue #36. Written as a backfill by #636 (#322 row 1):
it records a decision already taken and changes no behaviour.

## Context

From 2026-09-06 the owner held a **code-health freeze**: while any issue labelled `review` or `debt` was open,
no feature work started. The 6 September code review had filed a batch of refactors (issue #36 is the first),
and refactors move code around, so features written first would have conflicted with them.

He lifted it once every such issue was closed — the last four on 2026-09-10. The freeze was worded as a
*condition* ("while any issue labelled `review` or `debt` is open"), and the process kept re-arming it every
time a run filed a new finding about itself. That is why the wording that replaced it says, in as many words,
that the lift is a one-time event.

The history was then copied into four live files: `CLAUDE.md`, `docs/ROUTINE-PROMPT.md`,
`docs/WATCHDOG-PROMPT.md` (check 5) and `.claude/rules/governance.md`, about 2.5 KB in all, two of them at
their byte budget. A run acts on none of it except the lift itself.

## Decision

1. **The freeze is over, permanently.** A `review` or `debt` issue filed from now on does not re-impose it, and
   no run reinstates one on its own: declaring a freeze is the owner's. Work is chosen by the priority labels,
   with no blanket bar on features.
2. **What made it work stays.** Review and QA by a different agent, the guard rails and budgets that only go
   down were never part of the bar; only the bar on feature work is gone.
3. **No issue carries the retired `frozen` label again.** Enforced in code by a `PreToolUse` hook in
   `.claude/settings.json` that denies an `issue_write` whose `labels` include `frozen`
   (`.claude/rules/governance.md` names it). `frozen` is not a way to park work; `later` is.
4. **Only the sentence a run acts on stays inline.** `CLAUDE.md` and `docs/ROUTINE-PROMPT.md` keep the
   lifted-freeze statement (a rail in `tests/unit/governance.test.ts` pins both); `docs/WATCHDOG-PROMPT.md`
   check 5 keeps its two successor questions. The dates, the reason and the history live here.

## Considered and dropped

- **Leave the history in all four files.** Rejected: pure history, copied four times, and the only rule it
  still yields is item 3, which is already a hook.
- **Keep the freeze as a condition that lapses by itself.** Rejected, and the reason it ended in this form:
  a condition tied to "an issue is open" re-arms the first time a run files a `review` issue.
- **Park work with a `frozen` label.** Rejected and retired by item 3; `later` is the parking label.

## Consequences

- A reader who asks why the freeze existed, or why it cannot return by itself, follows the pointer here; a run
  never needs to.
- The four files carry a pointer or nothing, and the debt line in `.claude/rules/governance.md` no longer
  lists the freeze history as a copied paragraph.
- Reinstating a freeze would be the owner's act and would rewrite `CLAUDE.md` and `docs/ROUTINE-PROMPT.md`
  together; the rail going red on that is it working.
