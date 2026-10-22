---
name: playtest
description: Score a Sharpwise game's playability out of 10 for one age profile, from its play pack. Use when running a playtester agent, or when scoring games for the game catalogue's playability field.
---
# Playtest a game

The eight profiles in `.claude/agents/` (`playtester-reception`, `playtester-year1` … `playtester-year6`,
`playtester-parent`) say **who** is playing. This file says **how** any of them scores: one rubric, its
anchors, the evidence and honesty rules, and the row every profile writes. Epic #2192: the packs come from
item K (#2205), the rows are checked and written into the game catalogue by item L1 (#2206), and the full run
is item L2 (#2207). A profile scores; it never edits code, the catalogue or a pack.

## 1. Read the pack

A pack is one game played once, for one year, the way a child meets it on a 390×844 phone:
`playtest-packs/<year>/<game>/`, where `<game>` is the topic id (`y1-add`) and `<year>` the `YearId`
(`year1`). It holds:

- **Up to six WebP screenshots**, in play order: the island tile, the first prompt, the first wave rising, the
  wave at its apex, just after one deliberate wrong slice, and the stage result. Tracing and keypad games have
  their own equivalent moments. List the folder and open each image with `Read`; cite each by its file name.
- **`metrics.json`**, the measured numbers: the resolved settings (lives, gentle, and the per-stage `speeds`
  and `diffs`), the input kind (bubbles, tracing, keypad), the prompt text and its word count, whether speech is
  offered, answers per wave, the bubble radius in CSS px, the time from launch to apex, the time a bubble stays
  above the question card, for a sequence game each required label's reach over its relaunches (`labelReachMs`),
  the slowest and fastest bubble, the share of the screen the card covers, and the visual card's needs (`slow`,
  `wide`). Cite a number as `metrics.json#<key>`, and a nested one by its path (`metrics.json#aboveCardMs.min`).
- **A sequence game's first question is missed on purpose.** The pack slices nothing until a required label has
  used every relaunch, to time its whole chance, so `metrics.json#livesAfterLabelsRanOut` and the result shot may
  show one miss the pack chose. It is not a child's mistake: never mark `feedback` or `again` down for it.
- **A pack plays stage 1 only.** Judge the later stages from the resolved settings: a higher `speeds` entry is a
  shorter flight, a higher `diffs` entry harder questions. Say so in the evidence (`metrics.json#settings.speeds`);
  §2 has the one way to estimate a later stage's reach.

**A key the file lacks, or a moment with no screenshot, is not observed.** Write "not observed" for it; never
fill it in from what the game probably does. Speech the pack does not show playing by itself counts as a
button the child must find and press. **Score from the pack, never from the source code:** the source
says what the game intends, the pack shows what the child gets.

**Driving the live game is optional, for a doubtful case only** — a metric that looks wrong, or a moment the
pack missed. Serve a build with `npm run build` and `npx vite preview`, launch Chromium through
`launchSilent` in `tests/e2e/mute.mjs` (never a visible or audible browser) at 390×844 with touch, and read
`window.__sna.state()` and `window.__sna.bubbles()` — the hooks `.claude/rules/game.md` lists. Keep the real
clock: never call `setSpeed`. Throwaway scripts go in your scratchpad and are deleted after. Cite what you
measured as `live:<what>`, for example `live:bubble above card 2.9 s at stage 3`.

## 2. The rubric: five criteria, 0 to 2 each, summed to a whole score out of 10

Mark each criterion for **this profile's child**, using the profile's own numbers (reading level, number
range, reaction time, target size, attention).

**The time a bubble needs**, for `physical`, is the sum of these parts, in seconds. Count words only: numerals and
maths symbols are read at a glance from Year 1 up, and Reception reads neither.
- **The profile's reaction floor.**
- **The words on the bubbles**, all of them, at the cautious end: a child reads them in turn until one fits (word
  count ÷ the profile's words a minute).
- **The question line**, when the pack shows the wave launching before it could be read. **A line that is the
  same every wave is read once per game, so it is not in the per-wave need** — y1-order's `Smallest to biggest!`
  is one, and so is a fixed instruction under the question line. Tell it from the pack: the question line in
  `2-prompt.webp` (wave 1) and in `5-wrong.webp` (wave 2) is the same text. A sequence game hides the line once
  slicing starts; there, read `prompt` from `window.__sna.state()` over two waves live (§1) and cite it as `live:`.
  When the lines differ, or neither shows them, count the line.
- **Card text, only when the child must read it to choose the answer**, as with y6-lists' gap sentence. Count it
  once per wave. A picture does not count, nor a card that only repeats the question line.
- **Working time**, a judgement, not a published norm: **a recalled fact adds 0** (a times-table answer, a number
  bond), and **each further mental step the question needs adds 1 s**. `0.4 × 3` is recall 4 × 3, then adjust the
  place value: one step, 1 s. Every `physical` `saw` names the steps it counted.

Compare that need with the bubble's **reach**, its reachable time (`aboveCardMs`, its smallest value,
in milliseconds: divide by 1000), as a percentage: reach ÷ need, both in seconds.

**A `sequence` game's reach is `labelReachMs.min`, not `aboveCardMs`** (#2251, the product owner's decision).
- **Why:** a required label that falls unsliced is sent back up, up to `metrics.json#labelReach.maxRelaunches`
  times. So its reach is its total time below the card over its first flight and every relaunch, until it is sliced
  or its relaunches run out. `aboveCardMs` times one flight of any bubble, decoys included, so it is not used.
