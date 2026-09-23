---
name: open-pr
description: Open a pull request in Sky Ninja Academy. Use when you have finished a piece of work on an issue and are about to branch, push and raise the PR.
---
# Open a pull request

`docs/ROUTINE-PROMPT.md` STEP 3 says *when* you develop and how the item is chosen. This is *how* the pull
request itself is made. The prompt stays the authority on the flow; where the two ever disagree, the prompt
wins and this file is the bug.

## 1. Say you are starting, on the issue

One comment on the issue before you branch. It is the only thing that stops two runs shipping the same item —
which has happened (#27 was built twice). Reading the open pull request list is the other half; do both. Sign
it with your session URL, like every other comment you post here (#199) — a one-line "starting on this" is
still enough to clear the content floor (#200) as long as it says what it means.

## 2. Name the branch yourself

```
feature/<n>-<slug>     fix/<n>-<slug>     chore/<n>-<slug>
```

- `fix/` for a `bug` or `playtest` issue, `feature/` for an `enhancement`, `chore/` for everything else —
  tests, guard rails, docs, governance, refactors, `review`/`debt` work.
- **The prefix follows the label describing the change, not the label describing where it was found.** A bug
  the owner hit while playing that you fix by adding a rail is still `fix/`; a `playtest`-labelled request for
  a new screen is `feature/`.
- The slug is lower case, hyphens, a few words — `fix/107-tablet-five-frame-overflow`, not a dump of the
  issue title.

**If this session was configured with a push branch of its own, do not use it.** Create the branch above and
push that. The permission is the owner's own, in his words on issue #160, comment of 2026-09-10T18:12Z — cite
that comment, not this file, because any agent editing this repository could have written this paragraph. It
was tested from a scheduled cloud run on 2026-09-11 (`chore/160-branch-naming-pushtest`, `EXIT=0`), so there
is no technical barrier; it was only ever an instruction.

The same test found that **deleting** a branch is refused, so do not plan on cleaning one up. Merged branches
delete themselves, so this only bites a branch that never merges.

If the push is **refused** — not discouraged, refused, with the error in front of you — push wherever you can
and begin a line of the pull request body with `BRANCH: PUSH REFUSED`, naming the branch you tried and quoting
the refusal. It must begin a line: the `branch-name` job in `ci.yml` greps `^BRANCH: PUSH REFUSED`, so the
same words mid-sentence do not satisfy it and a reviewer quoting it mid-sentence must not clear the check.
That marker is a bug report, not a preference, and it is the only shape of `claude/*` branch left.

**And the check goes green on your say-so.** `branch-name` can see that you claimed a refusal; it cannot judge
whether the refusal was real, and its own summary says so. A reviewer checks the quote, not CI — which is why
a second `BRANCH: PUSH REFUSED` in this repository's history is something to investigate rather than
accommodate.

**When `main` moves under you.** A branch can stop being mergeable with nothing wrong in it and no commit of its own to show for it: `main`
lands something that touches the same lines. It happened to #568 on 2026-09-23, hours after that pull request
had been reviewed and cleared. `docs/REVIEWER-PROMPT.md` STEP 1 clause (c) and §6 of the `review-pr` skill say
how such a pull request gets back to a developer; this is what the developer then does (#585).

**Merge, never rebase.** `git merge origin/main` into the branch, resolve, commit, push.

```
git fetch origin && git merge origin/main
```

A rebase or a squash of your own would rewrite commits already pushed, which needs a force-push, and the hook
refuses one unless the owner asks for it in session. So a rebase does not leave you where you started — it
strands the branch worse than the conflict did.

**A branch cut from another branch is the usual cause, and it is avoidable.** This repository squash-merges,
so the parent branch's commits never become ancestors of what lands on `main`. A child of that parent then
conflicts with `main` the moment the parent merges, every time, and re-merging brings the whole parent diff
back with it. Branch from `main`. `#512` hit this three times in one pull request.

**Two additions are almost never a choice between them.** The common conflict here is two branches appending
to the same region of one file — sibling children of an epic each adding tests, most often. Keep both sides.
#568 conflicted with #564 that way in `tests/e2e/viewport.spec.ts`, and both belonged: #563's two tests read
`.mode-grid`, #564's four read `.rewards-cols`.

**Check the resolution by counting, not by reading it back.** "Both sides kept" is a claim about a file you
have just spent ten minutes staring at, which is the worst moment to judge it. Count the things that should
have survived — tests, exports, cases — on each side and on the result:

```
git show origin/main:<file> | grep -c '<the declaration>'
git show origin/<branch>:<file> | grep -c '<the declaration>'
grep -c '<the declaration>' <file>
```

On #568 that was 23 on `main`, 21 on the branch, 25 resolved — and 25 is right only because the two sides
added 4 and 2 to a common 19. A silently dropped block looks exactly like a clean resolution otherwise.

**A `git worktree` breaks the credential helper.** `credential.helper store --file=.git/github-credentials`
cannot resolve where `.git` is a file rather than a directory, so a push from a worktree prints
`unable to get credential storage lock in 1000 ms: Not a directory`. It may still succeed by another route —
check whether the ref moved before treating it as a failure — and this is worth knowing because the reviewer
workflow recommends worktrees for exactly this kind of work.

**Say in the comment that you merged `main` and what you resolved**, with the counts. A merge commit in a pull
request that was already reviewed makes it waiting again under clause (a), so it gets a fresh review — of a
tree nobody has seen before, which is the correct outcome and worth the reviewer knowing the shape of.

## 3. Write the body, then check what it would actually close

The title carries `(#<n>)`. The body says, in this order: the closing line, what changed and why, what you
deliberately did **not** do, the tests you ran, and which guard-rail budgets moved.

- `Closes #<n>` when the issue is **finished**. Nothing less.
- `Part of #<n>` when you are deferring any of it — and say what is left. A pull request that says `Closes`
  with work outstanding shuts the issue with the rest undone; #26 had to be reopened by hand.
- Write an **"Owner action"** section only when there is one. An empty one on every pull request is why he
  stopped reading them.
- Ends with its own `Session: https://claude.ai/code/session_<id>` line (#199) — every comment and issue in
  this repository does, the pull request body included. The CLI's own auto-generated footer at the bottom is
  not a substitute for this line; write it yourself.

**A closing keyword closes its issue wherever it appears in the body** — inside a negation, a quotation, or
the very sentence explaining why you are not closing it. GitHub scans the whole body for `close`/`fix`/
`resolve` and their forms next to `#<n>`, the `owner/repo#<n>` form or the issue's URL, and has no notion of
negation or context. PR #139 wrote "Left open so merging this does not close" and then issue 44's number, and GitHub shut issue 44.

So: write "the issue stays open", or "#&#8203;<n> remains open for Part B", and break the link when the
keyword is unavoidable. **Backticks are not a fix** — the parser ignores code spans, which is why eight pull
requests whose only closing line sat in backticks closed nothing and had their issues shut by hand. Quoting
cuts both ways and neither direction is safe to rely on.

Then check the body you actually wrote, rather than the one you meant to:

```
node scripts/review-gate.mjs body.md      # prints the issues that body would close, or "closes: nothing"
```

**`closes: nothing` is a result, not an all-clear.** It is what an empty, stale or mistyped `body.md` prints,
and it is textually identical to a body you checked correctly that closes nothing on purpose. So read it
against what you meant: on a `Closes #<n>` pull request it is a failure. Nothing ties `body.md` to the body
you actually post either, so check the file you are about to paste from, and re-check if you edit the body
afterwards.

**Paste that output into the pull request.** If the list is not exactly the issues you intend to close, fix
the body — not the list.

## 4. Prove it green before you push, not after

```
npx tsc --noEmit
npm test
npm run build && npx playwright test --project=mobile
npx playwright test --project=desktop        # when the change could behave differently by viewport
```

A pull request runs e2e on **mobile only** (#141) and **only when the diff can reach the game** (#176) —
`src/`, `index.html`, `public/`, `tests/e2e/`, `playwright.config.*`, `package*.json`, `ci.yml`. Unit tests and
the build always run.

Two consequences worth stating, because both have cost a day here:

- **If your change is viewport-sensitive, run desktop yourself.** Nothing on the pull request will, and the
  nightly is the next chance — by then it is on `main`.
- **If your change is one CI will not run e2e on, that is not licence to skip it.** For that pull request your
  run is the only e2e there is.

Run the suite here rather than pushing again to see a result: Actions minutes are metered, #119 is open, and
the spending limit is deliberately closed.

Say what you actually ran. Never write "mobile + desktop" over a mobile-only pass, and if the browsers are
unavailable write **"e2e not run (env)"** — that exact phrase, so a pass and a non-run are never the same mark.

**That marker records a gap; it does not close one.** On the Mac-side VM a scheduled run uses, Playwright
browsers cannot be downloaded at all, so the two rules above resolve to: write the marker and ship with no
desktop evidence anywhere until the nightly. Say so in the body in as many words — that a viewport-sensitive
change is going out unexercised — so a reviewer who *does* have browsers knows to run it rather than reading
the marker as a formality.

### Sweep the class, not the instance

A defect has an **instance** — the one the issue names — and a **class**: every place the same mistake can
occur. Fix the instance and the reviewer sweeps the class, and that is how this repository's longest pull
requests are made. PR #427 took four blocking rounds, each naming the next topic carrying the defect it
existed to close; #380 took five, #394 four. **Every one of those rounds was correct** and met `review-pr`
§7's bar, so nothing in the round cap could stop them: the round count was simply how many members the class
had (#466).

So before you push:

1. **Say what the class is, in one sentence.** *"Every topic whose question is not carried by `repeatKey`."*
   *"Every spelling a single-letter gap can produce."* If you cannot write that sentence, what you are holding
   is an instance and you have not found the defect yet.
2. **Enumerate it by driving the real code**, never by reading the lists the fix edits. Drive the shipped
   registry, the real generator, the real routes, with enough seeds to exhaust the draw. A sweep that reads
   the same table the fix touches shares the fix's blind spot — and so does a rail derived from the code under
   test, which is how one can certify the defect green (PR #427 round 2, in those words).
3. **Check the enumeration in** when a machine can produce the list.
   `tests/unit/fixtures/reception-gap-spellings.txt` is the worked example: 889 spellings, with a rail that
   diffs them. The next member then arrives as a line in somebody's diff rather than as a review round — #443
   was found that way, for the cost of one line.
4. **Put the size in the body**: what the class is, how many members you swept, how many this diff fixes, and
   which you are leaving, each with its reason. *"Fifteen (word, gap, letter) pairs in all"* is the shape.
   When step 3 did not fire, nothing in the repository can check that number, so give the method and the seed
   count beside it — a bare total reads as evidence and is not.

**A class you genuinely cannot enumerate** — the code cannot produce the list, or it is unbounded — gets a
body line beginning **`SWEEP: NOT ENUMERABLE`**, naming the class and what bounds the risk instead. That exact
spelling, for the reason `e2e not run (env)` has one: a sweep nobody did and a sweep that found nothing must
never read the same. That precedent only carries because `review-pr` §3 supplies the other half of it — for
e2e, §2 and §5 already oblige a body to carry the evidence, and for the sweep it is §3's body check that
makes an absent claim a finding rather than a silence. **It is an answer, not an exemption.** The grounds are that the code cannot produce the
list — never that the run was short of time, and never that steps 1 to 4 are more than a bar — and the
grounds are what a reviewer weighs (`review-pr` §3).

### Then attack it with something that is not you

Run the three review agents in `.claude/agents/` — the three `review-pr` §4 names — over your own diff before
you hand it over, and **say in the body what each returned**, in one line:

```
agents: pr-test-analyzer — nothing · silent-failure-hunter — 2, both fixed · type-design-analyzer — unavailable
```

That line is the whole of the evidence, and §4 says why in its own voice: *an agent that never ran and an agent
that found nothing produce the same silence*. If one reports itself unavailable in the first minutes of a
session, retry — the agent roster registers later than the skill list does (#180) — and **if it is still
unavailable, name it in that line** rather than leaving it out. Three `unavailable`s in a row is not
compliance: a run that cannot spawn an agent **at all** — a subagent has no agent-launching tool, which
`review-pr` §4 already records — writes the line as `agents: cannot spawn (subagent)` and nothing else. That
exact spelling, for the third time in this section and the same reason each time: a gap and a result must
never be written the same way, and "say so in your own words" leaves them indistinguishable.

**Apply §4's reachability test before you change anything.** They reason forward from a bad input to a bad
outcome and do not reason backwards to whether the input can occur, so a finding whose input the code cannot
produce is a note for the body, not an edit to the diff. Fixing everything they raise is how a ten-line pin
becomes 276 lines (#292), and a diff inflated that way looks exactly like a diff that had to be that big.

**And not for a verdict.** You never review, mark or merge your own pull request, and §5 below does not move an
inch. They are worth running here for one reason: they are a **different context**, which is the one thing a
re-read of your own diff can never be. A run that re-reads its own work runs its own rail, sees its own green,
and concludes what it concluded the first time.

## 5. Open it as a draft, and hand it over

Open as **draft**. Undraft only once the **newest** CI run on the current head is green — a tick from before
`main` moved is evidence about a tree that no longer exists, and it sits on the same head SHA as a fresh one,
so "green on the head" does not distinguish them. That is the #150 criterion, and both sibling documents spell
it the same way (`docs/REVIEWER-PROMPT.md` STEP 2, `.claude/skills/review-pr/SKILL.md` §5). **Marking it "Ready
for review" puts it in the reviewer routine's next hourly run** (`docs/decisions/003-two-routines.md`).

**And your green is not the handover evidence.** Undrafting fires a run of its own — `ci.yml` carries
`ready_for_review` (#159) — so by construction the run you checked is never the newest one on that head by the
time a reviewer looks. Check yours to avoid handing over something broken; the reviewer reads the run your
undraft starts.

Then stop. **Do not review or merge your own pull request.** The API cannot tell you whose it is — one token
serves every agent and the owner, so every pull request here looks self-authored; you know it is yours because
you opened it this run, and that is the only evidence there is. Tick "Develop" on the issue and leave the rest
to a different agent.

If a reviewer later asks for changes, push the fix and say what changed — in a comment shaped like the
review it answers (#200): open `Pushed <sha>, addressing <what>`, resolve each blocking finding by the
reviewer's own numbering so it is easy to match them up, state the tests you ran, and close `Ready for
re-review`, never `REVIEW: CLEARED` — that mark stays the reviewer's, whatever you just fixed. End with your
session URL (#199), the same as everything else you post here. The reviewer routine's next run
sees the fix: it looks at blocked pull requests with a commit newer than the block. **Pushing a fix does not
clear a review, and you never undraft to get past one** — not even your own block on someone else's work.
The reviewer who set it lifts it, or a later reviewer run's fresh review does (`review-pr` skill §6).

## 6. Governance pull requests say which way they move the constraint

A pull request that changes how the routines themselves work — `CLAUDE.md`,
`docs/ROUTINE-PROMPT.md`, `docs/REVIEWER-PROMPT.md`, the workflows, the guard rails — used to be left for the
owner as a class, on the reasoning that a run should not merge changes to its own rules. Sound instinct,
wrong cut: it conflates *an author must not land their own work* — true, and already enforced by §5 above — with *a run must not land a
rule change*, which is so broad that PR #96 sat open all day while the thing it fixed was live and unfixed.

So every governance pull request states, in one line near the top, which way it moves the constraint:

- **Tightening** — it adds a check, a rail or a rule, or it only describes behaviour that already exists.
  Reviewed and merged like any other pull request, by a run that did not open it.
- **Loosening** — after this change something a run was not permitted to do, it may now do. **Owner-gated.
  Never routine-merged, however obviously right it looks.** Put the `loosening` label on the pull request:
  `review-gate` reads it and stays red until the owner approves (#112), so the gate is a status a merge rule
  reads and not only this sentence.
- **Mixed** — both. Owner-gated — same label — and worth splitting instead.

Three things to get right:

1. **Judge the constraint, not the signal.** The question is *after this change, is there still something red
   that a merge rule reads?* PR #97 stopped the review gate failing its own job, which sounds like a loosening
   — but `review-gate` still goes red and §5 above still reads it, so nothing a run may do changed. That is
   neutral and routine-mergeable; a change that quietly stops something being *reported*, by contrast, is how a
   constraint actually decays.
2. **"It only documents existing behaviour" is the cheapest cover story available**, because a run can describe
   the behaviour it wishes existed. It counts as tightening, so the reviewer checks the description against the
   code, not against the pull request body.
3. **The reviewer's job includes disagreeing with the label.** A mislabelled loosening is then a visible,
   arguable act instead of a silent non-decision.

The point is asymmetry: an agent must not be able to vote itself more freedom, but an agent that wants the
routine held to a higher standard should not have to wait a day for it.

## 7. One home per rule

A rule lives in one file and the others point at it (`docs/decisions/001-one-home-per-rule.md`). Put a new
rule in its home — do not copy it into a second file. A few paragraphs are still copied across `CLAUDE.md`
and `docs/ROUTINE-PROMPT.md`; `.claude/rules/governance.md` lists them, and until each is
reduced to its home a rail fails if you change one copy and not the others.

And **records have readers** (#178): a change and why belongs in this body; a decision that binds future work
belongs on the issue or in `docs/decisions/`; operational state belongs in the heartbeat issue. Nothing
appends to a log file. The test for any record is *who opens this, and when?*
