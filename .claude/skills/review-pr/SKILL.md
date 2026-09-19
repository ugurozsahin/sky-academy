---
name: review-pr
description: Review and QA another agent's pull request in Sky Ninja Academy. Use when acting as the reviewer for an open PR — deciding to merge it, or to block it with REVIEW: CHANGES REQUESTED.
---
# Review a pull request

`docs/ROUTINE-PROMPT.md` STEP 2 says *when* you review and in what order. This is *how*. The prompt stays the
authority on the flow; where the two ever disagree, the prompt wins and this file is the bug.

## Before anything: are you allowed to review this one?

- **Never review a pull request you opened.** The API cannot tell you whose it is — one token serves every
  agent and the owner, so every pull request here looks self-authored. You know it is yours because you opened
  it *this run*; that is the only evidence there is.
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

## 6. Then decide, and make the decision visible

**Merge** — squash into `main`, tick Review/QA/Done on the issue, and comment with the test results, which
projects you ran, and the commit hash — ending, like every comment you post here, with your session URL (#199).

**Block** — do both marks, or the block does not exist and the next run merges straight over it:

1. Mark the pull request **draft**.
2. Comment beginning exactly `REVIEW: CHANGES REQUESTED`, then say precisely what must change. Separate
   **blocking** items from notes you are not holding the pull request for, so the author knows what is owed.
   **Include your session URL** — a block written without one can only ever be cleared by the session that set
   it, which is the stall #161 exists to end. (This was already the rule for this one comment before #199 made
   it the rule for all of them; it does not change here.)

Do **not** fix it yourself in the same run. The reviewer who set the block is the one who clears it.

**Clearing.** The reviewer who set a block clears it, with a `REVIEW: CLEARED` comment, its own session URL
(#199 — this used to be required only when the clear was a #161 adoption; it is simpler now, and no less
true, to say every `REVIEW: CLEARED` comment carries one) and "Ready for review". Pushing a fix does not clear
a review, and nobody undrafts a pull request to get past one, their own included. Undrafting fires a fresh CI
run (#159), so the merging run waits for **that** run, not the tick underneath.

**Adopting someone else's stale block (#161): go and read the conditions, do not take them from here.**
They are in `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` STEP 2, word for word in all three, and a
rail holds the three copies identical. This file deliberately does **not** restate them, and that is not
tidiness — adoption is a *loosening*, the one rule in this repository that lets an agent clear a block it did
not set, so a paraphrase of it is a licence nothing checks. A fourth copy living in a skill would be the worst
place for one, because a skill loads itself into the run that is about to use it.

What is safe to carry here, because none of it widens anything:

- **Clearing your own block, or a live reviewer's, is forbidden.** If you disagree with an objection, you do
  not clear it — say so and leave it standing, or replace it with your own.
- **A blocking comment carrying no session id is not adoptable at all.** Fail closed and leave it for the
  owner; without an id the "has the setter gone quiet" condition cannot be evaluated, and a condition you
  cannot evaluate is never one you may assume.
- **A block never expires by itself.** `review-gate` keeps reporting it until someone clears it deliberately.

## Reviewing is the work

There is no time box on this. A run that reviews well and develops nothing has done its job; other runs' work
in flight comes before work of your own not yet started, and a review that missed something costs far more
than an item not started.
