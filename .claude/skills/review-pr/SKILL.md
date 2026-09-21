---
name: review-pr
description: Review and QA another agent's pull request in Sky Ninja Academy. Use when acting as the reviewer for an open PR — deciding to merge it, or to block it with REVIEW: CHANGES REQUESTED.
---
# Review a pull request

`docs/REVIEWER-PROMPT.md` STEP 2 says *when* you review and in what order. This is *how*. The prompt stays the
authority on the flow; where the two ever disagree, the prompt wins and this file is the bug.

## Before anything: are you allowed to review this one?

- **Never review a pull request you opened, or pushed a commit to.** The API cannot tell you whose it is —
  one token serves every agent and the owner, so every pull request here looks self-authored. You know it is
  yours because you opened it, or pushed to it, *this run*; that is the only evidence there is.
- A pull request held only by an unanswered `owner-approval` or `loosening` label is not yours to unblock.
  Leave it. A reviewer may put `loosening` **on** a pull request (§5) and never takes it **off**: removing it
  turns `review-gate` green at once, and that decision is the owner's.

## 1. Read the issue before the diff

Open the issue the pull request claims to close and read its acceptance criteria and its **comments** — the
owner reorders, re-scopes and offers stopgaps there, and a criterion he added in a comment is as binding as the
body. Then ask what the diff would have to do to satisfy them, and only then read the diff. Reading the diff
first makes you a proof-reader of the author's plan instead of a check on it.

## 2. Run it yourself, on the head you are judging

```
npx tsc --noEmit
npm test
npm run build && npx playwright test --project=mobile
npx playwright test --project=desktop        # when the diff could behave differently by viewport
```

Take screenshots too if the change is player-visible.

