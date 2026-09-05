---
name: add-topic
description: Add or change a curriculum topic (question generator) in Sky Ninja Academy. Use when asked to add a maths/writing topic, adjust difficulty, ranges, or wording of questions.
---
# Add a topic

1. Check `docs/CURRICULUM.md` for the NC objective and the difficulty convention (d1 intro · d2 expectation · d3 stretch).
2. Write a pure generator in `src/curriculum/maths.ts` or `writing.ts`:
   `const yXName: Generator = (d, rng) => numQ(rng, prompt, answer, { min, max, visual?, say?, distractors? })` — or `wordQ(rng, prompt, answer, distractors, { visual?, say?, hint? })`.
   - Use `ri/pick/shuffle` from `util.ts`; never `Math.random` directly (tests seed `rng`).
   - `say` = spoken form for non-readers; `visual` types are in `types.ts` (objects, tenframe, dots, array, coins, clock, fraction, word, sentence).
   - Spelling-in-order questions: return `sequence` (see `spellQ` in writing.ts). Tracing topics: `mode: 'tracing'`, `answer` = text to trace.
3. Register in the `*_TOPICS` array: `{ id: 'y1-foo', title, icon, subject, year, nc, gen }`. Ids are `r-`, `y1-`, `y2-` prefixed and unique.
4. Run `npm test` — the generic suite checks answer∈options, uniqueness, arithmetic correctness, ranges and variety for every topic × difficulty automatically. Add a targeted test in `tests/unit/curriculum.test.ts` only for a rule the generic suite can't infer.
5. If the topic needs a new visual, add a case to `src/ui/visuals.ts` + CSS in `style.css`, then `npm run test:e2e`.
6. Add the topic to `docs/CURRICULUM.md` and move any backlog item to Done in `BACKLOG.md`.
