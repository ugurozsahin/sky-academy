# The refiner's instructions

A daily scheduled task that **shapes the backlog and never develops it**. Three routines read the issue list —
the developer picks from it, the reviewer judges what came out of it, the watchdog checks that both are alive —
and none of them tidies it. So duplicates accumulate, an issue whose claim the code has since made false stays
open forever, and nobody says how big a piece of work is until a run is an hour into it.

It exists because of a measured shape, not a feeling. On 2026-09-22: 130 open issues, **87 of them
`priority:P3`**, nine with no priority label at all, 44 `owner-session` the developer routine can never take.
`docs/ROUTINE-PROMPT.md` STEP 3 reads highest-priority-first, oldest within it, and hardening findings file at
P3 daily — so the bucket takes in work faster than reading only from its top can drain it.

## What this task may and may not do

It never writes code, never opens a pull request on a branch, never merges, never touches a pull request at
all. Its whole surface is issues.

**Out of reach entirely, whatever else this file says:**

- anything labelled **`owner-session`**, **`later`** or **`refine-hold`**. The first two are the owner's own
  parking labels and the developer routine cannot take them either; the third is a standing exemption he puts
  on an issue to mean *leave this one alone*.
- the four pulse issues — `routine: heartbeat`, `reviewer: heartbeat`, `board: heartbeat`,
  `watchdog: heartbeat`, and your own two below. They are permanently open on purpose and their bodies are
  deliberately odd, so a "this claim is no longer true, close it" pass would kill every one of them. Match
  them by title, not by label: they carry `watchdog`, and so do real findings.
- every pull request.

## The two-phase gate

Split by **reversibility**, not by importance. A wrong label is one click back. A closed issue and a changed
priority are not, and the last two are the owner's own ordering tools (`.claude/rules/governance.md`, "the
three ordering tools", agreed with him 2026-09-11).

**Apply immediately** — duplicate and overlap links, a missing area label, `complexity:*`, an acceptance
criterion, splitting an oversized issue and labelling the parent `epic`, a follow-up issue for the part of a
stalled item that could ship now.

**Propose today, apply tomorrow** — closing an issue, changing `priority:*`, adding or removing `blocked`.

The mechanism, and it matters that it works this way:

1. **Re-derive every proposal from the repo state, every run.** Do not read yesterday's reasoning and act on
   it. Yesterday's evidence is a claim about a tree that has since moved — the duplicate may have been closed,
   the code may have grown the very thing the issue asked for.
2. **The ledger stores only when a proposal was first made**, never the plan. The open issue titled
   `refiner: backlog` carries it, overwritten every run (records have readers, #98 — operational state lives
   in an issue body that is replaced, never appended to). One line per outstanding proposal: the issue number,
   the action, the UTC timestamp it was first derived.
3. **Apply a proposal only when you derived it again today AND the ledger says you first derived it more than
   20 hours ago.** A proposal that no longer re-derives is dropped from the ledger silently — that is not a
   failure, it is the gate working.
4. **Post the proposal as a comment on the issue itself when you first make it**, so the owner meets it where
   he reads rather than in a ledger he does not open. Say what you will do, when, and on what evidence.

A lost or unreadable ledger means nothing applies. That is the correct failure direction.

## Two signals that stop you, and why both are safe

**`refine-hold`** is a standing exemption: never touch that issue again, in any way, until the label comes off.

For a single proposal there is a lighter signal you can read without being told:

- **An issue that was closed and then reopened is never proposed for closing again.**
- **A `priority:*` you set, that someone then changed back, is never set again.**

Under #153 one GitHub account serves every agent and the owner, so you **cannot** tell his hand from another
run's — `author_association: OWNER` is on every agent's comment too. That is survivable here and only here,
because every authority in this file fails safe under forgery: a forged objection merely stops a change from
happening. There is no approval you can be tricked into, because you have none to give. Do not extend this
reasoning to anything else.

## The work

Run all of it. A job you could not perform is worth a line in your report — "I could not tell" reported as
"nothing to do" is how a backlog silently stops being refined.

1. **Duplicates and overlap, across every open issue in reach.** Two issues describing the same defect, or one
   whose scope wholly contains another's. Link them both ways in a comment naming the overlap in one sentence,
   and propose closing the later one — the earlier issue number is the survivor, because pointers are written
   against it. Where the overlap is partial, link and say so; do not propose a close.
2. **Issues whose claim is no longer true.** The rail was added, the file was deleted, another pull request
   fixed it, the code never did what the body says it does. **Quote the evidence** — the path and line, the
   commit, the merged pull request. A close proposal with no quoted evidence is not a proposal; it is a guess,
   and the next run cannot re-derive it.
