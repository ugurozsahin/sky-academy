# Playability: playtester-parent, 2026-10-23

Scored by the `playtester-parent` profile under the `playtest` skill (`.claude/skills/playtest/SKILL.md`) from each game's play pack, and written into `src/config/catalogue.json` by `scripts/playability-apply.mjs` (#2206): the parent's score is each game's own `games.<id>.playability`; a game scored in more than one year takes its lowest.

| Game | Year | Score | Note |
|---|---|---|---|
| r-storyorder | reception | 6 | A fair sequencing task for Reception with a kind pace, but small picture bubbles and a story only heard once make it hard to start alone. |
| y2-stats | year2 | 5 | Right tally-chart work for Year 2, but the bubbles leave long before a Year 2 reader has read the card and counted. |
| y2-stats-order | year2 | 6 | Good Year 2 data handling with a fair first stage, but the tally chart is cluttered by a stray line and later stages outrun a Year 2 reader. |
| y3-dictionary | year3 | 8 | A well-paced Year 3 dictionary drill that a child can play alone, though each wave asks the same sort. |
| y4-column | year4 | 6 | Right Year 4 written method in a playable pace, but the first stage avoids exchanging and the spare digits teach nothing. |
| y4-money | year4 | 6 | Well-chosen money questions for Year 4, but the hint alone takes longer to read than the bubbles stay. |
| y4-graphs | year4 | 6 | Real bar-chart reading for Year 4, but the bubbles are gone before a child has read the labels and the scale. |
| y4-ous | year4 | 6 | Right spelling pattern for Year 4, but four word bubbles plus the question are too much to read in five seconds. |
| y4-determiners | year4 | 6 | Good Year 4 grammar practice, but a child has to read a sentence and four word bubbles in about five seconds. |
| y6-graphs | year6 | 6 | A test-style conversion graph for Year 6, but a child cannot read the graph and the hint before the bubbles fall. |
| y6-subjectobject | year6 | 6 | Right Year 6 grammar, but the sentence and the definition cannot be read before the bubbles drop. |

## Distribution

| Score | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rows | 0 | 0 | 0 | 0 | 0 | 1 | 9 | 0 | 1 | 0 | 0 |

11 rows · 8 or above: 1 of 11 (9%).

## Evidence

### r-storyorder, reception: 6/10

understand 1 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: three slots and story text a Reception child cannot read; the question line is not on the card
- understand — `metrics.json#speechAutoplays`: true: the voice reads Put the story in order and the three-sentence story, so the child can start, though a wheat emoji may mean nothing to a four-year-old
- physical — `metrics.json#labelReachMs.min`: Reception profile: speech ends 7.55 s after the prompt + floor 5 s after it is spoken + working 2 steps (pick the first event, then the next) 2 s = need 14.55 s; reach 24.9 s, 171%; the question line is fixed and not on the card
- physical — `metrics.json#settings.speeds`: speeds 0,0,0,1,1 ease to 0 at every stage (gentle, sequence), so every stage keeps the 24.9 s reach
- physical — `metrics.json#bubbleRadiusPx`: 33 px: above the 21 px floor but below the 54 px comfortable size for Reception
- challenge — `5-wrong.webp`: three-event stories (snow, sun, melts) for EYFS retelling and sequencing; diffs rise 1 to 3
- feedback — `5-wrong.webp`: the right order shown as pictures and the right bubble ticked, gentle mode with 4 hearts, but the why is text the child cannot read
- again — `6-result.webp`: one star at 60% correct, a cheer by name; each label may come back up to three times, so the pace drags; cap: again not above challenge, not binding

### y2-stats, year2: 5/10

