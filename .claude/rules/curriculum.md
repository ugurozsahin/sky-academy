---
paths:
  - "src/curriculum/**"
  - "tests/unit/curriculum.test.ts"
---
# Curriculum generators

- Every topic generator must pass `tests/unit/curriculum.test.ts` (answer in options, unique options, arithmetic
  verified, KS1 ranges). Add a topic = add generator + registry entry (see `.claude/skills/add-topic`).
- Difficulty 1/2/3 = mission stages. Reception is "gentle" (missed bubbles cost no life). Keep numbers within NC
  ranges (R ≤10, Y1 ≤20, Y2 ≤100).
- See `docs/CURRICULUM.md` for the National Curriculum map this maps onto.
