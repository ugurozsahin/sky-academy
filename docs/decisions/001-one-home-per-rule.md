# 001 — One home per rule

**Status:** accepted — owner, in session, 2026-09-19. Supersedes #216 §1 (2026-09-17).

## Context

Rules for the agents were kept in identical wording in `CLAUDE.md`, `BACKLOG.md` and
`docs/ROUTINE-PROMPT.md` ("the three-file rule"), with tests holding the copies in sync. #216 §1 then decided
a copy could be removed only once that rule had runtime enforcement in code.

Measured on 2026-09-18, after #101 ("context by layer") closed:

- what a routine run loads before its first useful action went from about 42 KB to about 72 KB, not down;
- #101 took 15 pull requests in two days and added 83 KB to `tests/unit/guardrails.test.ts`; the six written
  to clear the §1 bar added 31 KB of that, plus a script and 9.6 KB of inline hook code, to remove three short
  paragraphs. The file as a whole went from 76 KB to 342 KB between 2026-09-10 and 2026-09-18;
- the byte budgets on `CLAUDE.md` and the routine prompt sat at exactly the current size, and tests pinned
  paragraphs word for word, so neither file could get shorter.

Claude Code's own guidance (https://code.claude.com/docs/en/memory,
https://code.claude.com/docs/en/best-practices) is that long instruction files are followed less well, that
each line should pass "would removing this cause a mistake?", that procedure belongs in a skill and
path-specific rules in `.claude/rules/`, and that a rule which must hold every time should be a hook rather
than a sentence.

## Decision

1. **Each rule has one home**, chosen by when it is needed:
   - a fact every session needs → `CLAUDE.md`;
   - a rule about certain files → `.claude/rules/<topic>.md`, scoped by `paths:`;
   - a procedure (how to open a PR, how to review one) → a skill;
   - the order of a run's steps → `docs/ROUTINE-PROMPT.md`, `docs/WATCHDOG-PROMPT.md`;
   - why a rule exists, and its history → `docs/decisions/`.
2. **Every other file points at the home and does not restate the rule.**
3. **A rule that must hold every time becomes a check** — a hook wired in `.claude/settings.json`, a CI job,
   a test of behaviour — and its prose is then cut to the one line that says the check exists.
4. **Removing a duplicate is ordinary work**, not owner-gated, as long as the home still carries the rule.
   `tests/unit/instructions.test.ts` fails on a pointer to a file that does not exist; it cannot tell whether
   the file still says what the pointer promises, so the reviewer checks that.
5. **Tests do not pin the wording of a copied paragraph.** A test that holds copies identical, or fails when
   a sentence of one of them is rephrased, is what stopped these files shrinking; it is removed in the same
   change that reduces its paragraph to one home. New rails check behaviour or structure.

Everything else is unchanged and still the owner's decision under the `open-pr` skill §6: removing a rule
rather than a copy of it, and removing or weakening any other rail — including the rails that keep a skill
from being gutted.

## Consequences

- The copies that exist today are debt, not policy; `.claude/rules/governance.md` lists them. Until each is
  reduced to its home and pointers, the tests that hold its copies identical stay, so a half-edited copy cannot
  contradict the others.
- `BACKLOG.md` retires (#218); what it still uniquely holds moves to `.claude/rules/governance.md`.
- The byte budgets are reset downwards after each reduction, never upwards.
- This work is done in sessions with the owner, not by the routine, until he says otherwise (2026-09-18).
