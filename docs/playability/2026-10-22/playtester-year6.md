# Playability: playtester-year6, 2026-10-22

Scored by the `playtester-year6` profile under the `playtest` skill (`.claude/skills/playtest/SKILL.md`) from each game's play pack, and written into `src/config/catalogue.json` by `scripts/playability-apply.mjs` (#2206): a year profile's score is the game-year node's `games.<id>.years.<year>.playability`.

| Game | Year | Score | Note |
|---|---|---|---|
| y6-pv | year6 | 8 | Exactly the Year 6 place-value question with honest wrong answers; later stages squeeze the reading time. |
| y6-round | year6 | 8 | Good Year 6 rounding with realistic wrong answers; fine at stage 1, rushed from stage 3. |
| y6-negative | year6 | 7 | Temperature intervals across zero pitched right, but a wordy line each wave leaves little time once the stages speed up. |
| y6-longmult | year6 | 7 | Brisk and varied, but every wave can be solved by rounding, so it never practises the formal long multiplication it claims. |
| y6-longdiv | year6 | 7 | Proper Year 6 division with sensible distractors, but long division done in the head against a falling bubble becomes a guess by stage 3. |
| y6-mental | year6 | 8 | Big-number mental addition right for Year 6, with tiny bubble labels and a tight finish at stage 3. |
| y6-factors | year6 | 8 | A fair, well-paced prime hunt with tempting decoys like 1 and 33, though every question in the stage is the same task and a wrong slice is not explained. |
| y6-order-ops | year6 | 8 | Order of operations with the left-to-right trap as a distractor; fair speed, but a wrong slice never shows which step comes first. |
| y6-story | year6 | 4 | A proper SATs-style problem with no time to solve it; a Year 6 child would feel set up to fail. |
| y6-simplify | year6 | 8 | Well-built fractions game with honest wrong answers; it needs a little more time, especially in later stages. |
| y6-fracadd | year6 | 8 | Proper Year 6 fraction addition with honest distractors, but from stage 3 the bubbles leave before a child can find a common denominator. |
| y6-fracmult | year6 | 8 | Simple pairs of proper fractions as the curriculum asks, with misconception distractors; the late stages squeeze the thinking time. |
| y6-fracdiv | year6 | 8 | Exactly the Year 6 statement with distractors that catch real misconceptions; quick enough at first, tight by stage 3. |
| y6-fdp | year6 | 7 | Fraction-as-division is on the Year 6 list, but the hint hands over the answer so it is too easy. |
| y6-decimals | year6 | 7 | The right three-decimal-place question, but the long wording and fast later stages squeeze the thinking time. |
| y6-decmult | year6 | 7 | Well-chosen wrong answers for decimal multiplication, but the later stages are too quick for the working. |
| y6-decdiv | year6 | 7 | Good Year 6 remainders-as-decimals practice, but quick stages leave no time for the division. |
| y6-ratio | year6 | 6 | Right Year 6 ratio problems, but a worded question gets about five seconds, which turns reasoning into guessing. |
| y6-percentof | year6 | 8 | Clear, quick percentage practice; the last stages will be tight once the percentages need building up. |
| y6-formulae | year6 | 8 | Proper Year 6 formula substitution with honest wrong answers, but the timer is tight even at stage 1. |
| y6-sequences | year6 | 7 | Quick and clear, but next-term questions sit below what Year 6 sequences ask for. |
| y6-algebra | year6 | 8 | Proper Year 6 missing-number algebra, but from stage 3 the bubbles leave before a child can read and work it out. |
| y6-twounknowns | year6 | 5 | Algebra in name only at stage 1, and too much to read before the bubbles drop. |
| y6-convert | year6 | 8 | Solid Year 6 unit conversion with realistic wrong answers, though the later stages are too fast for the working. |
| y6-areaperim | year6 | 6 | Called same area, different perimeter, but it is a Year 4 times-table match with no perimeter in it. |
| y6-area | year6 | 7 | Right Year 6 area work with good distractors, but the later stages fly too fast and a wrong answer never shows the halving. |
| y6-volume | year6 | 8 | Excellent Year 6 volume questions with clever wrong answers, held back by a tight timer. |
| y6-nets | year6 | 5 | Called nets but asks Year 2 face-counting questions, and the long question line leaves too little time to answer. |
| y6-missingangles | year6 | 7 | A clear Year 6 angle task with good diagrams; the changing question line eats the flight time in later stages. |
| y6-circles | year6 | 8 | Clear, test-style parts-of-a-circle questions, though the later stages leave too little time to match a letter to the picture. |
| y6-coords | year6 | 6 | Real four-quadrant practice with honest distractors, let down by crowded point labels and a fast later pace. |
| y6-transform | year6 | 6 | A good four-quadrant translation task under a reflection title, with the bubbles gone before the move can be counted. |
| y6-pie | year6 | 5 | Too easy for Year 6 pie charts, and colour names on the wrong colours muddle the picture. |
| y6-graphs | year6 | 5 | A worthwhile conversion-graph task, but the unlabelled axes and a flight shorter than the reading time make it a guess. |
| y6-mean | year6 | 8 | Clear Year 6 mean questions with the sum and median as distractors, though the numbers vanish when the answer is shown. |
| y6-inference | year6 | 6 | Inference from actions is the right skill, but the feelings are obvious for Year 6 and each wave waits ten seconds for the voice. |
| y6-figurative | year6 | 5 | Simile or metaphor is fair Year 6 content, but the two-way guess with a giveaway hint is too thin, and reading the sentence uses up the time. |
| y6-ough | year6 | 7 | Proper Year 6 spellings, but the joke misspellings make it too easy and the later stages leave too little time to read the sentence. |
| y6-homophones | year6 | 7 | The right Year 6 homophones, but with two bubbles and shrinking flight times it slides towards guessing. |
| y6-wordlist | year6 | 6 | Proper Year 5–6 statutory spellings, spoken clearly, but the decoy letters never tempt a real misspelling and a slip is not explained. |
| y6-spellgap | year6 | 6 | Right statutory words, read aloud in a sentence, but the sentence never appears on screen, the decoy letters are random and the last stages run slightly too fast for twelve small letter bubbles. |
| y6-formal | year6 | 5 | Formal vocabulary suits Year 6, but the wrong answers do not test formality and the lettered list takes too long to read. |
| y6-synonyms | year6 | 6 | Clear and lively, but the words are easy for Year 6 and the reading only just fits. |
| y6-passive | year6 | 5 | Good Year 6 grammar point, but a two-way guess with too little time to read the sentence. |
| y6-subjunctive | year6 | 6 | Spot-on Year 6 subjunctive questions, but the sentence alone takes longer to read than the bubbles stay up. |
| y6-cohesion | year6 | 6 | Good Year 6 linking phrases, but reading four options and a question before the bubbles fall is not possible in the time. |
| y6-clauses | year6 | 5 | The right Year 6 punctuation, but the sentence takes too long to read on the timer and the hint gives the answer away. |
| y6-lists | year6 | 6 | Good colon-before-a-list practice, but the sentence takes most of the flight to read, so many slices are guesses. |
| y6-hyphen | year6 | 6 | Spot-on grammar content, but two sentences to read before a 5-second flight ends turns it into guessing. |
| y6-subjectobject | year6 | 5 | Year 6 terminology on very simple sentences, with too little time to read them. |
| y6-consistency | year6 | 6 | Is, are or am after a singular noun is far too easy for Year 6 and feels babyish. |

