# 002 — The routine prompt carries the order of a run, not its history

**Status:** accepted — owner, in session, 2026-09-19. Follows `docs/decisions/001-one-home-per-rule.md`.

## Decision

`docs/ROUTINE-PROMPT.md` is read in full at the start of every run, so it holds only what a run needs then:
the order of the steps, the rules a run must see inline, and the format of its heartbeat. How to review and
how to open a pull request live in the `review-pr` and `open-pr` skills. Why a rule exists — the incident, the
date, the pull request — lives here.

The prompt stored in the routine itself is a bootstrap that pulls and reads that file, so changing how the
routine works is an ordinary reviewed commit, with no drift between what the repo says and what runs do.

No rule was removed and no test was removed or weakened in making this cut: every sentence a guard rail pins
is still in the prompt, and the prompt's byte budget only went down.

## What was moved out of the prompt, verbatim

Kept so that the reasoning behind a rule can be found when someone proposes changing it. Nothing below is an
instruction to a run.

### Why the prompt lives in the repo, and the bootstrap

**This file is the routine's prompt.** The prompt stored in the routine itself is a short bootstrap that
does nothing but clone, pull and read this file, so changing how the routine works is an ordinary commit and a
PR — no pasting, no drift between what the repo says and what the runs actually do, and the change is reviewed
like any other. Claude cannot edit the routine's stored prompt (the owner created it through the API), which is
exactly why the stored prompt should stay a bootstrap and never grow instructions of its own.

## The bootstrap (paste this into the routine once, then never again)

Go to claude.ai/code/routines → "Sky Ninja Academy — hourly dev run" and replace the whole prompt with the
eight lines between the fences:

```
You are the autonomous developer for "Sky Ninja Academy" (repo ugurozsahin/sky-academy). The repo is cloned for you.

1. `git pull --ff-only` on main.
2. Read `docs/ROUTINE-PROMPT.md` and follow everything from "## The routine" onwards. That file is the source of
   truth for this run: it changes between runs, so read it every time and never work from memory of an earlier one.
3. If it is missing or unreadable, do nothing else: say so in your report, commit nothing, and stop.

Speak Turkish in any summary for the owner; code, comments and game text in British English.
```

Everything else — what to work on, the review rules, the steps — lives below and is edited in the repo.

### The cadence note

trigger is still *named* "Sky Ninja Academy — hourly dev run" from when it fired hourly; that name is now just
an identifier for finding it in the UI, not a statement of how often it runs. Read the cadence from the cron,
never from the word "hourly" wherever it survives. (The watchdog sizes "the routine is dead" off this interval, so an overstated cadence makes it cry wolf.)

### Context: the project board

