---
paths:
  - "src/curriculum/year3-topics.ts"
  - "src/curriculum/year4-topics.ts"
  - "src/curriculum/year5-topics.ts"
  - "src/curriculum/year6-topics.ts"
  - "src/curriculum/ks2num.ts"
  - "src/curriculum/ks2say.ts"
  - "src/curriculum/mistakes.ts"
  - "tests/unit/curriculum-y3.test.ts"
  - "tests/unit/curriculum-y4.test.ts"
  - "tests/unit/curriculum-y5.test.ts"
  - "tests/unit/curriculum-y6.test.ts"
---
# KS2 generators, Years 3–6 (#1314)

Beside `curriculum.md`, which holds the shared rules. Each line names the test that holds it.

- Numbers of four digits or more use commas, but a year never does; the minus sign is U+2212; an answer stays at
  or above its year's `minAnswer` (`ks2-number-labels.test.ts` #1047, `curriculum.test.ts` #1042).
- A label must read at 13px on a 390px phone, and a prompt must fit the card in three lines
  (`ks2-label-size.test.ts` #1046, `ks2-card-budget.test.ts` #1051).
- A built answer has at most 6 slots (`MAX_SLOTS` in `build.ts`, `build.test.ts`).
- A word too long for a bubble goes on the card and the bubbles carry a letter or yes/no
  (`topic-y6-nets.test.ts`). Statutory words of 10+ letters are built from chunks of at most 4 characters
  (`topic-y6-wordlist.test.ts`).
- Misconception decoys come first (`mistakes.ts`, `mistakes.test.ts`). At most 30% of cards may have a units or
  leading digit no other option shares, for whole-number answers of 20 or more and every money or decimal answer
  (`helpers/decoy-leak.ts`, #1058, called from each number topic's own test).
- One generator per `yearN-<slug>.ts`; no year file imports another year's (`curriculum-y3.test.ts`, and y4–y6).
  Each topic's test is `tests/unit/topic-<id>.test.ts`.
- A whole-word bank passes `AVOID` and a local `EXCLUDE` list (`topic-y4-wordlist.test.ts`).
- No notation from a later year, such as decimals in Year 3. No rail holds this one: the reviewer does.