## Distribution

| Score | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rows | 0 | 0 | 0 | 0 | 1 | 9 | 13 | 12 | 16 | 0 | 0 |

51 rows · 8 or above: 16 of 51 (31%).

## Evidence

### y6-pv, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 'What is the value of the 6 in 6,213,334?' in large text; speech autoplays but is cut off by the next line (metrics.json#speechOutlastedWave)
- physical — `metrics.json#aboveCardMs.min`: need 6.73 s, reach 5.30 s, 79% at stage 1: 2.5 s floor + 7 words (3.23 s) + 1 step (find the digit's column); radius 41 px, '6,000,000' legible in 4-apex.webp
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.30 × 3.4 / 5.6 = 3.22 s, 48% of the need
- challenge — `4-apex.webp`: 6, 60,000, 600,000, 6,000,000: the digit itself and the wrong column are the real Year 6 errors; numbers to 10 million is the Year 6 statement
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; a new seven-digit number each wave

### y6-round, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 'Round 168,954 to the nearest 10,000' in large text; speech autoplays but is cut off (metrics.json#speechOutlastedWave)
- physical — `metrics.json#aboveCardMs.min`: need 5.35 s, reach 5.38 s, 101% at stage 1: 2.5 s floor + 4 words (1.85 s) + 1 step (look at the thousands digit); radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.38 × 3.4 / 5.6 = 3.27 s, 61% of the need
- challenge — `4-apex.webp`: 170,000, 160,000, 200,000, 169,000: rounding down, the wrong power of ten and the nearest 1,000 are real Year 6 slips
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; a new number each wave

### y6-negative, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "How many degrees from −6 °C to 1 °C?" in large type, spoken
- physical — `metrics.json#aboveCardMs.min`: need 6.73 s (floor 2.5 + 7-word question line whose numbers change each wave, 3.23 + working 1 step: 6 up to zero, then 1 more), reach 5.333 s, 79% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.333 × 3.4 / 5.6 = 3.24 s, 48% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 7, 5 (6 − 1), 6, 8: the across-zero slips; intervals across zero is the Y6 statement
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: answer 11 shown in green; no number line to show the jump across zero
- again — `metrics.json#settings.speeds`: stage 3 leaves under half the reading-and-working time
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-longmult, year6: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: 62 × 18 = ?, spoken
- physical — `metrics.json#aboveCardMs.min`: need 4.5 s (floor 2.5 + no words + working 2 steps: estimate 60 × 20, check the last digit), reach 4.883 s, 109% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 4.883 × 3.4 / 5.6 = 2.96 s, 66% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- physical — `4-apex.webp`: "11,160" and "1,116" legible but small inside the bubble
- challenge — `metrics.json#bubbleLabels`: 11,160, 1,116, 496, 558: an estimate of 1,200 picks the answer, so the formal method is never needed
- challenge — `5-wrong.webp`: wave 2: 3,510 vs 35,100, again settled by estimation
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 is a new product, 65 × 54

### y6-longdiv, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 870 ÷ 15 = ?, "Long and Short Division" title, spoken
- physical — `metrics.json#aboveCardMs.min`: need 6.5 s (floor 2.5 + no words + working 4 steps: 15 × 5, 87 − 75, bring down to 120, 120 ÷ 15), reach 5.25 s, 81% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.25 × 3.4 / 5.6 = 3.19 s, 49% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 580 (place value), 48, 59 (off by one): real long-division slips; wave 2 is 2,700 ÷ 25
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"
- again — `metrics.json#settings.speeds`: stage 3 leaves under half the working time: a reasoning question on a recall timer
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-mental, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 4,950,000 + 850,000 = ? in large digits
- understand — `metrics.json#speechOutlastedWave`: true: the voice reading the big numbers outlasted the wave, but the sum needs no speech
- physical — `metrics.json#aboveCardMs.min`: need 4.5 s (floor 2.5 + no words + working 2 steps: 950 + 850 thousand, then add the 4 million), reach 5.1 s, 113% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.1 × 3.4 / 5.6 = 3.10 s, 69% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- physical — `4-apex.webp`: seven-digit labels fit inside the bubbles but in small type
- challenge — `metrics.json#bubbleLabels`: 580,000 (place value) and 4,100,000 (subtracted) are real errors; 5,800,010 is a giveaway
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 is 1,900,000 + 840,000

### y6-factors, year6: 8/10

understand 2 · physical 2 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 'Slice every prime number' in large type, three blanks showing how many to find, 'Slice them all' under it
- understand — `metrics.json#speechAutoplays`: true: 'Slice every prime number' spoken by itself and finished (metrics.json#speechFinished)
- physical — `metrics.json#labelReachMs.min`: need 5.9 s = 2.5 s floor + 0 for bubble words (numerals, metrics.json#bubbleWords 0) + 0 for the question line (metrics.json#promptFixed true, read once) + 1.4 s for the 3-word hint 'Slice them all' (replaced by the feedback line in 5-wrong.webp, so counted, 130 wpm) + working: 2 steps (test a two-digit number against 3 and 7) = 2 s; reach 12.48 s (label 47), 212% at stage 1
- physical — `metrics.json#settings.speeds`: not gentle, sequence eases 1,2,3,3,3 to 1,1,2,2,2; stage 3 at eased speed 2: 12.48 × 4.4 / 5.6 = 9.81 s, 166% of the need
- physical — `metrics.json#bubbleRadiusPx`: 30 px radius: at the comfortable size; two-digit numbers legible and bubbles well spaced in 4-apex.webp
- challenge — `metrics.json#bubbleLabels`: primes 41, 43, 47 among 46, 1, 15, 33: 1 and 33 are the mistakes a child really makes (1 counted as prime, 33 looks prime); 46 is an easy reject
- challenge — `metrics.json#settings.diffs`: diffs rise 1,2,2,3,3; Year 6 'identify common factors, common multiples and prime numbers': primes seen, factors and multiples not observed in stage 1
- feedback — `5-wrong.webp`: 'Not this time. The answer is 19,23,47' in green, tick on 19, cross on 1; why 1 is not prime is not said
- again — `6-result.webp`: Stage 1 clear, two stars, 'Fast thinking, Ada.', 71% correct, rank ladder: a reward this child reads
- again — `metrics.json#promptFixed`: true over 7 questions (metrics.json#promptWaves): the same 'Slice every prime number' all stage, only the numbers change: samey

### y6-order-ops, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 26 + 20 ÷ 2 = ?; the ÷ dots are faint at phone size, but the voice says "divided by"
- understand — `metrics.json#speechAutoplays`: true
- physical — `metrics.json#aboveCardMs.min`: need 3.5 s (floor 2.5 + no words + working 1 step: 20 ÷ 2 recalled, then 26 + 10), reach 5.333 s, 152% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.333 × 3.4 / 5.6 = 3.24 s, 93% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 23 is (26 + 20) ÷ 2, the left-to-right mistake order of operations targets
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"; does not show that ÷ went first
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 is 24 − 8 ÷ 8

### y6-story, year6: 4/10

understand 1 · physical 0 · challenge 2 · feedback 1 · again 0

- understand — `2-prompt.webp`: 'A hall has 5,447.' leaves out what the hall has until 'Seats left?'; the speech reads it as 'Seats left what' and is cut off (metrics.json#speechOutlastedWave)
- physical — `metrics.json#aboveCardMs.min`: need 10.19 s, reach 5.12 s, 50% at stage 1: 2.5 s floor + 8 words (3.69 s) + 4 steps (add 1,456 and 2,476 with carries, subtract from 5,447)
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.12 × 3.4 / 5.6 = 3.11 s, 30% of the need
- challenge — `4-apex.webp`: 1,515 right, 1,535 a carrying slip, 3,991 one step only, 6,467 added: genuine Year 6 multi-step errors
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; no working shown
- again — `4-apex.webp`: four-digit, two-step problems vanish in about five seconds: stressful, the child times out rather than thinks; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-simplify, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 'Write 4/32 in its simplest form' with hint 'Divide top and bottom by the same number'; speech autoplays and ends before the wave does
- physical — `metrics.json#aboveCardMs.min`: need 5.81 s, reach 5.05 s, 87% at stage 1: 2.5 s floor + 5 words (2.31 s) + 1 step (spot the common factor and divide); radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.05 × 3.4 / 5.6 = 3.07 s, 53% of the need
- challenge — `4-apex.webp`: 2/16 (not fully simplified), 8/1 (upside down), 1/9: the mistakes Year 6 pupils really make when simplifying with common factors
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; dividing by 3 is not shown
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-fracadd, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 3/8 + 1/2 = ?, no words, method hint under it, speaker shown
- understand — `metrics.json#speechAutoplays`: true: the prompt is spoken by itself
- physical — `metrics.json#aboveCardMs.min`: need 4.5 s (floor 2.5 + no words + working 2 steps: turn 1/2 into 4/8, add the tops), reach 5.1 s, 113% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.1 × 3.4 / 5.6 = 3.10 s, 69% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 4/10 (adds tops and bottoms) and 4/8 (adds tops only) are the classic errors; unlike denominators is the Y6 statement
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3: rises across stages
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"; the method hint is replaced by the answer line
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 switches to subtraction, 2/5 − 3/10

### y6-fracmult, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 1/7 × 1/2 = ?, hint "Multiply the tops, multiply the bottoms, then simplify"
- understand — `metrics.json#speechAutoplays`: true
- physical — `metrics.json#aboveCardMs.min`: need 3.5 s (floor 2.5 + no words + working 1 step: multiply tops and bottoms, both recalled facts), reach 5.3 s, 151% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.3 × 3.4 / 5.6 = 3.22 s, 92% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 2/9 (adds both), 1/9 (adds bottoms), 2/7: real errors; simple pairs of proper fractions, the Y6 statement
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 is 1/6 × 1/2

### y6-fracdiv, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 1/7 ÷ 2 = ?, method hint under it; ÷ dots are faint at phone size but the voice says "divided by"
- understand — `metrics.json#speechAutoplays`: true
- physical — `metrics.json#aboveCardMs.min`: need 3.5 s (floor 2.5 + no words + working 1 step: multiply the bottom by 2), reach 5.3 s, 151% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.3 × 3.4 / 5.6 = 3.22 s, 92% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 1/5 (7 − 2), 1/9 (7 + 2), 2/7 (multiplied instead): the mistakes Y6 make dividing a fraction by a whole number
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer shown in green in the sum and on its bubble, a heart lost; no worked step, only "Not this time. The answer is"
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; wave 2 is a new fraction, 1/6 ÷ 2

### y6-fdp, year6: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: "1 ÷ 8 as a fraction", fraction bubbles legible
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 3 words 1.38 + 0 steps (the hint states the rule) = 3.88 s; reach 5.08 s, 131%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.08 × 3.4 / 5.6 = 3.09 s, 79% of the need
- challenge — `2-prompt.webp`: hint "The first number is the top, the second is the bottom" gives the answer; 3/8 and 2/8 are giveaways, only 8/1 is a real slip
- feedback — `5-wrong.webp`: "Not this time. The answer is 2/3, no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; the card behind it shows a second form, "Which division gives 1/7?"

### y6-decimals, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "What is the value of the 5 in 58.474?" with "Which column is the digit in?"
- physical — `metrics.json#aboveCardMs.min`: line changes each wave, counted: need 2.5 + 7 words 3.23 + 1 step (name the column) = 6.73 s; reach 5.30 s, 79%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.30 × 3.4 / 5.6 = 3.22 s, 48% of the need
- challenge — `5-wrong.webp`: 0.002 against 0.02 is the right three-place test; wave 1 (the 5 in 58.474 = 50) is only whole-number place value
- feedback — `5-wrong.webp`: "Not this time. The answer is 0.002, no column named", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same "value of the digit" form

### y6-decmult, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "5.8 × 2 = ?" with the hint "multiply as if there were no point"
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 0 words + 2 steps (58 × 2 = 116, place the point) = 4.5 s; reach 5.15 s, 114%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.15 × 3.4 / 5.6 = 3.13 s, 69% of the need
- challenge — `4-apex.webp`: 116 (point lost) and 10.16 (whole and tenths multiplied apart) are classic errors; Year 6 decimal × whole number
- feedback — `5-wrong.webp`: "Not this time. The answer is 15.6 filled into "2.6 × 6 =", no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same form

### y6-decdiv, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "59 ÷ 2 = ?" with a hint on carrying past the point
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 0 words + 2 steps (29 r 1, remainder to .5) = 4.5 s; reach 5.20 s, 116%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.20 × 3.4 / 5.6 = 3.16 s, 70% of the need
- challenge — `4-apex.webp`: 29.1 (remainder written as a digit) and 295 are real mistakes; remainders as decimals is Year 6; diffs rise
- feedback — `5-wrong.webp`: "Not this time. The answer is 3.6 filled into "18 ÷ 5 =", no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same division form

### y6-ratio, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: worded ratio problem with hint 'Find how many groups, then multiply'; readable, though 'there are 1 dog' is ungrammatical and speech is cut off (metrics.json#speechOutlastedWave)
- physical — `metrics.json#aboveCardMs.min`: need 8.12 s, reach 5.30 s, 65% at stage 1: 2.5 s floor + 10 words (4.62 s) + 1 step (42 ÷ 6, then × 1); wave 2's 13-word beads problem (5-wrong.webp) is longer still
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.30 × 3.4 / 5.6 = 3.22 s, 40% of the need
- challenge — `4-apex.webp`: 7 right, 42 echoes the question, 8 and 37 near misses; ratio in recipes and groups is Year 6
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; no worked groups shown
- again — `metrics.json#aboveCardMs.min`: a reasoning question on a recall timer: most waves fall before a careful child has worked them out; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-percentof, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: '10% of 40 = ?' with the hint 'Find ten per cent first, then build up'; speech autoplays
- physical — `metrics.json#aboveCardMs.min`: need 3.96 s, reach 5.37 s, 135% at stage 1: 2.5 s floor + 1 word (0.46 s) + 1 step (divide by 10); radius 33 px, comfortable
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.37 × 3.4 / 5.6 = 3.26 s, 82% of the need, and harder percentages there need more steps
- challenge — `4-apex.webp`: 10, 20, 4, 36: echoing the 10, doubling and subtracting are real slips; percentages of amounts is Year 6, and metrics.json#settings.diffs rises 1 to 3
- feedback — `5-wrong.webp`: '10% of 60 = 6' filled in and the answer named; the 'find ten per cent' hint is not shown as the reason; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-formulae, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: "y = n + 4. What is y when n = 25?", spoken by itself (metrics.json#speechAutoplays)
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 7 words 3.23 + 1 step (substitute, 25 + 4) = 6.73 s; reach 5.35 s, 79%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.35 × 3.4 / 5.6 = 3.25 s, 48% of the need
- challenge — `4-apex.webp`: 21 (subtracted) and 254 (digits joined) are real substitution errors; Year 6 simple formulae; diffs rise
- feedback — `5-wrong.webp`: "Not this time. The answer is 20 for y = 4 × n, n = 5, no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; wave 1 adds, wave 2 multiplies

### y6-sequences, year6: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: '29, 31, 33, 35, ?' needs no reading; the question mark says what to find
- physical — `metrics.json#aboveCardMs.min`: need 3.5 s, reach 5.40 s, 154% at stage 1: 2.5 s floor + no words + 1 step (find the difference and add it); radius 33 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.40 × 3.4 / 5.6 = 3.28 s, 94% of the need
- challenge — `2-prompt.webp`: next term of a +2 or +4 sequence (5-wrong.webp) is lower key stage 2; Year 6 asks pupils to generate and describe a rule; later stages not observed
- feedback — `5-wrong.webp`: sequence completed with 30 in green and the answer named; the +4 step is not shown; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-algebra, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: "2 × n = 22. What is n?", 4 words, spoken by itself (metrics.json#speechAutoplays)
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 4 words at 130 wpm (cautious) 1.85 + working 1 step (22 ÷ 2) = 5.35 s; reach 5.37 s, 100%; radius 33 px, above the 30 px comfortable size
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.37 × 3.4 / 5.6 = 3.26 s, 61% of the need
- challenge — `4-apex.webp`: distractor 44 (multiplied instead of divided) is a real mistake; wave 2 n − 38 = 57 in 5-wrong.webp; diffs 1,2,2,3,3 rise
- feedback — `5-wrong.webp`: "Not this time. The answer is 95", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; waves vary the operation (× then −)

### y6-twounknowns, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: 'a + b = 14. Which pair could a and b be?' is clear; speech autoplays and ends before the wave
- physical — `metrics.json#aboveCardMs.min`: need 9.50 s, reach 5.20 s, 55% at stage 1: 2.5 s floor + 9 words and 4 bubble words (6.00 s) + 1 step (add each pair); 'and' labels are small inside 41 px bubbles (4-apex.webp)
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.20 × 3.4 / 5.6 = 3.16 s, 33% of the need
- challenge — `4-apex.webp`: 13 and 3, 12 and 2, 13 and 2, 14 and 2: checking which pair makes 14 is a number bond; the two-unknowns idea in Year 6 is listing all the pairs
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `5-wrong.webp`: the same question shape every wave, 'Which pair could a and b be?'; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-convert, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: "4.9 cm = ? mm" with a multiply/divide hint; number bubbles legible
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 2 words 0.92 + 1 step (× 10, shift the point) = 4.42 s; reach 5.08 s, 115%; radius 41 px, 220,800 legible in 5-wrong.webp
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.08 × 3.4 / 5.6 = 3.09 s, 70% of the need
- challenge — `4-apex.webp`: 490 / 4,900 / 49 / 4.9 and 220,800 / 22,080 are place-value slips children make; 2.208 km to m matches the Year 6 three-decimal-place statement
- feedback — `5-wrong.webp`: "Not this time. The answer is 2,208 filled into the equation, no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; units change between waves (cm to mm, km to m)

### y6-areaperim, year6: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Same area as 3 × 8?" with hint "Multiply to find each area"; bubbles are products, clear
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 3 words 1.38 + working 2 steps (recall 24, compare the other products) = 5.88 s; reach 5.38 s, 92%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.38 × 3.4 / 5.6 = 3.27 s, 56% of the need
- challenge — `4-apex.webp`: only times-table recall (3 × 5, 7 × 6, 1 × 10 are far from 24, giveaways); no perimeter is ever asked, so it misses its Year 6 statement
- feedback — `5-wrong.webp`: "Not this time. The answer is 10 × 2 (no "= 20" shown)", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same product-matching form

### y6-area, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Triangle area = ? cm²" with a clear labelled right-angled triangle, 9 cm and 8 cm
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 2 words 0.92 + working 1 step (8 × 9 = 72 recalled, then halve) = 4.42 s; reach 5.23 s, 118%; radius 33 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.23 × 3.4 / 5.6 = 3.18 s, 72% of the need
- challenge — `4-apex.webp`: 72 (forgot to halve) is the classic mistake; base × height ÷ 2 matches the Year 6 statement; diffs rise 1 to 3
- feedback — `5-wrong.webp`: "Not this time. The answer is 21 (filled into the equation); the halving hint is replaced", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both observed waves are right-angled triangles, same form

### y6-volume, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: 'A box is 2 cm × 6 cm × 9 cm. Volume?' with the formula as a hint; speech is cut off (metrics.json#speechOutlastedWave) but the text is enough
- physical — `metrics.json#aboveCardMs.min`: need 6.73 s, reach 5.22 s, 77% at stage 1: 2.5 s floor + 7 words (3.23 s) + 1 step (2 × 6 recalled, then 12 × 9); radius 41 px, 'cm³' legible
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.22 × 3.4 / 5.6 = 3.17 s, 47% of the need
- challenge — `4-apex.webp`: 12 cm³ (two sides), 17 cm³ (added), 108 cm² (wrong unit): the real Year 6 volume mistakes
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; no multiplication shown
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; new dimensions each wave

### y6-nets, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "How many faces does a square-based pyramid have?", plain words, spoken
- physical — `metrics.json#aboveCardMs.min`: need 7.19 s (floor 2.5 + 8-word question line that changes each wave, 3.69 + working 1 step: picture the solid and count), reach 5.266 s, 73% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.266 × 3.4 / 5.6 = 3.20 s, 45% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- challenge — `5-wrong.webp`: "How many faces does a cube have?": counting faces is a Y2 statement; no net appears in the game called Nets
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3; whether later stages show nets is not observed
- feedback — `5-wrong.webp`: answer 6 shown in green; no picture of the solid or its net
- again — `4-apex.webp`: cube and pyramid face counts feel babyish to a Y6 child
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-missingangles, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: prompt names the rule, diagram marks 45° and ?, hint "Angles on a straight line make a half turn"
- understand — `5-wrong.webp`: wave 2 prompt wraps a lone "°" onto its own line
- physical — `metrics.json#aboveCardMs.min`: need 6.27 s (floor 2.5 + 6-word question line that changes each wave, 2.77 + working 1 step: 180 − 45), reach 5.116 s, 82% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.116 × 3.4 / 5.6 = 3.11 s, 50% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 45° (the vertically opposite angle), 135°, 90°, 150°; straight-line and opposite angles are the Y6 statement
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right angle shown in green, diagram kept; no step like 180 − 100
- again — `metrics.json#settings.speeds`: stage 3 leaves under half the need to read the changing question
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-circles, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: "Which is the diameter?" with a labelled circle and hint "Across, through the centre"; letter bubbles match the labels
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + 4 words 1.85 + 3 bubble letters counted as words (metrics.json#bubbleWords, cautious) 1.38 + 1 step (find the line through the centre) = 6.73 s; reach 5.23 s, 78%; radius 33 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.23 × 3.4 / 5.6 = 3.18 s, 47% of the need
- challenge — `5-wrong.webp`: radius versus diameter, the real confusion; matches the Year 6 parts-of-a-circle statement; diffs rise 1 to 3
- feedback — `5-wrong.webp`: "Not this time. The answer is A; the diagram stays but line A is not highlighted", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; wave 1 asks diameter, wave 2 radius

### y6-coords, year6: 6/10

understand 1 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `5-wrong.webp`: grid fills half the screen (metrics.json#cardShareOfScreen 0.49); points A and B sit side by side with their labels touching, so which dot is B is unclear
- physical — `metrics.json#aboveCardMs.min`: question line the same ("coordinates of B") in 2-prompt and 5-wrong, not counted; need 2.5 + 2 steps (read x, read y with signs) = 4.5 s; reach 5.12 s, 114%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.12 × 3.4 / 5.6 = 3.11 s, 69% of the need
- challenge — `4-apex.webp`: (−1, 4) swapped, (−4, −1) and (4, 1) sign slips: the real four-quadrant mistakes; diffs rise
- feedback — `5-wrong.webp`: "Not this time. The answer is (−2, 1) shown on the card, but the point is not marked on the grid", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same "coordinates of B" form

### y6-transform, year6: 6/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: coordinate grid with the point marked, '(−1, −2) moves 3 right, 1 down. Now at?' and a direction hint; card covers half the screen (metrics.json#cardShareOfScreen 0.51)
- physical — `metrics.json#aboveCardMs.min`: need 6.81 s, reach 5.00 s, 73% at stage 1: 2.5 s floor + 5 words (2.31 s) + 2 steps (x across, y down); bubbles bunch just under the card in 4-apex.webp
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.00 × 3.4 / 5.6 = 3.04 s, 45% of the need
- challenge — `2-prompt.webp`: the card is titled 'Reflect in the Axes' but both observed waves are translations; the wrong answers (−4, −3), (2, −1) are real direction slips
- feedback — `5-wrong.webp`: answer (−2, 0) named, but the point is not moved on the grid to show why; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; a new point and move each wave

### y6-pie, year6: 5/10

understand 1 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `5-wrong.webp`: sector labels name colours that are not their own colour ('yellow' on the green slice, 'red' on the blue slice) and the bubbles are different colours again, which confuses
- physical — `metrics.json#aboveCardMs.min`: need 5.35 s, reach 5.02 s, 94% at stage 1: 2.5 s floor + 4 bubble words (1.85 s) + 1 step (find the biggest slice, read its label); fixed question line read once
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.02 × 3.4 / 5.6 = 3.05 s, 57% of the need
- challenge — `2-prompt.webp`: 'Which was chosen most?' is reading the biggest slice, a lower key stage 2 skill; Year 6 pie charts mean fractions and percentages of the whole; later stages not observed
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `5-wrong.webp`: the same question, 'Which was chosen most?', on both waves; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-graphs, year6: 5/10

understand 1 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: line graph with no axis labels: nothing says which axis is km and which is miles
- understand — `metrics.json#speechOutlastedWave`: true: the voice was still reading when the wave had gone
- physical — `metrics.json#aboveCardMs.min`: need 7.73 s (floor 2.5 + 7-word question line that changes each wave, 3.23 at 130 wpm + working 2 steps: find 24 on the x axis, read across to the y axis), reach 5.3 s, 69% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.3 × 3.4 / 5.6 = 3.22 s, 42% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 15, 20, 24, 21: 24 copies the km value, the real mistake; conversion graphs are Y6 statistics and measurement
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right answer filled into the sentence in green, graph kept; no line drawn to show the reading
- again — `5-wrong.webp`: the same 0–40 graph as wave 1, only the km value changes
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; the bubbles leave before the question and graph can be read

### y6-mean, year6: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `2-prompt.webp`: "Mean of the numbers?" with "Numbers: 2, 10, 12" in a small grey line; spoken
- physical — `metrics.json#aboveCardMs.min`: need 4.96 s (floor 2.5 + question line the same each wave, 0 + 1-word card line "Numbers:", 0.46 + working 2 steps: sum to 24, divide by 3), reach 5.4 s, 109% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.4 × 3.4 / 5.6 = 3.28 s, 66% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- challenge — `metrics.json#bubbleLabels`: 8, 24 (the sum), 12 (the largest), 10 (the middle): the real mean mistakes
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: answer 8 shown in green, but the answer line replaces the numbers, so the child cannot check it
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name; the numbers change every wave

### y6-inference, year6: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "How did Jo feel?" over a 23-word passage, spoken aloud
- understand — `metrics.json#promptLeadMs`: 10416: the wave waits for the voice to finish the passage
- physical — `metrics.json#aboveCardMs.min`: need 4.88 s (floor 2.5 + 3 bubble words, 1.38 + working 1 step: infer the feeling; passage and question read in the 10.4 s before launch, not counted), reach 5.2 s, 107% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.2 × 3.4 / 5.6 = 3.16 s, 65% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `4-apex.webp`: stormed, slammed, clenched fists → angry vs lonely, relieved: the answer gives itself away for Y6
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3; later passages not observed
- feedback — `5-wrong.webp`: right feeling shown in green; no clue words highlighted to show why
- again — `metrics.json#promptLeadMs`: a 10.4 s wait before every wave: slow for a Y6 player
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-figurative, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "S simile or M metaphor?" with the sentence and "Is there a like or an as?"; S and M bubbles match
- physical — `metrics.json#aboveCardMs.min`: question line the same in 2-prompt and 5-wrong, not counted; need 2.5 + sentence 6 words 2.77 + 2 bubble letters (metrics.json#bubbleWords) 0.92 + 1 step (look for like/as) = 7.19 s; reach 5.37 s, 75% rounded, 74.6% exact
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.37 × 3.4 / 5.6 = 3.26 s, 45% of the need
- challenge — `4-apex.webp`: two choices only, and the hint gives the like/as test away; in range for upper KS2 but a coin toss
- feedback — `5-wrong.webp`: "Not this time. The answer is M, with no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; same two-choice form every wave

### y6-ough, year6: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: gap sentence with a fixed line 'Which spelling fits the sentence?'; speech plays by itself (metrics.json#speechAutoplays)
- physical — `metrics.json#aboveCardMs.min`: need 6.65 s, reach 5.30 s, 80% at stage 1; 2.5 s floor + 6-word sentence and 3 bubble words at 130 wpm (4.15 s), working: 0 steps, a spelling recalled; radius 41 px, comfortable
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.30 × 3.4 / 5.6 = 3.22 s, 48% of the need
- challenge — `4-apex.webp`: fought / fawt / faught: ough is Year 5–6 spelling, but 'fawt' (and 'touff' in 5-wrong.webp) give themselves away for a Year 6 speller
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; sentences change each wave

### y6-homophones, year6: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 5-word gap sentence (shown twice), "Which spelling fits the sentence?", spoken automatically
- physical — `metrics.json#aboveCardMs.min`: need 6.73 s (floor 2.5 + 5-word line that changes each wave, 2.31 + 2 bubble words, 0.92 + working 1 step: noun or verb), reach 5.3 s, 79% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.3 × 3.4 / 5.6 = 3.22 s, 48% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `4-apex.webp`: license / licence; wave 2 prophecy / prophesy: the Y5–6 spelling appendix pairs
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right spelling filled into the sentence in green; nothing says why (noun -ce, verb -se)
- again — `metrics.json#answersPerWave`: 2: a coin toss once the late stages leave under half the reading time
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-wordlist, year6: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `metrics.json#speechAutoplays`: true: 'Spell the word stomach' spoken by itself and finished (metrics.json#speechFinished); the card never shows the word, as in a spelling test
- understand — `2-prompt.webp`: seven blanks and 'Slice the letters in order'; a second row of blanks above the box is a little odd but harmless
- physical — `metrics.json#labelReachMs.min`: need 9.4 s = 2.5 s floor + 4.6 s for 10 bubble labels (metrics.json#bubbleWords 10 at 130 wpm, cautious end) + 0 for the question line (spoken only, not on the card in 2-prompt.webp) + 2.3 s for the 5-word hint (replaced by the feedback line in 5-wrong.webp, so counted) + working: 0 steps, a recalled spelling; reach 12.05 s (label 'm'), 128% at stage 1
- physical — `metrics.json#settings.speeds`: not gentle, sequence eases 1,2,3,3,3 to 1,1,2,2,2; stage 3 at eased speed 2: 12.05 × 4.4 / 5.6 = 9.47 s, 100% of the need, only just
- physical — `metrics.json#bubbleRadiusPx`: 27 px radius: above the 21 px floor, below the 30 px comfortable size, so a 1
- challenge — `5-wrong.webp`: 'stomach' and 'suggest', both on the statutory Year 5–6 word list; diffs rise 1,2,2,3,3 (metrics.json#settings.diffs)
- challenge — `metrics.json#bubbleLabels`: decoys g, p, x for 'stomach': random letters, no 'k' for the real slip 'stomak', so giveaways
- feedback — `5-wrong.webp`: 'Not this time. The answer is suggest' in green, tick on 's', cross on 'r'; the blanks are not filled and the double g is not pointed out, so no why
- again — `6-result.webp`: Stage 1 clear, two stars, 'Fast thinking, Ada.', 71% correct, rank ladder: a reward this child reads
- again — `metrics.json#labelReach`: a new word each question, but seven letters hunted among ten bubbles with required letters on up to 4 flights (median reach 18.0 s, metrics.json#labelReachMs.median): slow, samey pace

### y6-spellgap, year6: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `metrics.json#speechText`: 'Spell the missing word! The word is suggest. I suggest we go for a walk. The word is suggest.' autoplays and finishes (metrics.json#speechAutoplays, metrics.json#speechFinished)
- understand — `2-prompt.webp`: title 'Spell the missing word', seven blanks, 'Slice the letters in order'; the gap sentence is not on the card, so the 'missing word' is heard only, but the task is clear from the voice
- physical — `metrics.json#labelReachMs.min`: need 10.4 s = 2.5 s floor + 5.5 s for 12 bubble labels (metrics.json#bubbleWords 12 at 130 wpm, cautious end) + 0 for the question line (not on the card in 2-prompt.webp) + 2.3 s for the 5-word hint (replaced by the feedback line in 5-wrong.webp, so counted) + working: 0 steps, a recalled spelling; reach 12.85 s (label 's'), 124% at stage 1
- physical — `metrics.json#settings.speeds`: not gentle, sequence eases 1,2,3,3,3 to 1,1,2,2,2; stage 3 at eased speed 2: 12.85 × 4.4 / 5.6 = 10.10 s, 98% of the need
- physical — `metrics.json#bubbleRadiusPx`: 27 px radius: above the 21 px floor, below the 30 px comfortable size; 12 bubbles a wave (metrics.json#answersPerWave)
- challenge — `5-wrong.webp`: 'suggest' and 'symbol', both on the statutory Year 5–6 word list; diffs rise 1,2,2,3,3 (metrics.json#settings.diffs)
- challenge — `metrics.json#bubbleLabels`: decoys y, q, v, n, i for 'suggest': random letters, not the likely slips (sugest, suggset), so giveaways; with no sentence shown the gap-fill becomes plain dictation
- feedback — `5-wrong.webp`: 'Not this time. The answer is symbol' in green, tick on 's', cross on 'e'; the blanks are not filled and the y-for-i is not pointed out, so no why
- again — `6-result.webp`: Stage 1 clear, two stars, 'Fast thinking, Ada.', 71% correct: a reward this child reads
- again — `metrics.json#labelReach`: a new word each question, but seven letters hunted among twelve bubbles with required letters on up to 4 flights: slow pace for a Year 6 child

### y6-formal, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Formal word for give back?" with A, B, C options on the card; in 5-wrong.webp the words sit on the bubbles instead, a format switch
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + question 5 words 2.31 + card options 3 words 1.38 + 3 bubble letters 1.38 + 1 step = 8.58 s; reach 5.37 s, 63%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.37 × 3.4 / 5.6 = 3.26 s, 38% of the need
- challenge — `2-prompt.webp`: distractors attempt and approximately are formal words too, so only the meaning is tested, not formality; in range
- feedback — `5-wrong.webp`: "Not this time. The answer is assist, with no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; same "formal word for" form each wave

### y6-synonyms, year6: 6/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 2

- understand — `2-prompt.webp`: 'Which word is a synonym of far?' with hint 'A synonym means the same'; speech autoplays and ends before the wave
- physical — `metrics.json#aboveCardMs.min`: need 7.12 s, reach 5.30 s, 74% at stage 1: 2.5 s floor + 7 words and 3 bubble words (4.62 s), working: 0 steps, vocabulary recalled
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.30 × 3.4 / 5.6 = 3.22 s, 45% of the need
- challenge — `4-apex.webp`: distant, damp, near: the antonym is a fair trap but 'damp' (and 'simple' in 5-wrong.webp) is unrelated, and far/brave are lower key stage 2 words
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `6-result.webp`: two stars, 71% correct, score 74, a praise line by name and the next rank named; a new word each wave

### y6-passive, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: 'Slice active or passive' over the sentence, with the hint 'The doer comes first in an active sentence'; speech autoplays
- physical — `metrics.json#aboveCardMs.min`: need 6.73 s, reach 5.07 s, 75% at stage 1: 2.5 s floor + 5-word card sentence and 2 bubble words (3.23 s) + 1 step (is the subject the doer?); wave 2's 7-word sentence (5-wrong.webp) makes the need 7.65 s, 66%; scored at the cautious end of the uncertain 130 wpm
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.07 × 3.4 / 5.6 = 3.08 s, 46% of the 6.73 s need
- challenge — `metrics.json#answersPerWave`: 2 answers: the passive is Year 6 grammar, but half of all slices are right by guessing, and 'The boy kicked the ball' (2-prompt.webp) is easy
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; the hint about the doer is not repeated
- again — `4-apex.webp`: the same two bubbles, active and passive, every wave; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-subjunctive, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 'Which word fits in formal writing?' over a gap sentence and the hint 'It is only imagined, not real'; the sentence wraps awkwardly after 'If I ___' but stays legible
- physical — `metrics.json#aboveCardMs.min`: need 9.50 s, reach 5.05 s, 53% at stage 1: 2.5 s floor + 9-word card sentence and 4 bubble words (6.00 s) + 1 step (is it imagined?); fixed question line read once
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.05 × 3.4 / 5.6 = 3.07 s, 32% of the need
- challenge — `4-apex.webp`: am, was, were, be: 'was' is exactly the informal slip the Year 6 subjunctive statement targets
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost; the hint is not repeated as the reason
- again — `5-wrong.webp`: the same question line every wave, with too little time to read the sentence; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-cohesion, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Which linking phrase shows an addition?" with options A to D listed on the card; letter bubbles match
- physical — `metrics.json#aboveCardMs.min`: need 2.5 + question 6 words 2.77 + card options 10 words 4.62 + 4 bubble letters (metrics.json#bubbleWords) 1.85 + 1 step = 12.73 s; reach 5.33 s, 42%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.33 × 3.4 / 5.6 = 3.24 s, 25% of the need
- challenge — `5-wrong.webp`: moreover, furthermore, for instance, therefore, on the other hand: Year 6 cohesive devices, distractors from other relations; diffs rise
- feedback — `5-wrong.webp`: "Not this time. The answer is C, with no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; reading a four-option list against a falling wave is a reasoning task on a recall timer

### y6-clauses, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Which mark joins these two clauses?" with the gap shown in the sentence; punctuation bubbles fit
- physical — `metrics.json#aboveCardMs.min`: question line the same in 2-prompt and 5-wrong, not counted; need 2.5 + gap sentence 8 words 3.69 + 1 step (can each clause stand alone?) = 7.19 s; reach 5.27 s, 73%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.27 × 3.4 / 5.6 = 3.20 s, 44% of the need
- challenge — `4-apex.webp`: only ?, comma and semicolon offered; the card hint names semicolon, colon and dash, so ; is the only listed mark: the answer gives itself away
- feedback — `5-wrong.webp`: "Not this time. The answer is ; (hint text replaced, no reason given)", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; both waves the same gap-sentence form

### y6-lists, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Which punctuation mark goes in the gap?" with the gap sentence and an orange gap marker
- physical — `metrics.json#aboveCardMs.min`: need 7.65 s (floor 2.5 + question line the same each wave, 0 + 9-word gap sentence, 4.15 + working 1 step: clause then list → colon), reach 5.266 s, 69% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.266 × 3.4 / 5.6 = 3.20 s, 42% of the need
- physical — `metrics.json#bubbleRadiusPx`: radius 33 px, above the 30 px comfortable size
- physical — `4-apex.webp`: colon and semicolon glyphs are small inside the bubbles
- challenge — `metrics.json#bubbleLabels`: ; , : — comma and semicolon are the real slips before a list; Y5–6 colon to introduce a list
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right mark shown as a tiny green ":" in the answer line; no reason given
- again — `5-wrong.webp`: same question line every wave, only the sentence changes
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-hyphen, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Which fits the gap, remark or re-mark?" over the gap sentence; bubbles match the choices
- physical — `metrics.json#aboveCardMs.min`: need 10.88 s (floor 2.5 + 7-word question line that changes each wave, 3.23 + 7-word gap sentence, 3.23 + 2 bubble words, 0.92 + working 1 step: meaning), reach 5.267 s, 48% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.267 × 3.4 / 5.6 = 3.20 s, 29% of the need
- physical — `metrics.json#speechOutlastedWave`: true: the spoken sentence outlasted the wave
- physical — `metrics.json#bubbleRadiusPx`: radius 41 px, above the 30 px comfortable size
- challenge — `5-wrong.webp`: recover / re-cover: the Y5–6 grammar example of a hyphen avoiding ambiguity
- challenge — `metrics.json#settings.diffs`: diffs 1,2,2,3,3
- feedback — `5-wrong.webp`: right word filled in green under the sentence; the meaning difference is not explained
- again — `metrics.json#answersPerWave`: 2 choices, gone before the sentence is read
- again — `6-result.webp`: stage clear: two stars, "71% correct · score 74", praise by name

### y6-subjectobject, year6: 5/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: 'Which word is the subject?' over 'The farmer fed the horses.' with a hint on the doer; speech autoplays
- physical — `metrics.json#aboveCardMs.min`: need 7.19 s, reach 5.23 s, 73% at stage 1: 2.5 s floor + 5-word card sentence and 3 bubble words (3.69 s) + 1 step (find the doer); fixed question line read once
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.23 × 3.4 / 5.6 = 3.18 s, 44% of the need
- challenge — `4-apex.webp`: fed, horses, farmer in a five-word subject-verb-object sentence: the verb is a giveaway and the sentences are lower key stage 2 simple
- feedback — `5-wrong.webp`: the answer is shown in green on the card and the right bubble ticked, but no reason why; one heart lost
- again — `5-wrong.webp`: the same question, 'Which word is the subject?', on both waves; result in 6-result.webp: two stars, 71% correct, score 74, a praise line by name and the next rank named

### y6-consistency, year6: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: "Slice the verb that fits" with "The mouse _ very small."; verb bubbles fit the gap
- physical — `metrics.json#aboveCardMs.min`: question line the same in 2-prompt and 5-wrong, not counted; need 2.5 + sentence 4 words 1.85 + 3 bubble words 1.38 + 0 steps (heard agreement) = 5.73 s; reach 5.23 s, 91%; radius 41 px
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.23 × 3.4 / 5.6 = 3.18 s, 55% of the need
- challenge — `5-wrong.webp`: is / are / am after "The mouse" and "This pencil": Key Stage 1 agreement, well below Year 6 tense consistency at stage 1; later stages not observed
- feedback — `5-wrong.webp`: "Not this time. The answer is is, with no reason given", right bubble ticked, one heart lost; no reason why
- again — `6-result.webp`: 2 of 3 stars, 71% correct, score 74, rank Apprentice to Warrior, praise by name; a Year 6 child would find these sentences babyish
