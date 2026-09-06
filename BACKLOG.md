# Backlog — moved to GitHub Issues (2026-09-06)

The backlog now lives in **GitHub Issues**: https://github.com/ugurozsahin/sky-academy/issues

- **Order**: issue **#46 "📌 Priority order (owner-maintained)"** is the single ordered list. The owner reorders it; Claude works top-down.
- **Labels**: `priority:P1/P2/P3`, `owner-input` (needs the owner's art/decision), `routine-ok` (the hourly routine may take it), `later` (parked), plus area labels (`mode`, `curriculum`, `art`, `reward`, `platform`, `playtest`, `review`, `perf`, `debt`, `tests`).
- **Workflow** (minimum scrum, in every issue): Refine → Develop (agent A, branch `claude/issue-<n>`, PR `Closes #<n>`) → Review (a *different* agent) → QA (the reviewer, full e2e + screenshots) → Owner action → Done (merged, WORKLOG, artifact republished, issue closed).
- The 2026-09-06 code review findings are issues #26–#45 (label `review`).
- Seed/bookkeeping: `scripts/issues-seed.json`, `scripts/seed-issues.py`, `scripts/issues-created.json`.

Everything that was in the old tables (v0.1–v0.5 Done rows included) is preserved in git history: `git show a2cb98c:BACKLOG.md`.
