---
name: add-topic
description: Add or change a curriculum topic (question generator) in Sky Ninja Academy. Use when asked to add a maths/writing topic, adjust difficulty, ranges, or wording of questions.
---
# Add a topic

1. Check `docs/CURRICULUM.md` for the NC objective and the difficulty convention (d1 intro · d2 expectation · d3 stretch).
2. Write a pure generator in the topic's year file — `src/curriculum/reception.ts`, `year1.ts` or a strand file in `src/curriculum/year2/` (`number`, `shape`, `measure`, `words`, `sentences`, each under 300 lines; new file if none fits) — or `util.ts` if the generator is shared across years (a Year 2 generator is exported from `src/curriculum/year2/index.ts`, add it to that file's re-exports; its registry row goes in `year2-topics.ts`, step 3):
   `const yXName: Generator = (d, rng) => numQ(rng, prompt, answer, { min, max, visual?, say?, distractors? })` — or `wordQ(rng, prompt, answer, distractors, { visual?, say?, hint? })`.
   - Use `ri/pick/shuffle` from `util.ts`; never `Math.random` directly (tests seed `rng`).
   - `say` = spoken form for non-readers; `visual` types are in `types.ts` (objects, tenframe, dots, array, coins, clock, fraction, word, sentence).
   - Spelling-in-order questions: return `sequence` (see `spellQ` in `util.ts`). Tracing topics: `mode: 'tracing'`, `answer` = text to trace.
3. Register in the `*_TOPICS` array — in the year file for Reception and Year 1, in `year2-topics.ts` for Year 2 (#889), importing the generator from `src/curriculum/year2/index.ts`: `{ id: 'y1-foo', title, icon, subject, year, nc, gen }`. Ids are `r-`, `y1-`, `y2-` prefixed and unique.
4. Run `npm test` — the generic suite checks answer∈options, uniqueness, arithmetic correctness, ranges and variety for every topic × difficulty automatically. Add a targeted test only for a rule the generic suite can't infer, in the topic's own `tests/unit/topic-<id>.test.ts`: `tests/unit/curriculum.test.ts` is frozen at its length (#1388). The lists a topic joins are in `tests/unit/helpers/topic-lists.ts`: a Year 2 topic adds its id to `Y2_IDS` and its generator to `Y2_GENS`, and a topic whose option sets never recur adds its `<id> d<n>` cells to `NO_REPEATED_SET`; the suite is red until it does (#1411).
5. If the topic needs a new visual, add a case to `src/ui/visuals.ts` + CSS in `style.css`, then `npm run test:e2e`.
6. Add the topic to `docs/CURRICULUM.md` — the issue closes with the pull request (`Closes #<n>`).
