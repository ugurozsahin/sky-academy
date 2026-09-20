# 004 — A block is for the pull request's own bar, and the third round is the last one that blocks

**Status:** accepted — owner, in session, 2026-09-19. Implemented by #305 / PR #306 (`review-pr` skill §7).

## Context

The blocking mechanism was fully specified and the *grounds* for using it were not. A reviewer marks a pull
request draft and comments `REVIEW: CHANGES REQUESTED` (#88); only its setter clears it, or a later run's
fresh review supersedes it (#161). Nothing said what a block is **for**, and nothing said when the rounds have
to stop.

PR #292 (#150) is what that cost. The issue asked for four things — reproduce the mutation, add the pin,
decide and record the home, state the limit — and **all four were met on the first head**. Then:

| round | blocked on |
| --- | --- |
| 1 | a negation on a YAML continuation line — a real hole, in the acceptance's own class |
| 2 | a ` #` comment; a blank line before a continuation; a second `description:` key |
| 3 | `description:Open` with no space; a second key spelt `description :` |
| 4 | `---` inside the frontmatter; `disable-model-invocation: true` |
| 5 | a line that is neither a key nor a continuation |
| 6 | `model:inherit`; a line of non-breaking spaces; a description ending in `:` |
| 7 | a negation word-list rejecting `only`/`instead`/`no`; a character check asserted against the whole file |

Seven rounds is what the Decision below counts: one `REVIEW: CHANGES REQUESTED` per row, 12:25Z to 18:39Z.
Seven pushes, five hours, 276 lines added to one test file, which ended up modelling the Claude Code skill
loader in regular expressions. The two findings in round 7 were real defects the growth had introduced: a
negation word-list that rejected ordinary English (`only`, `instead`, `no`) in the one line that most needs to
be well written, and a character check asserted against the whole file so that a carriage return anywhere in a
skill's body failed the build.

Across 2026-09-19 there were **18 blocking rounds**, 11 of them on two pull requests — this one's seven and
PR #295's four. The developer routine answers at most one stalled block per run (`docs/ROUTINE-PROMPT.md`
STEP 2.5, "the single oldest open PR") and stops starting new work at about 45 minutes (STEP 3), so blocks
accumulate faster than they can be answered — PR #295 took all four of its blocks within 4h29m of opening,
and nothing touched it again until the owner's approval marker five hours after that.

Every round was defensible on its own. The sum was not, and nothing in the protocol could see the sum. What
ended the loop was #161 used twice, not agreement: the clear at 18:33Z superseded the sixth block and a
different reviewer blocked again six minutes later on the two defects above; it took a further fix push and a
**second** supersession to finish.

## Decision

Both halves live in `.claude/skills/review-pr/SKILL.md` §7.

1. **What a block is for.** The bar is the issue's acceptance criteria, this repository's rules, and a real
   defect in what the diff does. Work a reviewer would *like* the author to do — a further hardening, a case
   nobody has hit, a design it prefers — is a non-blocking note or a new issue. The test a reviewer puts to its
   own finding before blocking on it: **name what breaks for a run, for a reader, or for a child if this
   merges as it stands.** "Nothing yet, but" is a note.
2. **Two findings block whatever the round**, so that "not a block" can never be read as "merge anything": the
   pull request does not do what its body says, and a rail does not hold what it claims.
3. **The third round is the last one that blocks.** Count the `REVIEW: CHANGES REQUESTED` comments on the
   pull request, whoever wrote them — over the whole pull request, never reset by a push, and not three rounds
   per reviewer. On the third, the reviewer lists everything it would still change and says what it is holding
   for. After the third, a fresh review finding only notes clears and merges; one finding a genuine defect by
   the bar above blocks again and says in its opening line that it is past the third round and why.
4. **Whatever is dropped goes into an issue linked from the comment.** The cap must not lose findings.

## Considered and dropped

- **Automate it: have `review-gate` refuse a fourth block.** Rejected. The bar is a judgement, and a gate that
  mechanically refused a block would eventually merge over a real defect — the failure
  `ugurozsahin/sky-academy-private-archive#74` already caused once.
  The limit is stated in §7's own comment instead. Revisit if a run is seen walking past the cap.
- **Cap the size of a review rather than the number of rounds.** Not rejected — deferred. The rounds on #292
  were 4,000–10,000 characters each, which is why answering one took a full run; cost per round is a real
  problem. Round *count* was taken first because it is the multiplier, and because a size cap is easy to
  satisfy while saying just as much.
- **The scope rule alone, with no cap.** Rejected: each of #292's rounds was individually defensible under any
  scope rule one could write, so a bar without a floor would not have stopped it.
- **The cap alone, with no bar.** Rejected: "merge on the fourth round" with no account of what may block is
  how `ugurozsahin/sky-academy-private-archive#74` was merged over five open review items. (Both citations are
  written in full on purpose: bare `#74` in this repository is the open Actions-budget issue
  `docs/ROUTINE-PROMPT.md` already cites by that number, and GitHub would auto-link to it.)
- **Do nothing and watch for a repeat.** Rejected by the owner on the evidence of the same day: the pattern had
  already appeared on four pull requests, not one.

## Consequences

- A reviewer will sometimes clear and merge a pull request it still has opinions about. That is the intended
  trade, and the opinions become issues.
- The P3 hardening queue grows faster, because dropped findings are filed rather than argued.
- `docs/REVIEWER-PROMPT.md` points at the skill's §4, §5 and §6 by number and says "no time box", but does not
  mention rounds or §7 — so a run may not read the cap before its second block. That gap is #310; the prompt is
  at its byte budget, which is why it was not closed in the same pull request.
- "No time box" now means **depth** — sections 1 to 5 in full, on the current head — and §7 means **rounds**.
  The closing paragraph of the skill says so, and a rail pins it, because a reviewer reading one without the
  other gets the wrong rule.
- What to measure: rounds per pull request, and whether a fourth-round block ever turns out to have been right.
