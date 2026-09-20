# 006 — A routine never writes under `.claude/`

**Status:** accepted — owner, in session, 2026-09-20. Corrects the "Considered and dropped" entry in
`docs/decisions/005-the-run-pulse-says-when-a-run-started.md` that calls a `permissions.allow` block "the
actual fix for the stall". Raised as #340, implemented by #342.

## Context

ADR 005 recorded what a stalled run looks like from outside and gave the routine a pulse so one could be
seen. It deferred the fix for the stall itself, on the owner's instruction: measure what really stops runs
before deciding what to permit. Two measurements arrived within two days, both of them the same file:

- **PR #294**, 2026-09-19: blocked 15:51Z, answered by hand 23:24Z — **7 h 33 m**, waiting to edit
  `.claude/rules/governance.md`.
- **PR #318**, 2026-09-20: stalled overnight on the same file, again answered by hand.

The routines are cloud routines (owner, in session, 2026-09-20). Read against the documentation rather than
inferred from the symptom, the cause is not this repository's rules, hooks or labels:

- `.claude/` is a Claude Code **protected path**, alongside `.git/`. *"Writes to a small set of paths are
  never auto-approved, except in `bypassPermissions` mode … This prevents accidental corruption of repository
  state and Claude's own configuration."*
- A cloud session may be set to Accept edits, Plan or Auto. *"Bypass permissions isn't available."*
- *"`permissions.allow` rules in settings files do not pre-approve protected-path writes. The safety check
  runs before Claude Code evaluates allow rules from settings."*
- *"Cloud sessions don't honor `defaultMode: "bypassPermissions"` or `"dontAsk"` from your settings files …
  The setting is ignored silently."*
- Routines have **no permission-mode picker** at all, so a run cannot even be pinned to Auto.
- Auto is not a guarantee either: *"if the classifier blocks an action 3 times in a row or 20 times total,
  auto mode pauses and Claude Code resumes prompting."* An agent editing its own configuration is precisely
  what that classifier exists to question.

The approval the prompt offers for a `.claude/` write is **scoped to that session**, so the owner's answer on
2026-09-19 could not carry to 2026-09-20 and never will. This recurs at the rate a run meets the path — and
most of the open queue is hardening work whose home is `.claude/`.

## Decision

1. **An unattended run never writes under `.claude/`.** Not a preference: there is no configuration in which
   it can, so a run that tries is a run that stops.
2. **A hook refuses the write, rather than a person refusing the prompt.** `PreToolUse` runs before the
   permission system, so `claudeDir()` in `.claude/hooks/write-guard.mjs` ends the call in milliseconds
   instead of leaving a session open all night. **Reads are untouched.**
3. **The owner's checkout is told apart by a gitignored `.owner-machine` marker**, which a clone never has
   because it is never committed. He creates it by hand, once.
4. **What a run does instead** is the answer `.claude/rules/governance.md` already gave for governance work:
   say on the issue what needed changing and why, label it `owner-session`, take the next item.
5. **The guard covers the `Write` and `Edit` tools, and says so.** `.claude/hooks/bash-guard.mjs` has no rule
   for `.claude/` or for the marker, so a shell write is not stopped (#346). The marker is a switch, not a
   seal, and the rule claims no more than it enforces.

## Considered and dropped

- **A `permissions.allow` block in `.claude/settings.json`** — ADR 005's deferred "actual fix". **Rejected: it
  does not work.** Allow rules are evaluated after the protected-path check, so the entry would have no
  effect. The deferral was right for a better reason than the one recorded at the time, and this is the
  correction.
- **`bypassPermissions`** — the one mode that does permit it. Not available to cloud sessions at all, ignored
  from settings files there, documented as *"isolated containers and VMs only"*, and it would switch off the
  `.git/` protection as well.
- **`defaultMode: "dontAsk"`** — would convert the stall into a fast denial, which is the right shape.
  Ignored silently in cloud sessions, so it cannot be selected here.
- **Auto mode** — protected-path writes go to a classifier rather than a person. Not selectable for a routine,
  and it falls back to prompting after repeated blocks, so it moves the stall rather than removing it.
- **Moving the routines to Desktop scheduled tasks**, which do have a permission-mode picker. Rejected: the
  same protected-path prompt applies in every mode a task can be set to except `bypassPermissions`, and it
  would add a second failure — *"Tasks only run while the desktop app is running and your computer is awake.
  If your computer sleeps through a scheduled time, the run is skipped."*
- **Moving the rule files out of `.claude/`** so the path is no longer protected. Rejected: `paths:`-scoped
  loading is what makes `.claude/rules/` cheap (`docs/decisions/001-one-home-per-rule.md` §1), and relocating
  rules to dodge a safety check is the kind of work-around this repository blocks elsewhere.

## Consequences

- A run that needs a `.claude/` edit loses seconds and leaves a record, instead of losing a night and leaving
  nothing. The work moves to a session with the owner, which is where `.claude/rules/governance.md` already
  put it.
- **Governance work is now materially more expensive.** Every rule, skill, agent and hook change needs the
  owner. That is the true cost of the constraint and it was already true — it was simply being paid in stalled
  nights rather than in scheduled minutes.
- The marker is load-bearing in an unusual way: **committing it would disarm the guard in every clone while
  every hook test still passed.** `tests/unit/guardrails.test.ts` checks `git check-ignore` for exactly that.
- If the marker is deleted from the owner's checkout, his own sessions start refusing `.claude/` writes. The
  denial message says what the file is; this record and `.claude/rules/governance.md` say who creates it.
- ADR 005's "actual fix for the stall" line is struck in place rather than left standing with a correction
  somewhere else: `docs/WATCHDOG-PROMPT.md` sends a reader to that record, and a reader who follows a pointer
  should not have to find a second document to learn that the first one is wrong.
- **Still open:** the shell route (#346). `.claude/hooks/bash-guard.mjs` sees neither `.claude/` nor the
  marker, so `sed -i` on a rule file, or a `touch` of the marker, is not stopped.
