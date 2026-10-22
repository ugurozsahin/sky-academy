# Playability: playtester-reception, 2026-10-22

Scored by the `playtester-reception` profile under the `playtest` skill (`.claude/skills/playtest/SKILL.md`) from each game's play pack, and written into `src/config/catalogue.json` by `scripts/playability-apply.mjs` (#2206): a year profile's score is the game-year node's `games.<id>.years.<year>.playability`.

| Game | Year | Score | Note |
|---|---|---|---|
| r-count | reception | 9 | Counting real pictures with a friendly voice; plays alone, only the small bubbles and faster later stages get in the way. |
| r-numeral | reception | 7 | Sound numeral-to-quantity practice; the number is never spoken and the dots are plain. |
| r-subitise | reception | 9 | Big clear dots, spoken question and time to answer; only the bubble size falls short. |
| r-compare | reception | 6 | The more/fewer switch is good practice, but two bubbles and repeated pictures make it a guess, and the spoken line eats the time. |
| r-onemore | reception | 7 | Right content for Reception, but the wave is half gone before the voice finishes, and a wrong answer is not shown with dots. |
| r-measure | reception | 7 | Easy to play and fun pictures, but it tests what children know about animals and vehicles rather than measuring. |
| r-bonds | reception | 7 | Right bonds to 5, but the ten-frame does not show the missing part, so a child guesses until the voice is understood. |
| r-add | reception | 9 | Clear spoken sums with objects to count; the bubbles are small for small fingers and the last two stages fly faster than a Reception child acts. |
| r-sub | reception | 9 | Take-away within 5 with a clear picture of why; later stages may outpace a counting child. |
| r-counton | reception | 6 | Good counting practice, but the answer bubble has nearly gone by the time the voice finishes the count. |
| r-order | reception | 7 | A clearly spoken ordering task at the right level, but every wave looks the same and a wrong slice does not show why. |
| r-patterns | reception | 7 | Clear spoken repeating patterns, but one distractor is a giveaway and bubbles are smaller than comfortable. |
| r-balance | reception | 7 | Counting dressed as balancing, but the long spoken instruction leaves under two seconds to slice once it ends. |
| r-doubles | reception | 8 | The two-colour ten-frame makes doubling visible; tight timing and plain dots keep it from full marks. |
| r-shapes | reception | 7 | Shape names spoken clearly, but the wrong shapes are too different to test real confusion. |
| r-share | reception | 5 | Right content for Reception, but the long spoken question leaves under two seconds to share and choose. |
| r-oddeven | reception | 5 | A good idea, but tick-and-cross answers and no pairing shown leave it a guessing game for most of Reception. |
| r-rhyme | reception | 7 | Spoken rhyme task the child can follow, but two choices with unrelated distractors make it easy to guess. |
| r-sounds | reception | 6 | Right phonics for Reception, but four letters to read in a short flight means many missed waves. |
| r-syllables | reception | 6 | A spoken clapping task that is too easy to guess and a little rushed after the voice. |
| r-soundhunt | reception | 6 | Good initial-sound practice, but the voice is still speaking while the letters fly past. |
| r-storytime | reception | 8 | A friendly spoken story with time to answer; only the bubble size and a silent wrong-answer screen hold it back. |
| r-capitals | reception | 6 | Spoken clearly, but bare letters with random distractors and no reason given when wrong. |
| r-tricky | reception | 6 | Right tricky words for Reception, but reading three words in one flight is too much for most of the year. |
| r-build | reception | 8 | Spoken CVC spelling the child can follow, though the bubbles are smaller than comfortable and a wrong letter shows no sounds. |
| r-read | reception | 8 | Good CVC blending practice with picture answers, though the later stages leave too little time to sound out. |
| r-sentence | reception | 7 | A good early-reading sentence task with friendly speech, but the odd-one-out decoy can be ruled out by matching shapes rather than reading. |
| r-storyorder | reception | 7 | Picture sequencing that suits Reception, but a three-sentence story heard once while bubbles rise is a lot to hold. |
| r-trace | reception | 7 | Big friendly letters to trace, but it rewards coverage rather than correct formation. |
| r-initial | reception | 6 | Lovely picture phonics, but unclear emoji names and a slow first-sound judgement against a fast wave. |

