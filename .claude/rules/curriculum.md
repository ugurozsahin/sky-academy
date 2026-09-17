---
paths:
  - "src/curriculum/**"
  - "tests/unit/curriculum.test.ts"
  - "docs/CURRICULUM.md"
---

# Curriculum generators (#101)

- Generators are pure: `(difficulty, rng) => Question`. Never call `Math.random` directly — take `rng` so a
  question is reproducible and testable.
- Difficulty 1/2/3 = mission stages. Reception is "gentle" (missed bubbles cost no life).
- Keep numbers within National Curriculum ranges: Reception ≤10, Year 1 ≤20, Year 2 ≤100.
- Every generator must pass `tests/unit/curriculum.test.ts`: the answer is among the options, options are
  unique, arithmetic is verified, and KS1 ranges hold.
- `docs/CURRICULUM.md` is the National Curriculum map this content is drawn from.
- Adding a topic = adding a generator + a registry entry in `src/curriculum/index.ts` — see the `add-topic`
  skill for the full how-to.
