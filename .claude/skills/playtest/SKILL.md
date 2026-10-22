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
- **`metrics.json`**, the measured numbers: the resolved settings (lives, gentle, speeds, stages), the input
  kind (bubbles, tracing, keypad), the prompt text and its word count, whether speech is offered, answers per
  wave, the bubble radius in CSS px, the time from launch to apex, the time a bubble stays above the question
  card, the slowest and fastest bubble, the share of the screen the card covers, and the visual card's needs
  (`slow`, `wide`). Cite a number as `metrics.json#<key>`.

**A key the file lacks, or a moment with no screenshot, is not observed.** Write "not observed" for it; never
fill it in from what the game probably does. **Score from the pack, never from the source code:** the source
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

**`physical`**
- **0** — A target leaves the reachable area before this child could read the prompt and react, by the
  profile's own reaction-time floor; or the radius is below the profile's minimum; or tracing needs precision
  the profile lacks.
- **1** — Manageable at the first stage, but a later stage's speed or the answers per wave push past the
  profile's floor; or bubbles overlap so a slice catches the wrong one.
- **2** — Every measured bubble stays above the card comfortably longer than the profile's floor, at or above
  its minimum radius, with room between targets.

**`challenge`**
- **0** — Outside this year's programme of study by more than a year either way, or trivial at every stage.
- **1** — In range but flat across stages, one stage strays out of range, or the wrong answers are giveaways.
- **2** — Matches the statement it claims, rises in difficulty across stages, and the wrong answers are the
  mistakes a child of this year really makes.

**`feedback`**
- **0** — A wrong slice teaches nothing (no right answer shown), or the cost is harsh for the age: a life
  lost on a miss the child could not have reached, or an abrupt end.
- **1** — Right and wrong are shown, but not why; or lives run out mostly from speed rather than mistakes.
- **2** — The right answer is shown clearly and held long enough to read, and the cost of a mistake fits the
  age (Reception's gentle mode, a fair number of lives).

**`again`**
- **0** — Stressful or dull: the same prompt over and over, long waits, or a result screen the child cannot
  read.
- **1** — Pleasant but samey within a stage, or a reward the child would not notice.
- **2** — Brisk, varied within a stage, with a reward on the result screen this child understands.

### Anchors for the whole score

- **3** — A child of this age mostly fails or gives up; an adult has to sit with them throughout.
- **5** — Playable with help or after several tries; one serious problem — speed, reading load or range.
- **7** — Plays alone and learns, with friction in one or two places.
- **9** — Plays alone from the first screen, at the right challenge, and asks for another go; at most one
  criterion short of full marks.

## 3. Evidence and honesty

- **Every criterion's mark cites evidence**: at least one entry naming a screenshot file, a
  `metrics.json#<key>`, or a `live:` measurement. **A mark with no evidence is a 0.**
- **Anything not observed is written as "not observed", never guessed.** A whole criterion not observed is
  a 0, and the note says the pack lacked it, so the run recaptures the pack rather than filing a game issue.
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
{"game":"y1-add","year":"year1","by":"playtester-year1","score":7,"criteria":{"understand":2,"physical":1,"challenge":2,"feedback":1,"again":1},"evidence":[{"criterion":"understand","ref":"2-prompt.webp","saw":"5-word sum, speaker button shown"},{"criterion":"physical","ref":"metrics.json#aboveCardMs","saw":"bubbles reachable 4.5 s at stage 1"},{"criterion":"challenge","ref":"2-prompt.webp","saw":"6 + 1, within 20"},{"criterion":"feedback","ref":"5-wrong.webp","saw":"right answer filled in, one heart lost"},{"criterion":"again","ref":"6-result.webp","saw":"one star and a cheer by name"}],"note":"Right sums for Year 1, but the later waves move too fast to read and slice."}
```

- **`game`** — the topic id, the pack's folder name. **`year`** — the pack's `YearId`.
- **`by`** — the profile's own agent name, exactly: `playtester-year1`, `playtester-parent`.
- **`score`** — a whole number from 0 to 10, equal to the sum of the five criteria.
- **`criteria`** — the five keys of §2, each a whole number 0, 1 or 2.
- **`evidence`** — at least one entry per criterion, each `{ criterion, ref, saw }`. `saw` says what the ref
  shows, in a few words, or "not observed".
- **`note`** — one sentence a teacher would recognise, in British English.

Before handing over, check every row: the sum, all five keys, at least one evidence entry per key, `by`
spelt as the agent's name. Write the rows to the file the caller names, or, with none named, return them in
one fenced `jsonl` block. Then add a two-line summary: the score distribution, and whether the honesty check
fired.
