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

## 2. Run it yourself, on the head you are judging — cheap first, the browser last

```
npx tsc --noEmit
npm test
npm run build
```

Seconds, and they gate everything after them. Run them now. Then §3 and §4 — the diff, and the agents.

**The browser comes after those, because it belongs to the merge decision and not to the block decision
(#499).** A review that is going to block ends with the author pushing a new commit, so a suite run before the
block was evidence about a head that no longer exists by the time anyone acts on it. Measured over 45 merged
pull requests: 51 blocking rounds against 45 merges, so **about half of all reviewer suite runs were on a tree
replaced within the hour** — and it is the third run of the same suite on that tree, after the author's own
pre-push run and CI's.

You are not flying blind in the meantime. That head's e2e result is already known: a pull request reaches you
"Ready for review" only once CI was green on it (`docs/ROUTINE-PROMPT.md` STEP 3), §5's first unmergeable
condition makes you read that run anyway, and CI tests `refs/pull/N/merge` — the head merged with `main` —
which is a better tree to have evidence about than the bare branch you checked out.

**No finding? Then run it, as the guarantor before you clear or merge:**

```
npx playwright test --project=mobile
npx playwright test --project=desktop        # when the diff could behave differently by viewport
```

Take screenshots too if the change is player-visible.

Three cases where your run is the **only** e2e evidence that will ever exist for this tree, so a merge without
it is a merge on nothing: CI's e2e step was **skipped** by the path filter (#176); the change is
viewport-sensitive and needs desktop, which a pull request never runs (#141); it is player-visible and wants
pictures.

**If you have a finding, the suite does not run at all. Report the finding and stop (owner, 2026-09-22).**
No exception, and in particular not "but the finding is about runtime behaviour". That case is real — "this
breaks when a child taps twice" is a claim, not a reading of a diff, and §7's bar still wants it evidenced —
but **the suite is the wrong instrument for it.** 110 tests that exercise something else prove nothing about
one claim; what evidences it is a targeted reproduction: the smallest thing that makes the defect visible,
quoted in the comment. Build that. Do not reach for the whole suite because it is the runnable thing nearest
to hand.

So the suite has exactly one job on a review: **guarantor for a tree you are about to let through.** Findings
are decided before it and without it.

Record what you actually ran, and when you skipped the browser say that you skipped it and why — a block whose
report is silent about the suite reads like a block that ran it. Never write "mobile + desktop" over a
mobile-only pass. **If the browsers are unavailable, write "e2e not run (env)"** — that exact phrase, so a
pass and a non-run are never the same mark on the page. It is the one place in this file where "did not run"
has a prescribed spelling, and §4's argument is why it needs one.

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
- **A finding that came from a sweep leaves the sweep behind — as an issue, not a commit.** You enumerated a
  class to find it: every topic, every spelling, every route. A reviewer run develops nothing and may not
  push, so the enumeration goes in an issue titled `sweep: <the class>` — the list itself, or the script that
  produces it — labelled `tests`, `priority:P3` and `routine-ok` so the developer query can reach it, and
  linked from your review comment. A sweep described only in a comment is
  re-derived from scratch next round, by you or by whoever supersedes you, and that re-derivation is most of
  what a four-round pull request costs (#466).
- **Check the pull request body against the code**, especially "this only documents existing behaviour" and
  "no look change". A CSS diff of the build output settles the second one in a second. The sweep claim
  `open-pr` §4 asks for is the same kind: a count with no checked-in enumeration and no method beside it
  cannot be verified, and `SWEEP: NOT ENUMERABLE` on a class the code plainly can enumerate is the cheap exit
  taken. **A body that says nothing about the sweep has not done step 4**, and that is the cheapest exit of
  the three — the marker costs grounds, a count costs a method, silence costs nothing and is read by nobody.
  Ask for the method before you weigh it, and weigh it by §7's bar like anything else. **The `agents:` line
  is a claim of the same kind**, and you are the only reader it has: compare it with what §4 returns for you.
  An author's `nothing` beside two findings of your own is the gap that line was added to expose — and **an
  absent `agents:` line is the same finding as an absent sweep claim**, for the same reason: `open-pr` §4
  calls that line the whole of the evidence, so a body without one has no evidence, not good news.

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

**Now go back to §2's browser step, knowing which way this review goes.** No finding: run the suite, as the
guarantor for the tree you are about to let through. **Any finding: do not run it** — report the finding, say
in the comment that the suite did not run and why, and if the finding needs runtime evidence produce the
targeted reproduction §2 asks for rather than the suite.

### Reviewing more than one: one review, one context

The three agents above already are the pattern — the parent keeps their quoted findings, not their working
context. **Apply it one level up: review the first waiting pull request here, and each one after it in its own
subagent**, which reviews and reports back. The contract below says what comes back and who acts on it; leave
any of it unsaid and a delegated review produces output indistinguishable from a correct one.

Past the first, this is not a preference. A run holds every diff, every test run and every agent's output in
one context, and nothing caps how many pull requests that is; past a point the window fills and
**auto-compaction fires** — not a decision the run makes, and not one it can decline. A summary keeps
conclusions and drops the evidence they were built on, which is close to fatal for this work specifically:

- **A finding you can no longer evidence is not reportable.** §7's bar is *what breaks for a run, a reader or
  a child*, and §2 judges the head you ran on: answering either needs the file, the line and the SHA in front
  of you. After a compaction a run can retain *"there is a problem in `arena.ts`"* and have lost the line it
  came from. Think of #292 as the analogy, not the citation — there the findings were over-specific and fully
  evidenced; this is the same check on a finding failing from the opposite end.
- **Cross-contamination.** Once one pull request's findings and another's diff share a summary, the worst
  outcome is a marker on the wrong pull request, and a misplaced `REVIEW: CLEARED` lets something unreviewed
  merge. The marker protocol has no undo.
- **Head staleness.** §5 judges the current head; a summary can carry the SHA the run started with.

The first stays in the parent on purpose: a subagent re-reads `CLAUDE.md` and this skill, roughly 30 KB, which
is pure overhead for a single waiting pull request — and one diff is where the risk starts, not where it bites.

**The delegation contract.** Four rules, and every one of them fails silently if it is left to be inferred:

1. **The parent alone marks, merges and comments; a subagent posts nothing to GitHub** — not the draft flag,
   not a `REVIEW:` comment, not a merge, not a label. §6's *"do both marks, or the block does not exist"* is
   addressed to one reader, and unassigned it goes two ways that both look like a review happened: nobody
   marks, so a reviewed-and-blocked pull request shows GitHub nothing and the next run merges over it; or both
   of you mark, and one review burns two of §7's three rounds, which are counted over the pull request
   whoever wrote them.
2. **§4's three agents are the parent's, for every pull request.** A subagent cannot spawn one — a review
   subagent here reported having no agent-launching tool at all — so §4's *retry, the roster registers late*
   escape would read a structural inability as a timing problem and wait for a condition that never clears,
   and agent coverage would quietly become a function of queue position. The parent checks out the branch,
   runs the three agents itself, and passes their quoted findings into the subagent's prompt as the input §4
   says they are. If one is genuinely unavailable, the parent **says so by name**, exactly as §4 requires.
3. **One at a time, in one checkout.** §2 checks out each branch in a single working tree and §3 requires
   restoring that tree between mutations. Two subagents at once: one mutates for a mutation test and the
   other's `npm test` goes red for a reason it cannot see; one checks out its branch under the other's build.
   That is this section's own cross-contamination moved from context to the filesystem — and it is worse
   there, because a contaminated context produces vague findings while a contaminated checkout produces
   confident, specific, wrong greens. Concurrency needs a worktree each (`using-git-worktrees`); until one
   exists, sequential.
4. **What comes back**, and nothing else — no working context: the verdict; each finding as `file:line` plus
   what breaks; **the head SHA it judged**; the exact commands it ran and their results, `e2e not run (env)`
   included; and one line per review agent. §6's merge comment and §7's bar are written from those, so **the
   parent posts nothing it did not receive** — a gap filled from assumption ("mobile", "tests pass", "the
   agents found nothing") is the falsification §2 forbids, arriving one level up. Pass down what a fresh
   context cannot know, too: §1's gate needs which pull requests this run opened or pushed to (usually none),
   and a subagent has none of the parent's action history to answer it from.

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
are about to report — and **compare them, which is the half that catches anything**: if the head is not the
one §2 ran on, re-run §2 on the new head before you mark; if a `file:line` no longer shows what the finding
says, drop the finding. Reading and posting anyway obeys the words and catches nothing. They are cheap, and
they close the three ways a summarised context gets a mark wrong — the wrong pull request, a stale head, and a
finding whose evidence has evaporated. `docs/REVIEWER-PROMPT.md` STEP 2 already asks the first half of this
("still waiting?"); this is the other half (#326).

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

**A review that ran ends in one of those two marks. Nothing outside the diff postpones it (#516).** If §2's
checks were performed and produced no blocking finding, the verdict is `REVIEW: CLEARED` — whatever else is
true of the branch. A **merge conflict** is the case this was written for, and the argument that withholds the
mark refutes itself: a conflict is mechanical staleness rather than a defect in what the diff does, which is
exactly why it cannot be a review verdict. It is the author's to resolve, `mergeStateStatus` already reports
it, and it already blocks the merge on its own — so holding the mark adds no protection, and it removes the
one signal that says who owns the pull request next. The same goes for a red check you did not cause: say so
in the clearing comment and let the merge rule hold it.

**Withholding the mark is not the cautious option — it is the one that strands the pull request.** A blocked
pull request whose block has been *answered* is picked up by nobody: this skill's §6 brings it back to a
reviewer only when a fresh review gives a verdict, and `docs/ROUTINE-PROMPT.md` STEP 2.5 takes only an
**unaddressed** block — one with no fix pushed against it — so a developer run is right to skip it too. Three pull requests sat in exactly that
state at once on 2026-09-22 — #492, #503 and #502 — across at least nine reviewer passes that each read the
diff, each concluded "no blocking finding in the diff itself", and each posted nothing. "Left for a developer
run" names no recipient. If a rule really does stop you acting, say which rule and what would unstop it.

**Clause (c) asks you to finish a pull request, not to review it again (#579).** STEP 1's third waiting clause
catches one that was already cleared and became mergeable afterwards — the owner's marker landing after the
clear, most often.

**It has a verdict, and (c) says so itself rather than inferring it from the gate.** That is load-bearing: a green
`review-gate` means *not blocked*, never *reviewed*, because
`scripts/review-gate.mjs`'s `blockState()` has nothing to report on a pull request nobody has commented on —
so a brand-new one, CI green and unlabelled, reads `success` before anyone has read a line of it. Clause (c)
therefore requires the newest `REVIEW:` verdict to be a `REVIEW: CLEARED`. Without that condition this
paragraph would be an instruction to **merge an unreviewed diff**: (c) would match the new pull request, "finish
it" would apply, and §5's four rules check CI, blocks, drafts and labels — not whether anyone read the change.
PR #583 was in exactly that state while this was being written: non-draft, gate green, zero comments (#580
review). Watchdog check 11 carries the same condition for the same reason; it was written first and this is it
back-ported to the clause that needed it more. **Re-reviewing it is the wrong act and the loop is real**: a run that
cannot merge it must, by §6's own rule, end in one of the two marks, so it would block a pull request it had
itself cleared, every hour, for as long as the thing it cannot do stays undone.

**First, though: has a commit landed since that clear?** Compare the `REVIEW: CLEARED` comment's `created_at`
with the newest commit on the branch. If the commit is newer, or they share a timestamp, **this is clause (a) in substance however well it
matches (c)'s wording, and it takes the ordinary full review** — the diff, the agents, the suite, a fresh mark.
Never the finish-path.

That order matters because nothing else enforces it. `scripts/review-gate.mjs`'s `blockState()` takes
`{draft, labels, comments}` and **no commit information at all**, so it compares `REVIEW:` and `OWNER:`
timestamps against each other and never against the branch. A push re-runs it on the new head against unchanged
comments, so a stale `REVIEW: CLEARED` keeps the gate green over a commit nobody has read — and (c)'s three
conditions, which is where the clause stops, contain no term about commits. Clause (a) does: *no `REVIEW:`
verdict newer than its newest commit*. Both clauses match such a pull request, and without this paragraph a run
has no textual reason to take the slower one — the wording around (c) pushes the other way, since it frames the
thing as already decided (#580 review).

So under (c), once that check says no commit has landed since the clear:

- **Merge it if the four rules let you.** That is the whole point of the clause, and it is the ordinary case.
- **If a rule bars the merge and the branch is fine — `loosening` is the owner's however he voted — record it
  in your pulse by number with the one-line reason and leave it.** Not a new review, not a new mark, and not a
  fresh block: the verdict already there is still the truth about the diff, and nothing about the diff
  changed. Your pulse is where a run says "I saw this and it is not mine to move".
- **If the branch itself stopped being mergeable — a conflict, a red check — block it, naming what you found.**
  That is not re-judging the diff; it is a new fact about the branch, and `main` moving is how it usually
  arrives, hours after the clear and with no commit on the pull request to mark it. A conflict "is what your
  verdict says" (#516), and the block is the only thing that routes the work anywhere: it marks the pull
  request a draft, so clause (c) stops matching and this stops repeating, and its newest `REVIEW:` comment
  becomes an unaddressed `REVIEW: CHANGES REQUESTED`, which is exactly what `docs/ROUTINE-PROMPT.md` STEP 2.5
  looks for. A developer run then pushes the merge from `main` and the ordinary (b) path takes it from there.
  **Without this the chain has no end**: the reviewer cannot push, STEP 2.5 never sees a cleared pull request,
  and a conflicted one sits until a human notices. #568 sat that way on 2026-09-23, cleared at 09:48Z and
  conflicted at 12:53Z by the merge of #577 (#579).
- **A `REVIEW:` mark under (c) is for the merge, for a branch that stopped being mergeable, or for something
  you actually found in the diff this run** — never because clause (c) listed the pull request.

Two things follow that are easy to get backwards. A pull request under (c) is not evidence the reviewer is
behind, so it does not belong in any "nobody is reviewing" count. And the watchdog's check 11 exists for the
case where even this fails — it is keyed on the repository's own state rather than on anything a reviewer
believes, which is why it is a backstop and not a duplicate of this rule.

**A pull request you may not merge is still one you review.** `docs/REVIEWER-PROMPT.md` rule 4 bars the merge;
it says nothing about the review, and the two are different acts. This bites hardest on exactly the class that
can least afford it: a `loosening` governance pull request stays the owner's to merge even after he approves,
so a run that skips it for being unmergeable leaves **him** merging an unreviewed change to what a run is
allowed to do. Review it, post the verdict, and say in the comment that the merge is his. The same holds for
an `owner-approval` PR waiting on his marker. Observed on 2026-09-22: a reviewer pulse recorded
`#513: not reviewed — owner-session/loosening, not routine-mergeable regardless of review state`.

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

**A third, and it is the same shape: a fix that claims a *class* and does not name its population (#526).**
"Fixed as a class" is unverifiable on its own, and unverifiable is how it keeps being half true — three pull
requests were blocked on one defect on 2026-09-22, one of them *inside the commit whose message claimed to fix
the class*, because each fix reached only the instances its author's own mutation table touched. So a class
fix has to say what set it covers — *every assertion in this block*, *every rail reading prose*, *every call
of `code()`* — and then you can count it, which is the point. `.claude/rules/guardrails.md` has the author's
half. **Count it rather than trusting it**: pick a member the body does not mention and mutate it. That is
how all three of those were found, and none of them by the author.

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
