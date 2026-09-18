---
paths:
  - "tests/unit/guardrails.test.ts"
  - "scripts/**"
---

# Guard rails and scripts (#101)

- `tests/unit/guardrails.test.ts` and the `guard rail:` tests in the e2e spec encode mistakes already made —
  render frame rate, screen teardown on a route change, screen-class CSS collisions, `as any` in game logic,
  comparator shuffles, `shadowBlur`, the dependency allowlist, listener pairing; British English lives in
  `british.test.ts`. They are text/DOM checks, not proofs: they catch the exact spellings and the exact
  screens named in their comments.
- A *budget* rail (a frame-rate number, a byte count, a line count…) records existing debt. It may only be
  lowered when the debt it measures is genuinely reduced — never raised to make a build pass.
- Prove a rail red before making it green: reproduce the bug the rail exists to catch, watch the rail fail on
  it, then fix the bug and watch the rail pass.
- Adding a rail with each bug fix is part of the fix, not a follow-up.
- `scripts/` holds operational tooling (screenshots, the single-file bundle, art extraction, the board sync,
  the review-gate check) — read the comment at the top of a script before changing it; several are pinned to
  specific behaviour by a rail in `tests/unit/guardrails.test.ts` itself.
- The dependency allowlist rail fails on an unlisted `package.json` dependency — do not add one without a
  reason, and update the allowlist in the same change if the owner has agreed to it.
- If a rail blocks you and you think it is wrong, say so in the PR — do not weaken or delete it quietly.