## Distribution

| Score | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rows | 0 | 0 | 0 | 0 | 0 | 2 | 8 | 12 | 4 | 4 | 0 |

30 rows · 8 or above: 8 of 30 (27%).

## Evidence

### r-count, reception: 9/10

understand 2 · physical 1 · challenge 2 · feedback 2 · again 2

- understand — `2-prompt.webp`: three apples to count, bubbles are numbers; voice says 'How many can you count?' by itself
- physical — `5-wrong.webp`: 'How many?' is the same in wave 1 and wave 2, so the line is heard once per game
- physical — `metrics.json#aboveCardMs.min`: need 5 s floor + 1 s working (count to 5) = 6 s; reach 7.17 s, 119% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 89% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 3 apples against 5, 1, 2: counting within 5, near-miss wrong answers
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 'The answer is 5' with the five butterflies still there to count, right bubble ticked
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `5-wrong.webp`: apples then butterflies
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-numeral, reception: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `2-prompt.webp`: numeral 3 on the card, dot groups on the bubbles; voice says 'Find the group that matches the number' but not the number
- physical — `5-wrong.webp`: 'Find this many' is the same in wave 1 and wave 2, so the line is heard once per game
- physical — `metrics.json#aboveCardMs.min`: need 5 s floor + 1 s working (count the dots on each bubble) = 6 s; reach 7.1 s, 118% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.1 × 5.6 / 7.5 = 5.3 s, 88% of the need
- physical — `metrics.json#bubbleRadiusPx`: 41 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 3 against groups of 5 and 4: numeral to quantity within 5, near-miss wrong answers
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 'The answer is' a single dot; no count shown
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `4-apex.webp`: plain white dots every wave
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-subitise, reception: 9/10

understand 2 · physical 1 · challenge 2 · feedback 2 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "How many dots?"; number bubbles
- understand — `2-prompt.webp`: three big dots in a dice pattern
- physical — `metrics.json#aboveCardMs.min`: need 5 s (5 s floor + 0 words + 0 steps, subitising to 5; same line in 2-prompt and 5-wrong, heard once), reach 7.13 s, 143% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.13 × 5.6 / 7.5 = 5.33 s, 107% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 3 dots with 2 among the choices, the near miss a child makes; ELG subitising to 5
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: 4 ticked beside the four dots still on the card: the child can count to see why
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: a new dot pattern each wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-compare, reception: 6/10

understand 2 · physical 0 · challenge 1 · feedback 2 · again 1

- understand — `metrics.json#speechText`: voice says 'Which number is more, 3 or 1?'; apples and a banana on the card
- physical — `metrics.json#afterSpeechMs.min`: more/fewer changes per wave (2-prompt.webp vs 5-wrong.webp), so the line counts: need 5 s floor after the voice + 3.87 s under the voice + 1 s working (count the apples, find the numeral) = 9.87 s; reach 7.25 s, 73% at stage 1
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 3 or 1, two bubbles: a coin toss gets half right
- challenge — `5-wrong.webp`: wave 2 repeats the same 3 apples and 1 banana, only flipped to 'fewer'
- feedback — `5-wrong.webp`: 'The answer is 1' with the single banana still on the card to see why, right bubble ticked
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `5-wrong.webp`: the same picture two waves running
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-onemore, reception: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: voice says 'One more than 6?' by itself; 6 dots in a ten-frame; bubbles are numbers
- physical — `metrics.json#afterSpeechMs.min`: more/less changes per wave, so the line counts: need 5 s floor after the voice + 3.24 s of the first bubble's flight under the voice + 1 s working (count on one) = 9.24 s; reach 7.17 s, 78% at stage 1
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: one more than 6 against 10, 4, 5; 5 is the one-less slip children make
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 'The answer is 4' over five dots; the frame does not show one taken away
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `4-apex.webp`: dots and numerals every wave
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-measure, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: voice says 'Which is longer?' by itself; two picture bubbles
- physical — `5-wrong.webp`: 'Which is longer?' is the same in wave 1 and wave 2, so the line is heard once per game
- physical — `metrics.json#aboveCardMs.min`: need 5 s floor + 0 s working (known sizes) = 5 s; reach 7.17 s, 143% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 107% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: caterpillar and snake drawn the same size: real-world knowledge, not comparing lengths by eye; two bubbles, half by chance
- feedback — `5-wrong.webp`: 'The answer is 🚌' only; no side-by-side picture to show why
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `5-wrong.webp`: caterpillar/snake then scooter/bus: varied pictures
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-bonds, reception: 7/10

