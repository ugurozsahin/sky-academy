# 011 — Instruction files are measured by structure, not only by bytes

**Status:** accepted, owner-released for routine work, 2026-09-27 (#624, split from the `#323` epic in an
owner session on 2026-09-24; the owner moved #624 from `owner-session` to `routine-ok` on 2026-09-27).
Supersedes nothing; records the reasoning behind the byte budgets `docs/decisions/001-one-home-per-rule.md`
introduced and explains why they are not, on their own, the whole rail.

## Context

`CLAUDE.md`, `docs/ROUTINE-PROMPT.md` and `docs/REVIEWER-PROMPT.md` each carry a byte budget
(`tests/unit/governance.test.ts`). #323 measured all five instruction files a session reads and found the
three budgeted files are also the three densest — long average lines, and one line in each running into the
thousands of characters — while the two without a budget are not:

| File | Non-empty lines | Avg line | Longest line | Byte budget? |
| --- | ---: | ---: | ---: | :---: |
| `docs/REVIEWER-PROMPT.md` | 19 | 526 | 2,948 | yes |
| `docs/ROUTINE-PROMPT.md` | 105 | 202 | 4,111 | yes |
| `CLAUDE.md` | 34 | 278 | 1,021 | yes |
| `docs/WATCHDOG-PROMPT.md` | 225 | 99 | 167 | no |
| `.claude/rules/governance.md` | 84 | 92 | 244 | no |

A byte budget prices every byte the same, so the cheapest way to add content under one is to compress a new
paragraph into an existing line rather than give it its own — the budget goes red on a genuine addition and
stays green on a line that quietly doubles in length. That is the shape #625 (the sibling issue, a longest-line
rail) exists to close; this record is the reasoning, not the rail.

Claude Code's own documentation says the same thing from the reading side, not just the writing side:
*"target under 200 lines per CLAUDE.md file"* (the unit is lines, not bytes) and *"Claude scans structure the
same way readers do: organized sections are easier to follow than dense paragraphs"*
(https://code.claude.com/docs/en/memory). Against that, *Effective context engineering for AI agents* is the
reason size still matters at all: *"as the number of tokens in the context window increases, the model's
ability to accurately recall information from that context decreases."* The two are not in tension — one says
why a file should stay small, the other why it should stay legible at whatever size it is — and a byte count
alone answers only the first.

## Decision

**A byte budget measures size; it does not measure structure, and an instruction file needs both.** The byte
budgets stay exactly as they are — `docs/ROUTINE-PROMPT.md` went 40,949 → 21,436 bytes under one, which is a
real reduction, not a number to explain away — but they are not read as a complete account of "is this file
well-formed." Structure gets its own rail where a cheap, mechanical one exists: #625 adds a longest-line cap
beside each byte budget, ratcheting down only, exactly as the byte budgets already do, so paying for an
addition by flattening a paragraph into one enormous line fails the build instead of passing it.

## Considered and dropped

- **Drop the byte budgets and measure lines instead.** Rejected: the byte budgets already did real, measured
  work (the 40,949 → 21,436 reduction above, and `CLAUDE.md`'s own history in
  `docs/decisions/001-one-home-per-rule.md`), and a line-count budget alone has the same blind spot in the
  other direction — it rewards fewer, longer lines exactly when the file is already too dense. Neither measure
  replaces the other; this decision is that both are kept, each catching what the other cannot.
- **Raise the byte budgets to make room for headroom against the longest-line rail.** Rejected: `#323` item 2
  (now #625) is explicit that with all three files sitting exactly at their current budget, a longest-line cap
  can only be satisfied by reformatting the offending lines, not by buying space — raising a budget to relieve
  that pressure would be the "raised to make a build pass" move every budget rail in this repository already
  refuses (`.claude/rules/guardrails.md`).
- **Put `docs/WATCHDOG-PROMPT.md` and `.claude/rules/*.md` under a byte budget too, since the table above shows
  them well-formed already.** Rejected for now: they are the model the three budgeted files are being
  reformatted towards, not files with the defect this record is about. Budgeting a file that is not yet a
  problem would import the failure mode (a number to satisfy) before there is any debt for it to measure.

## Consequences

- The byte budgets in `tests/unit/governance.test.ts` are unchanged by this record; it explains why they exist
  alongside a structural rail rather than instead of one.
- #625 (a longest-line cap per budgeted file) and the reformats that follow it are the enforcement; this ADR is
  why they were asked for, not a new rail itself.
- `docs/WATCHDOG-PROMPT.md` and `.claude/rules/governance.md` stay unbudgeted, on the reasoning above — a
  future PR that proposes budgeting one of them should show it has acquired the same density defect first.
