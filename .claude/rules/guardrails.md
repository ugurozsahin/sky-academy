---
paths:
  - "tests/unit/guardrails.test.ts"
  - "tests/unit/governance.test.ts"
  - "tests/unit/workflows.test.ts"
  - "tests/unit/scripts.test.ts"
  - "tests/unit/helpers/sources.ts"
  - "tests/unit/helpers.test.ts"
  - "scripts/**"
---

# Guard rails and scripts (#101)

- `tests/unit/guardrails.test.ts` — with `governance.test.ts`, `workflows.test.ts` and `scripts.test.ts`
  beside it, split out by subject in #321, and the readers all four share in `tests/unit/helpers/sources.ts` —
  and the `guard rail:` tests in the e2e spec encode mistakes already made:
  render frame rate, screen teardown on a route change, screen-class CSS collisions, `as any` in game logic,
  comparator shuffles, `shadowBlur`, the dependency allowlist, listener pairing; British English lives in
  `british.test.ts`. They are text/DOM checks, not proofs: they catch the exact spellings and the exact
  screens named in their comments.
- A *budget* rail (a frame-rate number, a byte count, a line count…) records existing debt. It may only be
  lowered when the debt it measures is genuinely reduced — never raised to make a build pass.
- Prove a rail red before making it green: reproduce the bug the rail exists to catch, watch the rail fail on
  it, then fix the bug and watch the rail pass.
- Adding a rail with each bug fix is part of the fix, not a follow-up.
- **A fix that addresses a *class* names the population it covers (#526).** "Fix the class, not the instance"
  (#466) is followed and still fails, because a reminder cannot enumerate a set. What happens instead: the
  author fixes the class **across the instances their own mutation table touches** — and that table is written
  after the fix, by the mind that wrote the fix, so it inherits the same blind spot. The instances left
  untreated are exactly the ones not imagined. It happened three times on 2026-09-22 (PRs #513, #517, #521),
  once *inside the commit whose message claimed to fix the class*, and all three were found by reviewers.
  So, three parts, each turning a promise into something countable:
  **(a) Name the set** — *every assertion in this describe block*, *every rail that reads a prose document*,
  *every call of `code()`*. "I fixed them all" is a claim; a named set is an object a reader can count.
  **(b) Rail the coverage where the set is mechanically enumerable.** Test files are files, so a rail can read
  them — the worked example is a rail that reads `tests/unit/governance.test.ts`'s own source and asserts
  every rail in a block carries a negative assertion, the class defect there being precisely "a block of
  positives". **That is the shape to copy, not a claim that it is already in place**: it was written for #512
  and lands with it. A rule that says a mechanism exists when it does not is the "it only documents existing
  behaviour" cover story the `open-pr` skill §6 warns about, and it was this bullet's first draft (#527
  review, B4).
  **(c) Derive the mutation table from the set, not from imagination** — one mutation per member. That turns
  *did I think of it?* into *is the list complete?*, and only the second is checkable.
  **What this does not do**: catch a class nobody has named. It catches *named the class, treated it
  partially*. An unnamed class still needs an independent mind, which is why those three rounds were the
  reviewer's finds and not the author's. The reviewer's half is in `.claude/skills/review-pr/SKILL.md` §7.
- `scripts/` holds operational tooling (screenshots, the single-file bundle, art extraction, the board sync,
  the review-gate check) — read the comment at the top of a script before changing it; several are pinned to
  specific behaviour by a rail in `tests/unit/scripts.test.ts` itself.
- The dependency allowlist rail fails on an unlisted `package.json` dependency — do not add one without a
  reason, and update the allowlist in the same change if the owner has agreed to it.
- If a rail blocks you and you think it is wrong, say so in the PR — do not weaken or delete it quietly.