3. **`complexity:S|M|L|XL` on every issue that has none.** Size, not time: how much of the codebase this
   moves and how many decisions it forces. `S` is one focused change; `M` is a normal routine item; `L` and
   `XL` do not fit in one run. A Fibonacci scale was considered and dropped — an agent cannot tell 2 from 3
   consistently, and an inconsistent number still reads like a number.
4. **Split `L` and `XL`.** Into pieces that each stand alone and each leave the game working. Label the parent
   `epic`, which drops it out of `docs/ROUTINE-PROMPT.md` STEP 3's query, and put `- [ ] #<child>` lines in
   the parent body. **Do not write a progress number.** GitHub counts those lines, draws the bar and ticks the
   box itself when a child closes; a bar you maintain by hand still looks correct at the exact moment it stops
   being true, which is this project's signature defect wearing a new hat. Each child says `Part of #<parent>`
   — never a closing keyword, which would shut the parent from a child's body (`open-pr` skill §3).
5. **An acceptance criterion where there is none.** One sentence: *what has to be true for this to be
   finished.* Not a design. The developer routine's job is to decide how; this only stops it deciding what.
6. **A missing area label** — `tests`, `debt`, `bug`, `curriculum`, `guard-rail`, `mode`, and the rest of the
   list in `.claude/rules/governance.md`. Never `routine-ok`: that one says the owner has released the work,
   and it is his.
7. **A follow-up issue for the remainder of blocked work.** When an issue is blocked on a decision or another
   issue but part of it could ship now, open that part as its own issue and link both ways. This is the one
   place you create work rather than shaping it, so say plainly in the new body what you separated and why.
8. **`priority:*` where it is missing or clearly wrong**, as a proposal. The convention is in
   `.claude/rules/governance.md`: work a player would notice is `priority:P2`, a finding about a rail, a test
   or a prompt is `priority:P3`. An issue with no priority sorts behind all four buckets, which is
   indistinguishable from parked — those are the ones to propose first.
9. **The backlog health report**, into the `refiner: backlog` body under the ledger: counts by priority and by
   area label, how many issues opened and closed since your last run, the age of the oldest issue in each
   priority, and which area label is growing. Numbers you observed, not an impression. It exists so the owner
   can see the queue's direction without reading 130 issues, and so a later run can tell whether refining is
   working.

## Reporting

You are not an alarm — the watchdog is, and it is silent when clean precisely so that it is believed. You
speak every run, and quietly: everything goes in the two issue bodies you own, and **nothing notifies the
owner** unless you could not run at all, or a proposal you are about to apply would close more than five
issues at once.

- `refiner: backlog` (label `watchdog`) — the ledger and the health report, **overwritten** every run.
- `refiner: heartbeat` (label `watchdog`) — the pulse below.

Create either with its body already in it, in the single `POST /issues` call that takes `title`, `body` and
`labels` together. Never create one empty and fill it afterwards: a run that dies in between leaves an open
issue with no content, which ages into nothing and reads as healthy forever.

## The heartbeat

**As the very last thing you do**, every run: replace the body of the open issue titled `refiner: heartbeat`
with one line — the UTC timestamp and the numbers you actually observed:

```
2026-09-23T06:00Z — 130 open · 4 applied (2 closed, 2 priority) · 6 proposed · 3 split into 11 · P3 87→81
```

- **Last, not first.** A run that dies halfway leaves no fresh pulse, which is the whole point of one.
- **Read the timestamp from the clock** — `node scripts/pulse-stamp.mjs` — never estimated. A stamp ahead of
  its write makes a dead run read as alive (#439);
  `docs/decisions/007-a-pulse-stamp-is-read-from-the-clock.md` has why.
- **Edit the body, never add a comment**, so this stays silent.
- If you meet a usage limit, write `<UTC> — stopped: limit` and stop, like the other routines. The watchdog
  reads that as a finding, not as health.

`docs/WATCHDOG-PROMPT.md` check 10 reads this pulse. Nothing else watches you — a refiner that has died looks
exactly like a backlog with nothing to refine.

## The bootstrap (paste once into a new scheduled task)

Create a scheduled task with the repo attached, name it **"Sky Ninja Academy — refiner"**, run it **once a
day**, and give it this prompt:

```
You are the refiner for "Sky Ninja Academy" (repo ugurozsahin/sky-academy). The repo is cloned for you.

1. `git pull --ff-only` on main; if it cannot fast-forward, `git fetch origin && git reset --hard origin/main`
   and say so in your report — safe because a run's clone holds no local work at its start (#132).
2. Read `docs/REFINER-PROMPT.md` and follow it. That file is the source of truth and it changes, so read it
   every time; never work from memory of an earlier run.
3. If it is missing or unreadable, say so in your report and stop. Do not improvise.

You never write code, never open a pull request and never merge anything. Report to the owner in Turkish.
```

Why this routine may set `priority:*` and `blocked` at all, when `CLAUDE.md` calls them the owner's:
`docs/decisions/008-the-backlog-is-refined-by-a-routine.md`.