understand 1 · physical 1 · challenge 2 · feedback 2 · again 1

- understand — `2-prompt.webp`: 3 dots in a ten-frame with nothing marking the 5; the picture does not show 'how many more'
- understand — `metrics.json#speechText`: voice says '3 and how many more make 5?' by itself
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 2.6 s of the first bubble's flight under the voice + 1 s working (count on to 5, bonds not yet secure partway through the year) = 8.6 s; reach 7.17 s, 83% at stage 1
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `5-wrong.webp`: bonds to 5, including 5 + 0, the ELG range
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 5 + 0 = 5 filled in with the five dots shown, right bubble ticked and held
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread
- again — `4-apex.webp`: plain dots and numerals every wave, nothing to collect mid-stage

### r-add, reception: 9/10

understand 2 · physical 1 · challenge 2 · feedback 2 · again 2

- understand — `metrics.json#speechAutoplays`: voice says 'Adding! 3 plus 1?' by itself; card shows 3 cookies + 1 cookie
- understand — `2-prompt.webp`: answer bubbles are numbers, as the spoken question asks
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 1.37 s of the first bubble's flight under the voice + 1 s working (count all the cookies) = 7.37 s; reach 7.2 s, 98% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 73% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 3 + 1 within 5 with objects; 3 (the first number) offered as a wrong answer, a real slip
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages; later ranges not observed
- feedback — `5-wrong.webp`: 3 + 2 = 5 filled in green over 3 cars and 2 cars to count, right bubble ticked and held
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread
- again — `5-wrong.webp`: cookies then cars: the pictures change wave to wave

### r-sub, reception: 9/10