The **project board** (GitHub Projects v2, "Sky Academy") is **not reachable from a cloud session at all**:
Projects v2 exists only in GitHub's GraphQL API, and the cloud GitHub proxy serves a pinned set of
pull-request GraphQL operations and answers everything else 403 whatever token you supply (Claude Code docs,
"Configure cloud environments → GitHub proxy"). So no run syncs the board and no run reads it. The sync,
`scripts/board-sync.mjs`, runs on the **owner's Mac** every 15 minutes as a launchd agent
(`scripts/board-sync.plist`, token in `.git/github-project-token` there) and leaves a **pulse** in the open
issue titled `board: heartbeat` (label `watchdog`): a UTC timestamp and what it did, refreshed at least
hourly (#87). That pulse is what you read (STEP 1). A pulse older than ~2 hours, one you cannot parse a
timestamp out of, or an issue that is missing or closed, means the Mac job has stopped — a finding to record
and tell the owner, not something you can fix or work around.

### Records: the trap, and the artifact publisher

The trap is the third row, because the heartbeat issue is the one place here that *is* read: it is a
fixed-size snapshot that you **replace**. Appending to it would rebuild the unbounded file this rule removed,
somewhere worse. If a run wants to leave a note for the next run, that is not a record — it is an issue.

**The live artifact is not being republished.** It used to be kept in step with `main` by a separate scheduled
task ("Sky Ninja Academy — artifact publisher", https://claude.ai/public/artifacts/43914c31-28c5-4afb-bf15-966a64e09668).
The owner stood that task down on 2026-09-09, so the artifact is frozen at whatever it last published and will
drift further from `main` with every merge. That is his decision and it is not a fault to report: do not open
an issue about the artifact being stale, and **do not start publishing it yourself** — the prohibition in the
"Do NOT" list at the foot of this file stands whether or not a task exists to do it instead.

### What to work on: a repeated sentence

Code health and features queue together: a `review`- or `debt`-labelled finding is ordered by its priority label like anything else.

### STEP 1: the board

You cannot run the sync yourself — a cloud session cannot reach Projects v2 (Context above) — and you never edit a card by hand: the board is a projection of the labels, the PR list and the branches (the rule table is the comment at the top of `scripts/board-sync.mjs`), so to move a card you change the label or the PR and the Mac job follows within 15 minutes.

### STEP 1: the worklog

It is closed history now; reading it once killed a run at the 95 KB token limit. What to work on is the label query in STEP 3; what is in flight is the open PR list; why a change was made the way it was is in that PR.

### STEP 1: the nightly

No run in the last ~26 hours means the schedule is not firing — GitHub disables cron on repo inactivity, and a mistyped cron or a renamed workflow looks exactly the same — so main has been merging without a full check. Record it in your heartbeat snapshot (STEP 5) and tell the owner; do not shrug it off as "the nightly did not fail". This is the same mistake as reading a missing `review-gate` status as green: a check reports a pass by evidence, never by absence.

### STEP 1: the watchdog pulse

Older than ~14 hours (two missed runs plus slack for task queueing and usage limits) means **the watchdog is dead** — nobody is checking main, the nightly or the budget, and because a clean watchdog run is silent, nothing else would ever have told you. Record it and tell the owner; it is not your job to fix the task, but it is your job to notice. An **open issue is not evidence of a pulse** — a readable, recent timestamp is: if the body is empty or you cannot parse a UTC timestamp out of it, treat it exactly as a stale one. (That is the watchdog's likeliest partial death: the pulse is written last, on purpose, which is also the most exposed place to run out of time.) If **no such issue exists in any state**, the watchdog task has probably not been created yet — the owner creates it once — so note it in your heartbeat snapshot, and if it is still absent 24 hours later tell him, because a task created and dead before its first pulse looks exactly the same from here. If it exists but is **closed**, someone closed the pulse: that is a finding, not a pass.

### STEP 2: fork pull requests, and the old branch prefix

The repository went public on 2026-09-16, and this listing was written when it was private, when every open PR was necessarily this project's own; it no longer is. An external fork PR

### STEP 2: the old branch prefix

That instruction used to read "open PRs from branches `claude/*`", which since #89 would find none of them: branches are now `feature|fix|chore/<n>-<slug>`, so a prefix match on the old name silently returns an empty list and a run that trusted it would report "nothing to review" with work sitting open. There is no prefix worth matching on — a PR is a PR.

### STEP 2: desktop e2e

Add `--project=desktop` yourself when the diff could behave differently by viewport — CSS, layout, anything the desktop project has its own assertions for — because until #81 the PR was the place a desktop-only regression was caught, and now the nightly is; a regression you wave through lands on `main` for the day.

### Unmergeable rule 1: CI on this tree

*Green* means green on this tree, not green once: a pull-request run tests the head merged with `main` as of that run, so a tick from before `main` moved is not evidence about what will land. Since #88 clearing a review block (`REVIEW: CLEARED` + "Ready for review") fires a run of its own, so a PR you have just undrafted always has a fresh one coming — read the newest, and if it is `queued` or `in_progress`, wait for it rather than merging on the one underneath. a stale green tick was once merged nine hours behind `main`, after a later PR's new rail had already invalidated it. **Since #96 every pull request has a `CI` run, docs-only ones included** — the workflow-level `paths-ignore` is off the `pull_request` trigger, so there is no longer a shape of PR whose missing check you are meant to read as fine. That carve-out sat next to "anything that touches code and has no run is a red light" and asked you to tell two identical absences apart by eye; now a missing `CI` run on a PR is *always* a red light. What is filtered instead is the **e2e step**, and only on a pull request: it is skipped, visibly and with its reason in the run summary, when the diff touches none of `src/`, `index.html`, `public/`, `tests/e2e/`, `playwright.config.*`, `package*.json` or `ci.yml`. A green run whose e2e step reads "skipped" is a pass — check the summary says so rather than assuming, and say in the merge comment which it was. The nightly and `workflow_dispatch` are never filtered. (`review-gate` is a separate check, stamped per commit; its Actions workflow run is always green whether or not it found a block — deliberately, so a block does not mail a failure notice — so read the block itself with `GET /commits/<head sha>/status`, **never** the Actions API, and never read a missing status as a pass.) Anything that touches code and has no run is a red light — `/commits/<sha>/check-runs` returns 403 for some tokens, and the GitHub MCP's status tool is blind to Actions check-runs; a queued or failing run means wait or leave it — read the failure, never re-run the job to see if it passes this time (every run costs metered minutes, and a rail that fails intermittently is a rail telling you something). A run once merged with a red CI job and left `main` red for twenty minutes.

### Unmergeable rule 2: the incident

Merging over a review throws the work away — done once, over five open review items, one of which was why CI was failing.

### The two mechanical checks: why the window is per pull request

That is the owner's decision of 2026-09-12T08:40Z on #213, and it is the whole fix: a comment the same session left on another pull request or an issue is the signal that it has *moved on*, so it does not protect the block. The retired test — "has it commented anywhere in the repository since", with no window at all — could essentially never be satisfied, because a reviewing run almost always writes something somewhere before it ends — five real blocks became permanently unadoptable that way, which is what #213 was filed for. The other three conditions did not move.

### The two mechanical checks: why a block carries a session URL

That is the other half of this rule, and it costs you nothing today: from now on **a `REVIEW: CHANGES REQUESTED` comment carries its own session URL**, because a block written without one can only ever be cleared by the session that set it, which is precisely the stall (~10 hours, broken by hand) this rule exists to end.

### STEP 3: why the flow reads labels and not the board

— that is the owner's view and his control surface, not a second list: he reorders on the issue, not the board's Priority field, which the sync overwrites (tools: `governance.md`), and #87's sync (`scripts/board-sync.mjs`, a launchd job on the owner's Mac) keeps the board's Status and Priority derived from the labels, the PR list and the branches. The flow reads labels and not the board for two reasons: a cloud session cannot reach Projects v2 at all (Context above), and the day the Mac job or its token stops, a board-driven routine would not know what to work on, whereas labels are readable with the credential every actor already has.

### The second item: why it is a condition and not a quota

This is the owner's, in session on 2026-09-10, and the shape matters as much as the
permission. The bottleneck here has never been development — merges are fast — it is **review and conflict**: blocks that sat for hours, stale green ticks, and agents sharing one checkout corrupting each other's edits. Handing every run two items would double the review queue and the collision surface, which is
the opposite of the fix. Filling *idle* capacity does not.

So it is **a condition, not a quota**, and that is the property to preserve: the moment second items produce a
backlog, condition 1 stops being true on its own and the run goes back to reviewing. Do not replace it with a
counter, a rota or a "two items per run" allowance.

### The second item: condition 3, the incident

Two pull requests from one run conflicting with each other would be an entirely self-inflicted version of
   the problem this repository has already hit three times.

### STEP 5: what sits beside the snapshot, and the board

Since #98 nothing sits beside it — the file that used to is archived and closed. See "Where a record goes" above for why, and for where the other kinds of record belong.

The board is not yours to write (Context above), so there is no sync step here: the Mac job picks up this run's merges, PR and branch within 15 minutes. What the snapshot carries is the `- board:` line — the pulse you read in STEP 1, its timestamp and age, the value observed — so the watchdog and the owner can see from one place whether the Mac job is alive.

### STEP 5: replace, never append

This is the one record here that *is* read, so an unbounded one rebuilds the file #98 removed in the worst possible place. Fixed size means: this run's line, and the checks below. Last run's snapshot is in the issue's edit history if anyone ever wants it, which nobody has.

### STEP 5: the stale example

2026-09-10T22:41Z — merged ugurozsahin/sky-academy-private-archive#179 (#96), developed #98 (PR #101)

### The "Do NOT" list: parentheticals

publish artifacts (never — and note the publisher task is stood down, so "someone else will" is no longer true either), re-run a CI job to "see if it passes this time" (read the failure — every run costs metered minutes),

### The "Do NOT" list: the board

(the board is a projection — change the label or the PR state, and the Mac job's `scripts/board-sync.mjs` follows within 15 minutes; you could not reach the board anyway).

### STEP 1: an open watchdog issue

An issue labelled `watchdog` at the top of the Code health section was put there by the watchdog task (`docs/WATCHDOG-PROMPT.md`) because something is actually broken now: **that is this run's first work**, ahead of the nightly check above — the watchdog has already looked at the nightly, so an open `watchdog` issue is the curated version of anything it would have told you.

### STEP 2: why mobile is the default

(#81, owner's decision — the game is mobile-first and Actions minutes are metered). Record

### Unmergeable rule 4: why the owner is not asked to approve an unchanged look

Asking him to approve a picture identical to the last one teaches him to approve without looking, and the day it matters he will.

### Unmergeable rule 4: one token

One token serves him and every agent, so nothing can stop an agent forging his approval except the agent not doing it.

### STEP 3: the old hand-ordered list

That is the whole rule, and rule 5 is what makes it deterministic rather than a matter of taste: two runs reading the same repo state pick the same issue, which is the property the old hand-ordered list could not give.

### STEP 3: the skill and its rail

— the skill carries this in full now, and its own guard rail (#180) keeps it from being gutted. Four things stay here too, because `CLAUDE.md`/`BACKLOG.md` pin them in this file as well and they must never live only in the skill:
