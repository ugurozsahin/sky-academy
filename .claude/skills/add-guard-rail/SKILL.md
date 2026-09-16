---
name: add-guard-rail
description: Add a guard rail to Sky Ninja Academy. Use when a bug fix, a review finding or a refactor needs a check that fails the build if the mistake comes back.
---
# Add a guard rail

`CLAUDE.md` says adding a rail with each bug fix is part of the fix, and that a budget number only ever goes
down. This file is *how* the rail itself is written. `docs/ROUTINE-PROMPT.md` stays the authority on the flow;
where the two ever disagree, the prompt wins and this file is the bug.

A guard rail is not test coverage. Coverage says the feature works today; a rail says **one specific mistake
we have already made cannot come back silently**. Everything below follows from that difference.

## 1. Name the incident, and give one rail one mistake

Open the rail with a comment that names what happened: the issue number, what the code did, and what it does
now instead. Every rail in `tests/unit/guardrails.test.ts` has one, and they read like the incident log they
are — `as any` smuggling per-bubble gravity past the type (#33), the comparator shuffle that made "random"
order biased (#42), `shadowBlur` in a per-frame draw path (#29), `arena.paused` acquiring a fifth writer
(#65).

**A rail with no incident behind it is a style preference**, and the next editor who meets it red will delete
it rather than ask, because nothing in the file tells them what it cost. If you cannot name the incident, what
you have is a unit test; put it in the module's own file and leave this one alone.

Give it one mistake, too. A rail asserting three unrelated things fails as one line and tells the reader
which of the three only if they go and read it.

## 2. Four homes, and the one place a rail must not go

| Where | For |
| --- | --- |
| `tests/unit/guardrails.test.ts` | text and structure over `src/`, the workflows and the process documents |
| `tests/e2e/game.spec.ts`, named `guard rail: …` | anything needing a browser — frame rate, CSS, screen teardown |
| `tests/unit/british.test.ts` | game wording (#47) |
| a job in `.github/workflows/ci.yml` | what is not in the tree the tests read — the head branch name (#160) |

The one that cannot work here: **a CSS rail written in Vitest passes vacuously.** Vite's css plugin returns an
empty string for `?raw` and `?inline` outside the browser, so the rail reads nothing and goes green for ever.
CSS rails live in the e2e spec, and the header comment of `guardrails.test.ts` says so where an author will
meet it.

Two more placement facts that have each cost a round here. Vite's glob does not reach `.github/`, so the
workflow rails read that one file from disk and assert its length before asserting anything about it. And
comments may legitimately name the very thing a rail bans, so the source is passed through the `code()` helper
that strips them first — otherwise the sentence explaining the ban trips the ban.

## 3. A rail that cannot fail is worse than no rail

A vacuous rail is not a neutral no-op: it is a green tick asserting the thing is safe. `guardrails.test.ts`
opens with `it('reads the sources it claims to check')` for exactly that reason, and the workflow rails assert
the file is non-empty before reading it.

So whatever your rail reads, **assert first that it read it**. A glob that matches nothing, a file moved out
from under a hard-coded path, a regex that no longer matches the shape it was written against, and a
`readFileSync` on a renamed file all look identical from the outside: green.

If the rail derives a list, assert the list is not empty *and* that it contains a named member. A count alone
is not the files that matter — narrowing a walk to one vendored skill still cleared a `toBeGreaterThan(4)`
floor while never reaching the file the rail existed for.

## 4. Prove it red by restoring the bug, before you make it green

Write the rail, then **put the bug back and watch the rail fail**. A rail that has only ever been seen green
is a rail nobody has tested, and this repository has shipped several: the #180 skill rail passed a 3,033-byte
stub of the file it was written to protect, and the #205 rail passed `showCertificateFullscreen;` — the
identifier with the call taken off — `tsc`-clean, 170/170 green, with the bug live on the tablet.

Restore the bug the way it actually happened, not the way that is easy to catch. Then try to get past your own
rail on purpose: that is where the second and third cuts come from, and it is the cheapest review you will
ever get.

**A text rail cannot see a mutation that keeps every identifier and changes what happens** — a call turned
into a bare reference, a guard that never fires, a detector wired to a constant. When your rail is text and
the bug was behaviour, a behavioural test has to sit beside it and run the function; `describe('deliverCertificate,
actually run (#205)')` in `tests/unit/certificate.test.ts` is the worked example, stubbing globals rather than
adding a dependency.

## 5. A budget number only ever goes down

A *budget* rail (`toBeLessThanOrEqual(N)`) records debt that exists today: `play.ts` long lines at 4,
`home.ts` at 8, `as any` in game logic at 0. Its contract is one-directional.

**Lower N when you remove a case. Never raise it to make a build pass** — that is not a rail with a new value,
it is the rail switched off, and it goes green on the commit that reintroduced the thing it counts. When a
refactor turns a budget red, read which way: fewer cases than before is the work succeeding and the number
comes down in the same commit; more is a regression you have just written.

Say in the pull request body which budgets moved and in which direction, including "none", so the reviewer
does not have to diff the numbers to find out.

## 6. Scope, not length — a text rail sees spellings, not ideas

Most rails here are text matching, and the failure mode is always the same: **a pinned string is a substring
of the whole file, so the genuine file can keep it verbatim and contradict it in the next clause.** The #180
skill rail was escaped twice that way with nothing deleted and nothing padded — a pinned ownership rule kept
word for word and then continued into a licence to merge your own work, and a bolded owner-gate moved onto the
opposite bullet, where a free-floating regex cannot see which bullet it matched.

A longer pinned clause is a longer substring, not a stronger check. What fixes it is **scope**:

- Slice the document on its own structure — headings, bullets, blocks — and assert inside the part that owns
  the rule. Ask for the slice through a helper that **throws when the section is missing**, so a file
  reorganised out from under the rail fails loudly instead of skipping.
- Add a vacuity guard over the slicer itself (`expect([...SECTIONS.keys()]).toEqual([1, 2, 3, …])`), or a
  restructure makes every assertion throw for the wrong reason.
- **A repeated heading is a decoy.** A `Map` keyed on the heading number is last-write-wins and its keys are
  a set, so two `## 5.` headings still satisfy that guard: gut the real section, paste a verbatim copy at the
  end, and every pin reads the copy while the reader meets the gutted one — with the file *longer* than
  before. Collect repeats while slicing and assert there are none.
- **Text outside every slice is text outside every pin.** A preamble, a footer, an appendix: whatever the
  slicer does not reach, no per-section assertion covers. Pin that text too, and run any whole-document
  check — a forbidden-phrasing detector especially — over the whole document rather than one section.
- **Self-test a negative.** A `.not.toMatch` whose pattern matches nothing passes for ever, which is the
  vacuity failure above wearing the other sign. Assert in the same file that the pattern fires on the
  wording you are forbidding, and stays quiet on the rule you are protecting. Pair vocabularies rather than
  pinning a phrasing: forbidding one voice leaves every other voice open, and the wording a rail's own
  docstring uses for the threat is the first one a widener will reach for.
- Normalise whitespace before comparing. Matching literal line breaks means an honest re-wrap at a different
  column turns the suite red, which teaches the next editor to reach for the rail rather than the prose.
- Keep a length floor if you like, but treat it as a backstop and nothing more: a stub can be padded past any
  floor. The per-section pins are the substance. The floor is a budget number, so it does not go down either.

## 7. Say what it cannot catch, then show both runs in the body

Finish the rail's comment with its limits, in its own words: what it does not read, which mutations it cannot
see, and which other test covers those. A comment claiming more reach than the code has is how the next
author concludes a hole is covered — #256 and #257 are both open because a rail's description outran it, and
the honest docstring is why neither had to block a merge.

Then the pull request body carries, for each rail:

- the incident it prevents, with the issue number;
- **both runs** — the mutation you made to restore the bug and the failure it produced, then the same rail
  green on the real tree. "Proved red by dropping the `certRoute` branch (3 rails fail)" is the shape;
- which budget numbers moved, and which way;
- what the rail cannot catch, if that is not obvious from the rail's own comment.

**If a rail blocks you and you think it is wrong, say so in the pull request.** Fix it deliberately, in the
open, with the reason in the commit. Never weaken or delete one quietly, and never edit a rail in the commit
that would have failed it — the reviewer cannot tell that from a rail that was always wrong.
