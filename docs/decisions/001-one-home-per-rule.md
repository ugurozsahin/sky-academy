# 001 — One home per rule

**Status:** accepted — owner, in session, 2026-09-19. Supersedes #216 §1 (2026-09-17).

## Context

Rules for the agents were kept in identical wording in `CLAUDE.md`, `BACKLOG.md` and
`docs/ROUTINE-PROMPT.md` ("the three-file rule"), with tests holding the copies in sync. #216 §1 then decided
a copy could be removed only once that rule had runtime enforcement in code.

Measured on 2026-09-18, after #101 ("context by layer") closed:

- what a routine run loads before its first useful action went from about 42 KB to about 72 KB, not down;
- #101 took 15 pull requests in two days, ten of them written to clear the §1 bar — 266 KB of tests and
  9.6 KB of inline hook code, to remove three short paragraphs;
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
   `tests/unit/instructions.test.ts` fails on a pointer to a path that does not exist.
5. **Tests do not pin instruction wording.** A test checks behaviour or structure. A test that fails when a
   sentence is rephrased is what stopped these files shrinking, and is removed as its paragraph is moved.

Loosening a constraint on a run — removing a rule, not a copy of it — is still the owner's decision.

## Consequences

- The copies that exist today are debt, not policy: the freeze history, records-have-readers, the #161
  adoption conditions and the #97 second-item conditions. Until each is reduced to its home and pointers, the
  tests that hold its copies identical stay, so a half-edited copy cannot contradict the others.
- `BACKLOG.md` retires (#218); what it still uniquely holds moves to `.claude/rules/governance.md`.
- The byte budgets are reset downwards after each reduction, never upwards.
- This work is done in sessions with the owner, not by the routine, until he says otherwise (2026-09-18).
