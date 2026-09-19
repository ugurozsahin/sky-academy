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
- A pull request held only by an unanswered `owner-approval` label is not yours to unblock. Leave it.

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

## 5. Four things make a pull request unmergeable

Check all four, every time. `docs/REVIEWER-PROMPT.md` STEP 2 has the full reasoning and the incidents behind
each; this is the checklist.

1. **CI is not green on the tree you are about to merge.** Read the **newest** run for the full head SHA; a
   tick from before `main` moved is evidence about a tree that no longer exists. Queued or in progress means
   wait, not merge. A missing `CI` run on any pull request — docs-only included — is a red light (#176). A
   green run whose *e2e step* reads "skipped" is a pass; check the summary says so and say which it was.
   Never re-run a job to see if it passes this time.
2. **The latest review requests changes.** An empty reviews list means nothing: GitHub refuses a formal
   CHANGES_REQUESTED review when reviewer and author share one token, which is always the case here.
3. **It is a draft, or a comment begins `REVIEW: CHANGES REQUESTED`.** Read `review-gate` from
   `GET /commits/<head sha>/status`, not from the Actions API. A head with **no** `review-gate` status has not
   been judged — check the draft flag and the `REVIEW:` comments by eye rather than reading absence as a pass.
4. **It is labelled `owner-approval` with no `OWNER: APPROVED` comment.** Never write an `OWNER:` marker
   yourself, in any form. Nothing but you not doing it prevents it.

## 6. Then decide, and make the decision visible

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
- **A `re-review` label is removed by the reviewer who picks the pull request up.** Whoever pushed the fix
  added it, because a push to a draft starts no reviewer run; taking it off as you begin keeps the label
  meaning "nobody has picked this up yet".
- **Say "another reviewer's block" in the opening lines of the clearing comment**, in those words.
  `scripts/review-gate.mjs` recognises a superseding clear by that phrase and then requires the comment to
  carry a session URL (#191) — which every comment carries anyway (#199).
- **Nobody undrafts a pull request to get past a block**, their own included. Undrafting after a genuine clear
  fires a fresh CI run (#159), so the merging run waits for **that** run, not the tick underneath.

## Reviewing is the work

There is no time box on this. A reviewer run develops nothing and has done its job when it reviews well: a
review that missed something costs far more than an item not started.