understand 1 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 3-word question with the car emoji, spoken by itself, but a long stray diagonal line runs across the tally rows; a parent at a glance cannot tell if it is a tally stroke
- understand — `metrics.json#speechAutoplays`: true: the voice says look at the tally chart, how many children chose this one
- physical — `metrics.json#aboveCardMs.min`: Year 2 profile: floor 3.5 s + question 3 words at 60 wpm 3 s + hint 4 words 4 s (replaced by feedback in 5-wrong, so counted) + working 1 step (counting the tallies) 1 s = need 11.5 s; reach 5.37 s, 47% at stage 1
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.37 x 3.4 / 5.6 = 3.26 s, 28% of the need; radius 33 px is above the 30 px comfortable size
- challenge — `4-apex.webp`: tally chart counts 1 to 4 for Year 2 statistics; bubble 1 is the bus row, a real wrong-row mistake; diffs rise 1 to 3 (metrics.json#settings.diffs)
- feedback — `5-wrong.webp`: Not quite, the answer is 2 with the right bubble ticked and the chart still shown, but nothing points to the bus row; two hearts gone, one of them a miss the child could not reach
- again — `6-result.webp`: two stars, a cheer by name and the next rank; the same how-many-chose question every wave, and waves that leave before a Year 2 reader is done would end in frustration; cap: again not above challenge, not binding

### y2-stats-order, year2: 6/10

understand 1 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: slots, tally chart and Slice the biggest number first; the question line is not on the card, and a long stray diagonal line crosses the tally rows
- understand — `metrics.json#speechAutoplays`: true: the voice says slice from the most to the least
- physical — `metrics.json#labelReachMs.min`: Year 2 profile: floor 3.5 s + hint 5 words at 60 wpm 5 s (replaced in 5-wrong, so counted) + row labels 3 words 3 s + bubble words 3 = 3 s + working 4 steps (counting three rows of tallies, then ordering) 4 s = need 18.5 s; reach 20.8 s, 112% at stage 1
- physical — `metrics.json#settings.speeds`: speeds 1,2,3,3,3 ease to 0,1,2,2,2 for a sequence game; stage 3 at eased speed 2: 20.8 x 4.4 / 7.5 = 12.2 s, 66% of the need; radius 41 px above the 30 px comfortable size
- challenge — `5-wrong.webp`: ordering tally counts most to least, Year 2 statistics comparing data; diffs rise
- feedback — `5-wrong.webp`: the order bananas, strawberries, apples shown in green, but no counts given, and the stray line crosses the strawberries tally, so no why
- again — `6-result.webp`: two stars and Electrifying by name; the same sort each wave and later stages too fast; cap: again not above challenge, not binding

### y3-dictionary, year3: 8/10

understand 2 · physical 2 · challenge 2 · feedback 1 · again 1

- understand — `4-apex.webp`: header Dictionary Order, three slots and three words that all start with j; the voice says slice them in dictionary order
- understand — `2-prompt.webp`: the question line is not on the card, but Look at the second letter is, and the speech autoplays
- physical — `metrics.json#labelReachMs.min`: Year 3 profile: floor 3 s + hint 5 words at 90 wpm 3.33 s (replaced in 5-wrong, so counted) + bubble words 3 = 2 s + working 2 steps (compare second letters for first, then second) 2 s = need 10.33 s; reach 20.8 s, 201%
- physical — `metrics.json#settings.speeds`: speeds ease to 0,1,2,2,2; stage 3 at eased speed 2: 20.8 x 4.4 / 7.5 = 12.2 s, 118%; at a cautious 75 wpm still 107%; radius 41 px above the 30 px comfortable size, room between targets
- challenge — `4-apex.webp`: jug, jet, jam force the second letter, the Year 3 dictionary skill; first-letter-only is the real mistake; diffs rise
- feedback — `5-wrong.webp`: fig fox fun shown in green and the right bubble ticked, but the second letters are not highlighted, so no why
- again — `6-result.webp`: two stars and Full charge, well done by name; the same three-short-word sort every wave; cap: again not above challenge, not binding

### y4-column, year4: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `2-prompt.webp`: 7,249 - 4,118 with four answer slots and Slice the digits in order, spoken automatically
- physical — `metrics.json#labelReachMs.min`: Year 4 profile: floor 3 s + question 0 words + hint 5 words at 100 wpm 3 s (replaced in 5-wrong, so counted) + working 4 steps (four column subtractions; subtraction facts are not listed as secure in the Year 4 profile) 4 s = need 10 s; reach 17.15 s, 171%
- physical — `metrics.json#settings.speeds`: speeds ease to 0,1,2,2,2; stage 3 at eased speed 2: 17.15 x 4.4 / 7.5 = 10.06 s, 101%; at the cautious end of the uncertain 100 wpm (90 wpm, need 10.33 s) it is 97%, and later diffs may add exchanging
- physical — `metrics.json#bubbleRadiusPx`: 33 px: above the 30 px comfortable size
- challenge — `5-wrong.webp`: 4-digit column subtraction is Year 4, but both stage-1 sums need no exchanging, and the spare digits 6 and 4 are not mistakes a child makes
- feedback — `5-wrong.webp`: the answer 2,245 shown in green, but no column working, so no why
- again — `6-result.webp`: two stars and Fast thinking by name; the same digit-building every wave; cap: again not above challenge, binding at 1

### y4-money, year4: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: 183p = ? with a hint explaining 100 pence make a pound, spoken automatically
- physical — `metrics.json#aboveCardMs.min`: Year 4 profile: floor 3 s + question 0 words + hint 14 words at 100 wpm 8.4 s (replaced in 5-wrong, so counted) + working 1 step (converting pence to pounds) 1 s = need 12.4 s; reach 5.08 s, 41%; even without the hint, 4 s, stage 3 would be 77%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.08 x 3.4 / 5.6 = 3.09 s; radius 41 px above the 30 px comfortable size
- challenge — `4-apex.webp`: pence to pounds for Year 4 money; wrong answers 1.38, 0.83 and 18.30 pounds are real place-value slips; a which-is-more question in 5-wrong.webp varies the stage
- feedback — `5-wrong.webp`: the answer 3.55 pounds shown and ticked, but 355p is not shown converted, so no why
- again — `6-result.webp`: two stars and praise by name, two question types in the stage, but waves too fast for the hint the card leans on; cap: again not above challenge, not binding

### y4-graphs, year4: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: short question, legible bar chart with a scale in twos, spoken automatically
- physical — `metrics.json#aboveCardMs.min`: Year 4 profile: floor 3 s + question 4 words at 100 wpm 2.4 s + hint 5 words 3 s (replaced in 5-wrong, so counted) + bar labels 3 words 1.8 s + working 1 step (reading the bar against the scale) 1 s = need 11.2 s; reach 5.27 s, 47%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.27 x 3.4 / 5.6 = 3.20 s; radius 33 px above the 30 px comfortable size
- challenge — `4-apex.webp`: bar chart reading for Year 4 statistics with neighbouring scale values 6 and 10 as the misreads a child makes; a how-many-more comparison shows behind 6-result.webp; diffs rise
- feedback — `5-wrong.webp`: the answer 16 shown and ticked, the chart stays, but the tram bar is not highlighted, so no why
- again — `6-result.webp`: two stars and Quick and precise by name, but too fast for the reading the card needs; cap: again not above challenge, not binding

### y4-ous, year4: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: Which spelling is right with a gap sentence, and the voice says the word joyous
- physical — `metrics.json#aboveCardMs.min`: Year 4 profile: floor 3 s + question 4 words at 100 wpm 2.4 s + hint 4 words 2.4 s (replaced in 5-wrong, so counted) + bubble words 4 = 2.4 s + working 1 step (checking the -ous ending) 1 s = need 11.2 s; reach 5.05 s, 45%; the gap sentence is not counted, as the word is spoken
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.05 x 3.4 / 5.6 = 3.07 s; radius 41 px above the 30 px comfortable size
- challenge — `4-apex.webp`: the suffix -ous from the Years 3 and 4 spelling appendix; joyeous, joyus and joious are the misspellings children write; diffs rise
- feedback — `5-wrong.webp`: poisonous shown in green and ticked, but no rule about the ending, so no why
- again — `6-result.webp`: two stars and praise by name; the same spelling choice every wave on waves too fast to read four word bubbles; cap: again not above challenge, not binding

### y4-determiners, year4: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: question, the sentence and a one-line definition of a determiner, all spoken automatically
- physical — `metrics.json#aboveCardMs.min`: Year 4 profile: floor 3 s + question 5 words at 100 wpm 3 s + sentence 5 words 3 s + hint 12 words 7.2 s (replaced in 5-wrong, so counted) + bubble words 4 = 2.4 s + working 1 step (find the word before the noun) 1 s = need 19.6 s; reach 5.05 s, 26%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.05 x 3.4 / 5.6 = 3.07 s; radius 41 px above the 30 px comfortable size
- challenge — `4-apex.webp`: determiner is Year 4 grammar terminology; the adjective clever before the noun is the real confusion; diffs rise (metrics.json#settings.diffs)
- feedback — `5-wrong.webp`: the answer My shown in green with the sentence still there, but no reason given and the definition line is gone
- again — `6-result.webp`: two stars and praise by name, but the same find-the-determiner task seven times on waves too fast to read; cap: again not above challenge, not binding

### y6-graphs, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: clear question and a legible conversion graph with a how-to hint, though the axes carry no km or miles titles
- physical — `metrics.json#aboveCardMs.min`: Year 6 profile: floor 2.5 s + question 7 words at 130 wpm 3.23 s + hint 12 words 5.54 s (replaced in 5-wrong, so counted) + working 2 steps (find 24 km and go up to the line, read across to miles) 2 s = need 13.27 s; reach 5.3 s, 40%
- physical — `metrics.json#speechOutlastedWave`: true: the voice was still speaking when the whole first wave had gone
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.3 x 3.4 / 5.6 = 3.22 s; radius 33 px above the 30 px comfortable size
- challenge — `4-apex.webp`: km to miles conversion graph, Year 6; 24 is the copy-the-input mistake; diffs rise
- feedback — `5-wrong.webp`: 16 km is about 10 miles filled in green, but no line drawn on the graph, so the answer without the why
- again — `6-result.webp`: two stars and praise by name, but a reasoning question on a recall-speed wave; cap: again not above challenge, not binding

### y6-subjectobject, year6: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: question, a short sentence and a definition of the subject, spoken automatically
- physical — `metrics.json#aboveCardMs.min`: Year 6 profile: floor 2.5 s + question 5 words at 130 wpm 2.31 s + sentence 5 words 2.31 s + hint 12 words 5.54 s (replaced in 5-wrong, so counted) + bubble words 3 = 1.38 s + working 1 step (finding the doer) 1 s = need 15.04 s; reach 5.23 s, 35%
- physical — `metrics.json#settings.speeds`: stage 3 at speed 3: 5.23 x 3.4 / 5.6 = 3.18 s; radius 41 px above the 30 px comfortable size
- challenge — `4-apex.webp`: subject and object are Year 6 terminology; the object horses is the real confusion; diffs rise
- feedback — `5-wrong.webp`: bird shown in green and ticked, but no reason such as who did the building, so no why
- again — `6-result.webp`: two stars and praise by name; the same find-the-subject task each wave and too fast for the reading; cap: again not above challenge, not binding