- **A label cut short:** when `metrics.json#labelReach.cutShortBelowMin` is above 0, a label the question's end cut
  short had had less reach than `labelReachMs.min`. Take the smallest such `reachMs` in `labelReach.labels` as the
  reach instead, and say so in `saw`.
- **Later stages:** it is `reach_1` in the estimate below.
- **What it does not cover:** waiting for a label to come back is judged under `again` (pace) and `feedback`, not
  `physical`.

**A later stage's reach** is estimated, never guessed, one way. Stages count from 1, so stage k plays
`speeds[k-1]`: `reach_k ≈ reach_1 × airTime[speeds[k-1]] / airTime[speeds[0]]`. `airTime` is
`defaults.settings.airTime` in `src/config/catalogue.json`, unless the game overrides it; the pack carries the
resolved table as `metrics.json#settings.airTime`. A `speeds` value indexes `airTime` from 0, so speed 1 is its
second entry. **Ease the speed before indexing:** a `sequence` game (`metrics.json#sequence`) or a `slow` one
(`metrics.json#slow`) flies one speed lower at every stage, never below 1, or below 0 in a gentle year
(`metrics.json#settings.gentle`), per `eased()` in `src/game/modes.ts`; use the eased speed on both sides of the
ratio. A pack plays stage 1 only, so it cannot show that a later stage's questions turn `slow`; the estimate is
then the cautious bound. The highest eased speed is the shortest flight, so that stage decides. Cite
`metrics.json#settings.speeds` and put the arithmetic in `saw`: `stage 3 at speed 3: 5.27 × 3.4 / 5.6 = 3.2 s`.

| Key | Criterion | The question |
|---|---|---|
| `understand` | Understands what to do | Can this child work out the task from the screen, the speech and the demo, without an adult? |
| `physical` | Can physically do it | Bubble air time and speed, target size, how far the finger must slice, the time to answer. |
| `challenge` | Right challenge | The numbers, words and ranges against this year's programme of study. Too easy is a loss too. |
| `feedback` | Feedback and recovery | What a wrong slice shows, whether the game says why, whether lives feel fair. |
| `again` | Wants another go | Pace, variety within a stage, reward and clarity. |

### Anchors for each criterion

**`understand`**
- **0** — The child cannot tell what to slice: the prompt is above their reading level and speech is not
  offered, or the prompt and the bubbles do not obviously match (a word answer to a number prompt).
- **1** — Workable after one wrong try, or only with the speech button; the prompt is longer than the
  profile reads comfortably, or the visual card is cramped at phone size.
- **2** — Clear from the first screen: the prompt is within their reading level or spoken, the visual card is
  legible, and the answer bubbles are the kind of thing the prompt asks for.

**`physical`** — a band, not a cliff: a near miss is a 1, a clear miss a 0. The lowest anchor any clause reaches
is the mark. Each `physical` mark's `saw` states the need, the reach and the percentage.
- **0** — The stage-1 reach is below **75%** of the need; or the radius is below the profile's floor; or tracing
  needs precision the profile lacks.
- **1** — The stage-1 reach is at least 75% but below 100% of the need; or stage 1 meets the need but a later stage's estimated
  reach does not; or the radius is at or above the floor but below the comfortable size; or bubbles overlap so a
  slice catches the wrong one.
- **2** — Every stage's estimated reach meets the need, and the radius is at or above the profile's comfortable
  size, with room between targets.

**`challenge`**
- **0** — Outside this year's programme of study by more than a year either way, or trivial at every stage.
- **1** — In range but flat across stages, one stage strays out of range, or the wrong answers are giveaways.
- **2** — Matches the statement it claims, rises in difficulty across stages (the resolved
  `diffs`), and the wrong answers are the
  mistakes a child of this year really makes.

