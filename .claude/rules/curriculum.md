---
paths:
  - "src/curriculum/**"
  - "tests/unit/curriculum.test.ts"
---
# Curriculum generators

- Every topic generator must pass `tests/unit/curriculum.test.ts` (answer in options, unique options, arithmetic
  verified, year ranges). Add a topic = add generator + registry entry (see `.claude/skills/add-topic`).
- Difficulty 1/2/3 = mission stages. Reception is "gentle" (missed bubbles cost no life). Keep numbers within NC
  ranges (R ≤10, Y1 ≤20, Y2 ≤100).
- NC map: `docs/CURRICULUM.md`. Years 3–6: also `curriculum-ks2.md`.
- A topic added, renamed or removed needs its `docs/CURRICULUM.md` row and `npm run content-map` (regenerates `docs/CONTENT-MAP.md`, `docs/content-map.json`); `tests/unit/content-map.test.ts` fails otherwise (#2031).
