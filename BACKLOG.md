# Backlog — moved to GitHub Issues (2026-09-06)

The backlog now lives in **GitHub Issues**: https://github.com/ugurozsahin/sky-academy/issues

- **Order**: issue **#46 "📌 Priority order (owner-maintained)"** is the single ordered list. The owner reorders it; Claude works top-down.
- **Labels**: `priority:P1/P2/P3`, `owner-input` (needs the owner's art/decision), `routine-ok` (the hourly routine may take it), `later` (parked), plus area labels (`mode`, `curriculum`, `art`, `reward`, `platform`, `playtest`, `review`, `perf`, `debt`, `tests`).
- Label `frozen` = parked by the freeze; never start one, whatever its priority.
- **Freeze (owner, 2026-09-06):** no new feature work while any issue labelled `review` or `debt` is open. Still allowed: finishing open PRs, `playtest` bugs, anything that makes the game unplayable or `main` red, and whatever the owner asks for in a session. See the two sections in #46. (Same wording in CLAUDE.md and docs/ROUTINE-PROMPT.md — change all three together.)
- **Guard rails**: `tests/unit/guardrails.test.ts` and the `guard rail:` e2e tests turn past incidents into failing checks. Budgets go down, never up.
- **Workflow** (minimum scrum, in every issue): Refine → Develop (agent A, branch `claude/issue-<n>` or the run's assigned push branch, PR titled `(#<n>)` with `Closes #<n>` in the body — `Part of #<n>` instead when part of the issue is deferred, or GitHub closes it early) → Review (a *different* agent) → QA (the reviewer, full e2e + screenshots) → Owner action → Done (merged, WORKLOG, issue closed; the artifact publisher task republishes on its own schedule).
- The 2026-09-06 code review findings are issues #26–#45 (label `review`).
- Seed/bookkeeping: `scripts/issues-seed.json`, `scripts/seed-issues.py`, `scripts/issues-created.json`.

Everything that was in the old tables (v0.1–v0.5 Done rows included) is preserved in git history: `git show a2cb98c:BACKLOG.md`.
