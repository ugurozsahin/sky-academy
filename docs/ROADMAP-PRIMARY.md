# Roadmap: whole primary school (Reception → Year 6)

Engine stays the same (bubble slicing + sequences + tracing + pictorial visuals). Each new year = a new island with its own topic list; difficulty tables live in `YEARS` (`src/curriculum/types.ts`). Island art per year is owner-generated. KS2 needs two new input modes: **typed answers** (number pad for multi-digit/decimal results) and **drag-to-place** (fractions on a line, angles, grids).

## Phase A — KS1 complete (now → v0.4)
- R/Y1/Y2 maths & writing done (v0.1–v0.3). Remaining KS1: measurement (length/mass/capacity compare), position & direction, Y2 statistics (pictograms, tally), Y1/Y2 reading comprehension mini-questions, phonics phase ordering.

## Phase B — Year 3 & Year 4 (Lower KS2)
Maths NC (statutory): place value to 1000 (Y3) / 10 000 (Y4), Roman numerals to XII (Y3) / C (Y4), rounding, negative numbers (Y4), column add/sub, times tables 3,4,8 (Y3) and all to 12×12 (Y4 — the *Multiplication Tables Check* in June of Y4 makes a timed 12×12 mode a headline feature), formal short multiplication/division, fractions (tenths, equivalent, add/sub same denominator, hundredths & decimals Y4), money £.p, time (12/24-hour, Roman clocks), perimeter (Y3) / area by counting (Y4), angles (right, acute/obtuse), symmetry, coordinates (Y4), bar charts & time graphs.
English: Y3/4 statutory spelling list (100 words), prefixes (dis-, mis-, re-, sub-, inter-, super-, anti-, auto-), suffixes (-ation, -ly, -ous), homophones set, apostrophes for plural possession, fronted adverbials with commas, direct speech punctuation, word classes (noun/verb/adjective/adverb/pronoun/determiner), paragraphs.
Game additions: typed-answer bubbles ("build the answer" — slice digits in order, reuses sequence mode), Roman numeral bubbles, MTC timed sprint (25 questions, 6 s each), fraction wall visual, coordinate grid visual.

## Phase C — Year 5 & Year 6 (Upper KS2)
Maths: numbers to 1 000 000 / 10 000 000, powers of 10, prime/square/cube numbers, factors & multiples, long multiplication & division, fractions × ÷, percentages, ratio (Y6), algebra (Y6: simple formulae, sequences), decimals to 3 dp, converting units, area/volume, angles in triangles/quadrilaterals, reflection/translation, pie charts & mean (Y6). SATs-style arithmetic paper practice mode (Y6).
English: Y5/6 spelling list (100 words), -cious/-tious, -able/-ible, silent letters, hyphens, modal verbs, relative clauses, passive voice, semicolons/colons/dashes, subjunctive; SPaG-test style questions.
Game additions: multi-step "combo" questions (two bubbles in sequence), boss battles per unit, timed SATs sprint, parent report export.

## Cross-cutting
- Adaptive difficulty: per-topic mastery (stars + accuracy history) nudges d1→d3 and chooses Sky Storm pools.
- Rewards: ninja coins → sticker album (done v0.3) → costumes/blade skins → island decorations.
- Accessibility: read-aloud everywhere, dyslexia-friendly font toggle, colour-safe bubbles, reduced motion.
- Content pipeline: every topic is a pure generator + generic test suite; years are data, not code paths.