**`feedback`**
- **0** — A wrong slice teaches nothing (no right answer shown), or the game ends abruptly with no way back.
- **1** — Right and wrong are shown, but not why; or lives run out mostly from misses the child could not reach
  in time, by speed or reading time, rather than from mistakes. The why is anything beyond the right answer — a
  worked step, a picture, a sounded-out word; a filled-in number sentence alone is the answer, not the why.
- **2** — The right answer is shown clearly and held long enough to read (the wrong-slice shot shows it still on
  screen), and the cost of a mistake fits the
  age (Reception's gentle mode, a fair number of lives).

**`again`**
- **0** — Stressful or dull: the same prompt over and over, long waits, or a result screen the child cannot
  read.
- **1** — Pleasant but samey within a stage, or a reward the child would not notice.
- **2** — Brisk, varied within a stage, with a reward on the result screen this child understands.

### Anchors for the whole score

The score is always the sum of the five marks. These bands are a cross-check: when a sum lands in a band that does
not describe the game, re-read the criteria, but never adjust the sum to fit a band.

- **3** — A child of this age mostly fails or gives up; an adult has to sit with them throughout.
- **5** — Playable with help or after several tries; one serious problem — speed, reading load or range.
- **7** — Plays alone and learns, with friction in one or two places.
- **9** — Plays alone from the first screen, at the right challenge, and asks for another go; at most one
  criterion short of full marks.

## 3. Evidence and honesty

- **Every criterion's mark cites evidence**: at least one entry naming a screenshot file, a
  `metrics.json#<key>`, or a `live:` measurement. **A mark with no evidence is a 0.**
- **Anything not observed is written as "not observed", never guessed.** **A whole criterion
  the pack says nothing about is a capture gap, not a score:** write no row for that game, and list it in the
  summary as `not scored: <game> — pack lacks <criterion>`, so the run recaptures the pack. A low score that
  is really a missing screenshot would reach the catalogue looking like a verdict on the game.
- **Score what the child would experience, not what the game intends.** A demo the child cannot read is no
  demo; a speech button they do not know to press is no speech.
- **Honesty check before submitting.** If more than 40% of one profile's games score 8 or above, re-justify
  every one of those top scores: for each criterion marked 2, name the evidence that rules out its 1 anchor,
  and lower any mark you cannot defend that way. Say in the summary that the check fired.
- **The profile's limits are the floor, not a guess.** Where the profile marks a number as uncertain, score
  against the cautious end of its range and say so in the evidence.

## 4. The row

One JSON object per game, one per line (JSON Lines), with exactly these keys:

```json
{"game":"y1-add","year":"year1","by":"playtester-year1","score":7,"criteria":{"understand":2,"physical":1,"challenge":2,"feedback":1,"again":1},"evidence":[{"criterion":"understand","ref":"2-prompt.webp","saw":"5-word sum, speaker button shown"},{"criterion":"physical","ref":"metrics.json#aboveCardMs.min","saw":"need 4 s, reach 5.37 s, 134% at stage 1; no words, working: 0 steps, a recalled fact"},{"criterion":"physical","ref":"metrics.json#settings.speeds","saw":"stage 4 at speed 3: 5.37 × 3.4 / 5.6 = 3.26 s, 82% of the need; working: 0 steps"},{"criterion":"challenge","ref":"2-prompt.webp","saw":"6 + 1, within 20"},{"criterion":"feedback","ref":"5-wrong.webp","saw":"right answer filled in, one heart lost"},{"criterion":"again","ref":"6-result.webp","saw":"one star and a cheer by name"}],"note":"Right sums for Year 1, but the later waves move too fast to read and slice."}
```

- **`game`** — the topic id, the pack's folder name. **`year`** — the pack's `YearId`.
- **`by`** — the profile's own agent name, exactly: `playtester-year1`, `playtester-parent`.
- **`score`** — a whole number from 0 to 10, equal to the sum of the five criteria.
- **`criteria`** — the five keys of §2, each a whole number 0, 1 or 2.
- **`evidence`** — at least one entry per criterion, each `{ criterion, ref, saw }`. `saw` says what the ref
  shows, in a few words, or "not observed".
- **`note`** — one sentence a teacher would recognise, in British English.

Before handing over, check every row: the sum, all five keys, at least one evidence entry per key, `by`
spelt as the agent's name, and every `ref` naming a file that is in the pack, a key that is in its
`metrics.json`, or a `live:` measurement you made. Write the rows to the file the caller names, or, with none named, return them in
one fenced `jsonl` block. Then add a two-line summary: the score distribution, and whether the honesty check
fired. List any game held back as `not scored`.