Record what you actually ran. Never write "mobile + desktop" over a mobile-only pass. A pull request runs e2e
on **mobile only** (#141) and only when the diff can reach the game (#176), so a viewport-sensitive change —
CSS, layout, canvas maths — has no desktop evidence at all until the nightly unless you produce it. **If the
browsers are unavailable, write "e2e not run (env)"** — that exact phrase, so a pass and a non-run are never
the same mark on the page. It is the one place in this file where "did not run" has a prescribed spelling,
and §4's argument is why it needs one.

## 3. Attack the change, do not confirm it

The reviews that missed something here all read the diff for whether it works. Read it for how it fails.

- **Mutate the code and watch the test go red.** This is the whole job. Restore the bug the pull request fixes
  and confirm the new rail fails; then break each *part* of the fix in turn. A rail that stays green under a
  mutation is a rail that is not holding that property, whatever its name says.
  - **Read the count of tests that ran, not the exit status.** A mistyped `-t` filter matches nothing, exits
    **0**, and prints `177 skipped` — which scrolls past as a pass and turns every mutation after it into
    evidence of nothing.
  - **Restore the tree before you run anything else.** A mutation left behind makes every later green in that
    checkout meaningless, including the one you are about to quote in your review.
- **Suspect a test that cannot fail.** Work out, algebraically, whether the assertion is an identity. A test
  named for a property is not evidence that the property is pinned — and a pull request body that *claims* a
  property is covered is a claim to check, not to quote.
- **Check the guard rail's reach.** Rails here are text and DOM checks. Ask which spellings and which screens
  this one actually sees, and which plausible rewrite walks straight past it.
- **A budget number may only go down.** One raised to make a build pass is the finding.
- **Check the pull request body against the code**, especially "this only documents existing behaviour" and
  "no look change". A CSS diff of the build output settles the second one in a second.

## 4. Run the three review agents, then check their reachability

Run `pr-test-analyzer`, `silent-failure-hunter` and `type-design-analyzer` (in `.claude/agents/`) on the diff
and **quote what each found in your comment, "nothing" included**. If one reports it is unavailable in the
first minutes of a session, retry — the agent roster registers later than the skill list does (#180). **If it
is still unavailable, say so by name.** An agent that never ran and an agent that found nothing produce the
same silence, and recording the first as the second is how a review claims cover it did not have.

They are input to your review, never its verdict. The marks stay yours, and so does the reading:

> **Check the reachability of anything an agent calls critical before you let it block a pull request.**
> They reason forward from a bad input to a bad outcome and rate severity on the outcome; they do not reason
> backwards to whether the input can occur. A finding whose input the code cannot produce is hardening, not a
> blocker — say so, and say why you disagreed.

Equally, a finding no agent flagged as critical may still be the one that matters. Rank by what it costs the
child, not by the label it arrived with.

### Reviewing more than one: one review, one context

The three agents above already are the pattern — the parent keeps their quoted findings, not their working
context. **Apply it one level up: review the first waiting pull request here, and each one after it in its own
subagent**, which returns the verdict and the findings and nothing else.

Past the first, this is not a preference. A run holds every diff, every test run and every agent's output in
one context, and nothing caps how many pull requests that is; past a point the window fills and
**auto-compaction fires** — not a decision the run makes, and not one it can decline. A summary keeps
conclusions and drops the evidence they were built on, which is close to fatal for this work specifically:

- **A finding without its evidence is what §7 forbids.** The bar there needs the file, the line and the head.
  After a compaction a run can retain *"there is a problem in `arena.ts`"* and have lost the line it came
  from — #292's failure mode returning structurally, months after §7 was written to stop it.
- **Cross-contamination.** Once one pull request's findings and another's diff share a summary, the worst
  outcome is a marker on the wrong pull request, and a misplaced `REVIEW: CLEARED` lets something unreviewed
  merge. The marker protocol has no undo.
- **Head staleness.** §5 judges the current head; a summary can carry the SHA the run started with.

The first stays in the parent on purpose: a subagent re-reads `CLAUDE.md` and this skill, roughly 30 KB, which
is pure overhead for a single waiting pull request — and one diff is where the risk starts, not where it bites.

This caps nothing. Reviewing many pull requests is the point of the routine, and a review queue backing up is
what produced #292; the fix is to make many reviews *safe* (#326).

## 5. Four things make a pull request unmergeable

Check all four, every time. This is the checklist; `docs/decisions/002-routine-prompt-is-flow-only.md` has the
incidents behind each.

1. **CI is not green on the tree you are about to merge.** Read the **newest** run for the full head SHA; a
   tick from before `main` moved is evidence about a tree that no longer exists. Queued or in progress means
   wait, not merge. A missing `CI` run on any pull request — docs-only included — is a red light (#176). A
   green run whose *e2e step* reads "skipped" is a pass; check the summary says so and say which it was. The
   step is skipped when the diff touches none of the paths in `GAME_PATHS` in `.github/workflows/ci.yml` — the
   line CI itself reads, so it cannot go stale.
   Never re-run a job to see if it passes this time.
2. **The latest review requests changes.** An empty reviews list means nothing: GitHub refuses a formal
   CHANGES_REQUESTED review when reviewer and author share one token, which is always the case here.
3. **It is a draft, or a comment begins `REVIEW: CHANGES REQUESTED`.** Read `review-gate` from
   `GET /commits/<head sha>/status`, not from the Actions API. A head with **no** `review-gate` status has not
   been judged — check the draft flag and the `REVIEW:` comments by eye rather than reading absence as a pass.
4. **It is labelled `owner-approval` with no `OWNER: APPROVED` comment.** Never write an `OWNER:` marker
   yourself, in any form. Nothing but you not doing it prevents it.

A pull request that touches a governance file raises one more question before a merge: **which way does it
move the constraint?** Check its one-line direction statement against the diff. A loosening — or a declared
tightening that you read as a loosening — is the owner's to merge, never yours: make sure it carries the
`loosening` label (apply it yourself if the author did not — `review-gate` then stays red until the owner
approves, #112), say why in a comment, and leave it. `.claude/skills/open-pr/SKILL.md` §6 has the rule and its worked examples.

## 6. Then decide, and make the decision visible

**Write each finding when you confirm it, not at the end.** Records have readers, and a run's own context is
not a record: hold a finding through three more diffs and a compaction can take the `file:line` with it. Put
it somewhere that outlives the context — a comment as you go, or a file you re-read — before you move to the
next pull request.

**Re-read before you mark.** Immediately before `REVIEW: CHANGES REQUESTED`, `REVIEW: CLEARED` or a merge,
re-read three things: the pull request number, its current head SHA, and the `file:line` of every finding you
are about to report. They are cheap, and they close the three ways a summarised context gets a mark wrong —
the wrong pull request, a stale head, and a finding whose evidence has evaporated. `docs/REVIEWER-PROMPT.md`
STEP 2 already asks the first half of this ("still waiting?"); this is the other half (#326).

**Merge** — squash into `main`, tick Review/QA/Done on the issue, and comment with the test results, which
projects you ran, and the commit hash — ending, like every comment you post here, with your session URL (#199).

**Block** — do both marks, or the block does not exist and the next run merges straight over it:

1. Mark the pull request **draft**.
2. Comment beginning exactly `REVIEW: CHANGES REQUESTED`, then say precisely what must change. Separate
   **blocking** items from notes you are not holding the pull request for, so the author knows what is owed.
   **Include your session URL** — one token serves every agent, so it is the only thing that tells a later
   reader which session set the block. (This was already the rule for this one comment before #199 made it the
   rule for all of them; it does not change here.)

Do **not** fix it yourself in the same run: a session that pushes to a pull request may no longer review it.

**A block its reviewer leaves unanswered is superseded by a fresh review (#161).** The reviewer who set a
`REVIEW: CHANGES REQUESTED` block clears it with `REVIEW: CLEARED` and "Ready for review". If they do not, a
later run that neither opened the pull request nor pushed a commit to it reviews it from scratch against the
current head, exactly as `docs/REVIEWER-PROMPT.md` STEP 2 reviews any pull request, and gives its own verdict: its own
`REVIEW: CHANGES REQUESTED`, or a `REVIEW: CLEARED` comment that opens by saying it is superseding
another reviewer's block, followed by the merge. No session reviews its own change: you never clear a block
on a pull request you opened or pushed to, and pushing a fix does not clear one. A block never expires by
itself — `review-gate` keeps reporting it until someone clears it deliberately.

What that means in practice:

- **It is a review, not a countersignature.** Sections 1–5 above, in full, on the current head. The earlier
  reviewer's findings are evidence to check, not the limit of what you look at; if you find the objection still
  stands, or find a new one, the verdict is your own `REVIEW: CHANGES REQUESTED`.
- **There is no waiting period and nothing to measure.** Whether the first reviewer has "gone quiet" is not a
  question you have to answer; the only test is that you neither opened the pull request nor pushed to it.
- **A fix pushed since the block is what brings the pull request back to you.** The reviewer routine counts a
  blocked pull request with a commit newer than its block as waiting (`docs/REVIEWER-PROMPT.md` STEP 1);
  nobody labels it or undrafts it to ask.
- **Say "another reviewer's block" in the opening lines of the clearing comment**, in those words.
  `scripts/review-gate.mjs` recognises a superseding clear by that phrase and then requires the comment to
  carry a session URL (#191) — which every comment carries anyway (#199).
- **Nobody undrafts a pull request to get past a block**, their own included. Undrafting after a genuine clear
  fires a fresh CI run (#159), so the merging run waits for **that** run, not the tick underneath.

## 7. A block is for this pull request's own bar, and rounds are not free

Pull request #292 (#150) took **seven rounds of `REVIEW: CHANGES REQUESTED`** across 6h14m and seven
pushes. The issue asked for four things, and all four were met on the first head. Rounds 2 to 6 added no
acceptance item: each invented a further shape — a YAML comment, a second `description :` key,
`model:inherit`, a line of non-breaking spaces — until a ten-line pin had become 276 lines modelling a YAML
parser in regular expressions, with a check that failed the build on ordinary English (`only`, `instead`,
`no`) and on a carriage return anywhere in the file. Every round was defensible on its own. The sum was not,
and nothing here stopped it.

**What a block is for.** A block says *this pull request does not meet its bar*. The bar is the issue's
acceptance criteria, this repository's rules, and a real defect in what the diff does. Work you would like
the author to do — a further hardening, a case nobody has hit, a design you prefer — is not a block: write it
as a non-blocking note, or open an issue and say you have. The test to put to your own finding before it
blocks: **name what breaks for a run, for a reader, or for a child if this merges as it stands.** If the
answer is "nothing yet, but", it is a note. Two findings block whatever the round: the pull request does not
do what its body says, and a rail does not hold what it claims. Those are not preferences.

**The third round is the last one that blocks.** Count the `REVIEW: CHANGES REQUESTED` comments on the pull
request, whoever wrote them: the count is over the whole pull request, a push never resets it, and two
reviewers do not get three rounds apiece. On the third, list everything you would still change and say which
of it you are holding for. After the third, a fresh review finding only notes clears and merges; one finding
a genuine defect by the bar above blocks again and says in its opening line that it is past the third round
and why the finding meets that bar. Whatever you drop goes into an issue linked from the comment — it is
queued, not lost.

A reviewer who reaches the third round has usually already found the real answer: the pull request is trying
to do too much. Say that instead. "Reduce this to X; the rest is issue #n" is a better review than a seventh
shape.

`docs/decisions/004-what-a-review-block-is-for.md` has the incident this came from and the five alternatives
weighed against it: automating the count, the bar with no cap, the cap with no bar and doing nothing were all
rejected; capping the *size* of a review instead of the number of rounds was **deferred, not rejected**, and is
the one to raise again if cost per round is still the problem.

## Reviewing is the work

There is no time box on this. A reviewer run develops nothing and has done its job when it reviews well: a
review that missed something costs far more than an item not started. That is about **depth** — sections 1 to
5, in full, on the current head — and §7 is about **rounds**: reviewing well and blocking repeatedly are not
the same thing.
