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
which has happened (#27 was built twice). Reading the open pull request list is the other half; do both.

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

## 3. Write the body, then check what it would actually close

The title carries `(#<n>)`. The body says, in this order: the closing line, what changed and why, what you
deliberately did **not** do, the tests you ran, and which guard-rail budgets moved.

- `Closes #<n>` when the issue is **finished**. Nothing less.
- `Part of #<n>` when you are deferring any of it — and say what is left. A pull request that says `Closes`
  with work outstanding shuts the issue with the rest undone; #26 had to be reopened by hand.
- Write an **"Owner action"** section only when there is one. An empty one on every pull request is why he
  stopped reading them.

**A closing keyword closes its issue wherever it appears in the body** — inside a negation, a quotation, or
the very sentence explaining why you are not closing it. GitHub scans the whole body for `close`/`fix`/
`resolve` and their forms next to `#<n>`, the `owner/repo#<n>` form or the issue's URL, and has no notion of
negation or context. PR #139 wrote "Left open so merging this does not close #44" and GitHub shut issue 44.

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

## 5. Open it as a draft, and hand it over

Open as **draft**. Undraft only once the **newest** CI run on the current head is green — a tick from before
`main` moved is evidence about a tree that no longer exists, and it sits on the same head SHA as a fresh one,
so "green on the head" does not distinguish them. That is the #150 criterion, and both sibling documents spell
it the same way (`docs/ROUTINE-PROMPT.md` STEP 2, `.claude/skills/review-pr/SKILL.md` §5).

**And your green is not the handover evidence.** Undrafting fires a run of its own — `ci.yml` carries
`ready_for_review` (#159) — so by construction the run you checked is never the newest one on that head by the
time a reviewer looks. Check yours to avoid handing over something broken; the reviewer reads the run your
undraft starts.

Then stop. **Do not review or merge your own pull request.** The API cannot tell you whose it is — one token
serves every agent and the owner, so every pull request here looks self-authored; you know it is yours because
you opened it this run, and that is the only evidence there is. Tick "Develop" on the issue and leave the rest
to a different agent.

If a reviewer later asks for changes, push the fix and say what changed. **Pushing a fix does not clear a
review, and you never undraft to get past one** — not even your own block on someone else's work. The reviewer
who set it is the one who lifts it.

## 6. Governance pull requests say which way they move the constraint

If the diff touches `CLAUDE.md`, `BACKLOG.md`, `docs/ROUTINE-PROMPT.md`, the workflows or the guard rails, put
one line near the top of the body:

- **Tightening** — it adds a check, a rail or a rule, or it only describes behaviour that already exists.
  Reviewed and merged like any other pull request, by a run that did not open it.
- **Loosening** — after this change something a run was not permitted to do, it may now do. **Owner-gated.
  Never routine-merged, however obviously right it looks.**
- **Mixed** — both. Owner-gated, and worth splitting instead.

Judge the constraint, not the signal: *after this change, is there still something red that a merge rule
reads?* And note that "it only documents existing behaviour" is the cheapest cover story available, because a
run can describe the behaviour it wishes existed — so the reviewer checks your description against the code.

`docs/ROUTINE-PROMPT.md` has the full rule and the reasoning.

## 7. Three files that change together

`CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` carry several rules in identical wording, and rails in
`tests/unit/guardrails.test.ts` hold them to it. If you change one, change all three in the same pull request.

And **records have readers** (#178): a change and why belongs in this body; a decision that binds future work
belongs on the issue or in `docs/decisions/`; operational state belongs in the heartbeat issue. Nothing
appends to a log file. The test for any record is *who opens this, and when?*