understand 2 · physical 1 · challenge 2 · feedback 2 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "4 take away 1?"
- understand — `2-prompt.webp`: four cookies with one crossed out: the take-away is a picture
- physical — `metrics.json#aboveCardMs.min`: need 8.2 s (2.2 s to hear the line, which changes: 4 − 1 in 2-prompt, 4 − 4 in 5-wrong; + 5 s floor + 0 words + 1 step: count the cookies left), reach 7.17 s, 87% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 65% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: within 5 with 5 as the add-instead slip; ELG Number subtraction facts to 5
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: 0 filled in and ticked, with all four cookies crossed out on the card: the picture shows why
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: a new sum and new objects each wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-counton, reception: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: voice says 'What comes next? 5, 6, 7…' by itself; bubbles are numbers
- physical — `metrics.json#afterSpeechMs.min`: the sequence changes per wave, so the line counts: need 5 s floor after the voice + 4.65 s of the first bubble's flight under the voice + 0 s working (rote count) = 9.65 s; reach 7.17 s, 74% at stage 1; that first bubble, 8, is the answer
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: next after 7, with 6 (a number already said) and 11 as wrong answers; counting to 10, in range
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 2, 3, 4, 5 filled in; no picture or count-along to show why
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `2-prompt.webp`: numerals only on the card, no picture
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-order, reception: 7/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: spoken by itself: "Slice the numbers from smallest to biggest: 2, 0, 3"; numeral bubbles
- understand — `2-prompt.webp`: the three numbers and three slots legible on the card
- physical — `metrics.json#labelReachMs.min`: need 6 s (5 s floor + 0 words, numerals + 1 step: find the smallest left; line fixed, metrics.json#promptFixed true, and not on the card), reach 28.47 s, 474% at stage 1
- physical — `metrics.json#settings.speeds`: stages 4-5 at speed 1 ease to 0 (sequence, gentle): 28.47 x 7.5 / 7.5 = 28.47 s; every stage meets the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: order 2, 0, 3: numbers to 5 with zero, a real Reception slip; within ELG comparing to 10
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3; later ranges not observed
- feedback — `5-wrong.webp`: 1 ticked, 5 crossed, "The answer is 1,2,5": numerals the child can read, but no why such as a number track
- feedback — `metrics.json#livesAfterWrong`: a wrong slice costs one heart of 4 (3 left), gentle mode; the first-question miss was the pack's own and is not counted
- again — `metrics.json#promptFixed`: same instruction every wave and the same three-numeral layout; only the digits change (2,0,3 then 1,5,2 in 5-wrong.webp): samey within a stage
- again — `6-result.webp`: one star (from the pack's own misses), confetti and the ninja cheering by name; stars are understood without reading

### r-patterns, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Look at the pattern. What comes next?"; bubbles are the pattern's own shapes
- understand — `2-prompt.webp`: star-diamond pattern with a gap, legible on the card
- physical — `metrics.json#aboveCardMs.min`: need 6 s (5 s floor + 0 words + 1 step: spot the repeat; same line "What comes next?" in 2-prompt and 5-wrong, read once), reach 7.13 s, 119% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.13 × 5.6 / 7.5 = 5.33 s, 89% of the need; working: 1 step
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: AB pattern; of the two wrong bubbles the red circle is not in the pattern at all, so it is really a two-way choice
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3 across stages; later patterns not observed
- feedback — `5-wrong.webp`: right shape ticked and shown on the card in text the child cannot read; the gap is not filled in, no why
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: new pattern and colours on wave 2
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-balance, reception: 7/10

understand 1 · physical 0 · challenge 2 · feedback 2 · again 2

- understand — `2-prompt.webp`: '1 = ?' on a balance with one butterfly and an empty '?' pan; balancing is abstract for this age
- understand — `metrics.json#speechMs`: the spoken line runs 5.5 s: 'Balance the Scales! Count the objects. How many make the scales balance?'
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 5.36 s of the first bubble's flight under the voice + 1 s working (count the objects) = 11.36 s; reach 7.22 s, 64% at stage 1; only 1.86 s left after the voice
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `5-wrong.webp`: wave 2 is 5 cars = ?; counting to 5 as equality, in Reception range
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: 5 = 5 filled in, the 5 cars still on the pan to count, right bubble ticked
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread
- again — `5-wrong.webp`: butterfly then cars: the pictures change wave to wave

### r-doubles, reception: 8/10

understand 2 · physical 1 · challenge 2 · feedback 2 · again 1

- understand — `2-prompt.webp`: 'Double 3' with 3 orange and 3 blue dots; voice says 'What is double 3?'
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 2.14 s of the first bubble's flight under the voice + 1 s working (count the six dots) = 8.14 s; reach 7.13 s, 88% at stage 1
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: double 3 against 2, 5, 9; double facts are in the Reception ELG
- challenge — `metrics.json#settings.diffs`: diffs 1,1,2,2,3 rise across stages
- feedback — `5-wrong.webp`: Double 1 = 2 filled in with one orange and one blue dot, right bubble ticked
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `4-apex.webp`: dots and numerals every wave
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-shapes, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Which one is a rectangle?"; shape bubbles
- physical — `metrics.json#aboveCardMs.min`: need 7.7 s (2.7 s to hear the line, which changes: rectangle in 2-prompt, triangle in 5-wrong; + 5 s floor + 0 words + 0 steps, a recalled name), reach 7.17 s, 93% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 69% of the need; working: 0 steps
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- physical — `4-apex.webp`: the rectangle glyph is small inside its bubble
- challenge — `4-apex.webp`: rectangle against circle and triangle: the most different shapes, not the square-rectangle mix-up a Reception child makes
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3; later shapes not observed
- feedback — `5-wrong.webp`: triangle ticked, circle crossed; no why such as counting sides
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: a different shape asked each wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-share, reception: 5/10

understand 1 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: "Share 4 equally between two. How many does each one get?": long, and "equally" is hard vocabulary
- understand — `2-prompt.webp`: four apples in a row; no two plates or people to show the sharing
- physical — `metrics.json#aboveCardMs.min`: need 12.4 s (5.4 s to hear the line, which changes: 4 in 2-prompt, 6 in 5-wrong; + 5 s floor + 0 words + 2 steps: share out, count one share), reach 7.13 s, 58% at stage 1
- physical — `metrics.json#afterSpeechMs.min`: only 1.96 s of reach left after the voice stops
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: 4 between 2 with 2, 4, 0, 1: 4 is the real slip (the total); equal sharing sits in ELG Numerical Patterns
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: 3 ticked, but the six balloons are not split into two groups: answer without the why
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `metrics.json#afterSpeechMs.min`: bubbles mostly gone before the child can work it out: more missed waves than answers
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-oddeven, reception: 5/10

understand 1 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `3-rising.webp`: answers are a tick and a cross for yes and no; the child must link them to the spoken question
- understand — `metrics.json#speechText`: voice says 'There are 4. Can they all find a partner?'
- physical — `5-wrong.webp`: 'Can they all find a partner?' is the same in wave 1 and wave 2, so the line is heard once per game
- physical — `metrics.json#aboveCardMs.min`: need 5 s floor + 2 s working (pair the objects in a row of five, check for one left over) = 7 s; reach 7.13 s, 102% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.13 × 5.6 / 7.5 = 5.33 s, 76% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: odd and even within 5 is in the ELG, but two answers make half right by chance
- feedback — `5-wrong.webp`: 'The answer is ❌' only; the five butterflies are not paired up to show the odd one
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `2-prompt.webp`: the same question and the same tick/cross every wave
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-rhyme, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Which picture rhymes with star?"; picture bubbles
- physical — `metrics.json#aboveCardMs.min`: need 9.0 s (3.0 s to hear the line, which changes: star in 2-prompt, cake in 5-wrong; + 5 s floor + 0 words + 1 step: say and compare endings), reach 7.13 s, 79% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.13 × 5.6 / 7.5 = 5.33 s, 59% of the need; working: 1 step
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `metrics.json#answersPerWave`: 2 answers a wave: a coin flip
- challenge — `4-apex.webp`: star with car and dog: the distractor shares no sound with the target; rhyme is a 3-4 skill in Development Matters
- feedback — `5-wrong.webp`: snake ticked, chicken crossed; no spoken cake-snake pairing (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: new word and pictures each wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-sounds, reception: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: spoken by itself: "tap. Which sound does tap start with?"
- understand — `2-prompt.webp`: tap picture beside _ap; the _ap line appears twice, a little cluttered
- physical — `metrics.json#aboveCardMs.min`: need 13.5 s (3.5 s to hear the line, which changes: tap in 2-prompt, nut in 5-wrong; + 5 s floor + 4 letters at a judged 1 s each + 1 step: isolate the first sound), reach 7.13 s, 53% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.13 × 5.6 / 7.5 = 5.33 s, 40% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: t among g, u, k: Phase 2 grapheme for an initial sound, ELG Word Reading
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: n filled into "nut" and ticked: the answer, not sounded out (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `metrics.json#bubbleWords`: four letters to read in turn while the wave flies: rushed
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-syllables, reception: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `metrics.json#speechText`: spoken by itself: "pencil. How many beats in pencil?"; picture of a pencil on the card
- physical — `metrics.json#aboveCardMs.min`: need 9.5 s (3.5 s to hear the line, which changes: pencil in 2-prompt, tree in 5-wrong; + 5 s floor + 0 words + 1 step: clap the beats), reach 7.17 s, 75% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 56% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `metrics.json#answersPerWave`: 2 answers a wave, 1 or 2: a coin flip; clapping syllables is a 3-4 skill in Development Matters
- feedback — `5-wrong.webp`: 1 ticked; the word is not clapped out (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `4-apex.webp`: the same 1-or-2 choice every wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-soundhunt, reception: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: spoken by itself: "Listen: gum, get, gap. Which sound do they start with?"; letter bubbles
- understand — `2-prompt.webp`: "Listen!" with a speaker: the task is clearly sound-first
- physical — `metrics.json#aboveCardMs.min`: need 14.8 s (5.8 s to hear the words, which change each wave; + 5 s floor + 3 letters at a judged 1 s each + 1 step: hold the first sound), reach 7.13 s, 48% at stage 1
- physical — `metrics.json#afterSpeechMs.min`: only 1.54 s of reach left after the voice stops
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: g against p and d: the round letters a Reception child confuses; Phase 2 sounds
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: g ticked, i crossed; the three words are not said again (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `metrics.json#afterSpeechMs.min`: bubbles are leaving as the voice finishes: rushed and stressful
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-storytime, reception: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `metrics.json#speechText`: the story and question are spoken by themselves; picture bubbles of animals
- physical — `metrics.json#promptLeadMs`: the wave launches 6.1 s in, after the story ends, so hearing it is not in the per-wave need
- physical — `metrics.json#aboveCardMs.min`: need 5 s (5 s floor + 0 words + 0 steps, a fact just heard), reach 7.10 s, 142% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.10 × 5.6 / 7.5 = 5.30 s, 106% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: frog against rabbit (also hops: the guess a child makes) and turtle; listening recall, ELG Comprehension
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: pig ticked; the story stays as text the child cannot read and is not retold (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: a new story each wave
- again — `6-result.webp`: two stars, confetti, a cheer by name

### r-capitals, reception: 6/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 1

- understand — `metrics.json#speechText`: voice says 'Find the small letter that matches g' by itself; bubbles are letters
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 3.96 s of the first bubble's flight under the voice + 0 s working (a known letter shape is recall) = 8.96 s; reach 7.17 s, 80% at stage 1; the letter comes last in the spoken line
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: G against g, u, r: matching cases is Reception work, but the wrong letters are random, not the b/d or p/q mix-ups children make
- feedback — `5-wrong.webp`: 'The answer is t' and the t bubble ticked; no why
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `2-prompt.webp`: a bare letter shown twice on the card, no picture
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread

### r-tricky, reception: 6/10

understand 2 · physical 0 · challenge 2 · feedback 1 · again 1

- understand — `metrics.json#speechText`: spoken by itself: "Find the word: I"; word bubbles
- physical — `metrics.json#aboveCardMs.min`: need 12.7 s (2.7 s to hear the word, which changes each wave: I, then the; + 5 s floor + go, I, no read at a judged 1 s a sound, 5 s + 0 steps), reach 7.17 s, 56% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 42% of the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: I among go and no: go and no differ by one letter, the real confusion; Phase 2-3 tricky words
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: "the" ticked and in text; the word is not said again (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `metrics.json#bubbleWords`: three words to read in turn while the wave flies: rushed
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-build, reception: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Build a Word! Spell the word tap"; bubbles are letters, what spelling asks for
- understand — `2-prompt.webp`: tap picture and letter slots on the card; "Spell it!" is not on the card and "Slice the letters in order" is unread text, so "in order" is never spoken
- physical — `metrics.json#labelReachMs.min`: need 11 s (5 s floor + 5 letter bubbles scanned at a judged 1 s each, cautious + 1 step: segment t-a-p; question line not on the card; the 5-word hint is unread by this child, so it adds no reading time), reach 11.62 s, 106% at stage 1
- physical — `metrics.json#settings.speeds`: stages 4-5 at speed 1 ease to 0 (sequence, gentle): 11.62 x 7.5 / 7.5 = 11.62 s, 106%; every stage meets the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: CVC word tap from a, t, e, m, p: e for a is a real vowel slip; segmenting matches ELG Writing
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3; later words not observed
- feedback — `5-wrong.webp`: c ticked, u crossed, "The answer is cup" in text this child cannot read; slots not filled in, sounds not spoken (not observed): no why
- feedback — `metrics.json#livesAfterWrong`: a wrong slice costs one heart of 4 (3 left), gentle mode; the first-question miss was the pack's own and is not counted
- again — `5-wrong.webp`: a new word and picture each wave (tap, then cup)
- again — `6-result.webp`: one star (from the pack's own misses), confetti and the ninja cheering by name; stars are understood without reading

### r-read, reception: 8/10

understand 2 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Read the word. Slice its picture."; picture bubbles
- understand — `2-prompt.webp`: one large CVC word "tap" on the card
- physical — `metrics.json#aboveCardMs.min`: need 8 s (5 s floor + card word "tap" sounded out, 3 sounds at a judged 1 s each; bubbles are pictures; line "Read it!" fixed), reach 7.17 s, 90% at stage 1
- physical — `metrics.json#settings.speeds`: stage 4 at speed 1: 7.17 × 5.6 / 7.5 = 5.35 s, 67% of the need; working: 0 steps, the blending is the reading
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: tap with cap and rat: cap is the rhyme a child guesses from the ending; CVC blending matches ELG Word Reading
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: pig ticked and named in unread text; the word is not sounded out (not observed)
- feedback — `metrics.json#livesAfterFirstWave`: unanswered first wave cost no heart (4 left); a wrong slice costs one of 4, gentle mode
- again — `5-wrong.webp`: a new word and new pictures each wave
- again — `6-result.webp`: two stars, confetti and the ninja cheering by name; stars are understood without reading

### r-sentence, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Story Sentences! Build the sentence: I see mum."; word bubbles
- understand — `2-prompt.webp`: the sentence "I see mum." large on the card with three slots; "in order" only in unread text
- physical — `metrics.json#labelReachMs.min`: need 14 s (5 s floor + 4 bubble words sounded out at a judged 1 s a sound, cautious: I 1, see 2, fox 3, mum 3 = 9 s; card sentence is spoken, so not counted; line fixed and not on the card), reach 21.95 s, 157% at stage 1
- physical — `metrics.json#settings.speeds`: stages 4-5 at speed 1 ease to 0 (sequence, gentle): 21.95 x 7.5 / 7.5 = 21.95 s; every stage meets the need
- physical — `metrics.json#bubbleRadiusPx`: 41 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `4-apex.webp`: decoy fox shares no letters with the printed sentence, so it is dropped by matching shapes without reading: a giveaway
- challenge — `5-wrong.webp`: "I like jam." with decoy red: like is a later tricky word for partway through Reception; simple sentences are the end-of-year ELG
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: I ticked, red crossed, "The answer is I like jam." in text; sentence not re-read aloud (not observed): no why
- feedback — `metrics.json#livesAfterWrong`: a wrong slice costs one heart of 4 (3 left), gentle mode; the first-question miss was the pack's own and is not counted
- again — `5-wrong.webp`: a new sentence and decoy each wave
- again — `6-result.webp`: one star (from the pack's own misses), confetti and the ninja cheering by name; stars are understood without reading

### r-storyorder, reception: 7/10

understand 1 · physical 1 · challenge 2 · feedback 1 · again 2

- understand — `metrics.json#afterSpeechMs.min`: the 3-sentence story is heard once while the bubbles already rise: 0 ms of the first bubble's first flight comes after the voice
- understand — `4-apex.webp`: wheat is faint gold on an orange bubble and an unfamiliar thing to name; bread and sandwich are clear
- understand — `metrics.json#speechText`: spoken by itself: "Put the story in order: The wheat is cut. It is made into bread. We eat a sandwich."
- physical — `metrics.json#labelReachMs.min`: need 13.4 s (7.4 s to hear the story, which changes each wave, metrics.json#speechMs + 5 s floor + 0 words, picture bubbles + 1 step: which comes next; card story is spoken, not read), reach 24.92 s, 186% at stage 1
- physical — `metrics.json#settings.speeds`: stages 4-5 at speed 1 ease to 0 (sequence, gentle): 24.92 x 7.5 / 7.5 = 24.92 s; every stage meets the need
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `2-prompt.webp`: three-step everyday sequence told aloud: retelling a heard story matches ELG Comprehension
- challenge — `5-wrong.webp`: snow, sun, melt: slicing the melt first is a real cause-and-effect slip
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: snowman ticked, drop crossed, answer shown as pictures the child can read; no why linking each picture to its sentence
- feedback — `metrics.json#livesAfterWrong`: a wrong slice costs one heart of 4 (3 left), gentle mode; the first-question miss was the pack's own and is not counted
- again — `5-wrong.webp`: a new story and pictures each wave
- again — `6-result.webp`: one star (from the pack's own misses), confetti and the ninja cheering by name; stars are understood without reading

### r-trace, reception: 7/10

understand 2 · physical 1 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: spoken by itself: "Trace the letter g"; a dotted letter fills the pad
- understand — `2-prompt.webp`: big dotted g, Check button with a tick
- physical — `metrics.json#trace.glyphPx`: letter 260 px tall in a 366 × 511 px pad, no timer observed
- physical — `2-prompt.webp`: the dotted band is about 45 px (about 7.5 mm) wide: just above the 7 mm floor, well below the 18 mm comfortable size; the pass tolerance is not observed
- challenge — `2-prompt.webp`: g and d: Reception letters; the green start dot sits outside the letter, so no stroke order or direction is taught
- challenge — `metrics.json#settings.diffs`: diffs rise 1 to 3
- feedback — `5-wrong.webp`: "Keep tracing — cover the whole letter" in text the child cannot read; spoken not observed
- feedback — `metrics.json#livesAfterWrong`: no heart lost for an incomplete trace (4 left)
- again — `6-result.webp`: three stars, confetti, a cheer by name
- again — `4-traced.webp`: a quick "Zap!" as each letter is accepted

### r-initial, reception: 6/10

understand 2 · physical 0 · challenge 1 · feedback 1 · again 2

- understand — `metrics.json#speechText`: voice says 'Which picture starts like frog?'; bubbles are pictures; the 'say it slowly' hint is not spoken
- physical — `metrics.json#afterSpeechMs.min`: need 5 s floor after the voice + 3.1 s of the first bubble's flight under the voice + 2 s working (hear /f/ in frog, then name each picture and its first sound) = 10.1 s; reach 7.23 s, 72% at stage 1
- physical — `metrics.json#bubbleRadiusPx`: 33 px radius: above the 21 px floor, below the 54 px comfortable size
- challenge — `5-wrong.webp`: bear's answer is a handbag emoji a child may call 'handbag' or 'purse', beside a pushpin; picture names are uncertain
- challenge — `4-apex.webp`: rat, fox, dog for frog: initial sounds are Reception phonics
- feedback — `5-wrong.webp`: 'The answer is 👜' only; the b sound is not said or shown
- feedback — `metrics.json#livesAfterFirstWave`: first wave left unanswered: still 4 hearts, misses cost nothing; gentle mode, 4 lives
- again — `5-wrong.webp`: animals then everyday objects: varied pictures
- again — `6-result.webp`: Stage 1 clear, two of three stars, confetti and the ninja; the speech bubble is unread
