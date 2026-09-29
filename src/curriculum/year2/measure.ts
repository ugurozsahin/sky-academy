// Year 2 measurement, temperature, statistics and durations. Split out of year2.ts (#1416); index.ts re-exports every name.
import { type Generator, type Question, type Rng, LONGER, HEAVIER, HOLDS } from '../types';
import { ri, pick, shuffle, numQ, wordQ, measureCompare, unitChoice, measureSum } from '../util';
import { clockPhrase } from './number';

// ---------- Measurement (#8, #298) ----------
// Year 2 measurement is compare and order, choose the sensible unit, and add or subtract within one unit
// (#298). The "1 metre = ? cm" conversions these three used to ask are Year 3/4 and needed three-digit
// numbers, so they are gone. Bringing the comparisons inside 100 took both moves, not one: a larger-unit
// draw (a 4 kg crate against a 17 kg sack) *and* smaller objects in the small unit, because a sack does not
// weigh 60 g. Every noun below is colour-neutral — `measureCompare` renders `${colour} ${noun}` and the
// colour is the answer, so a green orange or a purple lemon is a card this project will not show.
export const y2Length: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['rope', 'ribbon', 'plank', 'path']), 'cm', LONGER, 10, 99)
    : measureCompare(rng, d, pick(rng, ['fence', 'wall', 'ladder', 'pipe']), 'm', LONGER, 2, 40);
  if (kind === 1) return unitChoice(rng, [['pencil', 'cm'], ['finger', 'cm'], ['book', 'cm'], ['door', 'm'], ['room', 'm'], ['garden', 'm'], ['playground', 'm']], 'cm', 'm', 'measure');
  return measureSum(rng, 'cm', ['How long altogether?', 'How long is left?']);
};
export const y2Mass: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['spoon', 'sock', 'pebble', 'candle']), 'g', HEAVIER, 20, 99)
    : measureCompare(rng, d, pick(rng, ['sack', 'crate', 'suitcase', 'barrel']), 'kg', HEAVIER, 2, 20);
  if (kind === 1) return unitChoice(rng, [['feather', 'g'], ['apple', 'g'], ['coin', 'g'], ['cat', 'kg'], ['dog', 'kg'], ['bag of flour', 'kg']], 'g', 'kg', 'weigh');
  return measureSum(rng, 'g', ['How heavy altogether?', 'How much is left?']);
};
export const y2Capacity: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['eggcup', 'lid', 'spoon', 'pot']), 'ml', HOLDS, 20, 99)
    : measureCompare(rng, d, pick(rng, ['bucket', 'tank', 'barrel', 'watering can']), 'l', HOLDS, 2, 20);
  if (kind === 1) return unitChoice(rng, [['teaspoon', 'ml'], ['cup', 'ml'], ['mug', 'ml'], ['bath', 'l'], ['bucket', 'l'], ['paddling pool', 'l']], 'ml', 'l', 'measure');
  return measureSum(rng, 'ml', ['How much altogether?', 'How much is left?']);
};
/** Minimum °C between an estimate's answer and each decoy, and between decoys (#296). */
export const TEMP_GAP = 10;
const TEMP_STEP = TEMP_GAP * 2;
// the ladder's rung: twice the floor — the rail below checks the floor and the resulting gaps, not this constant, so a regression to TEMP_GAP would still pass at exactly 10 °C apart
export const y2Temp: Generator = (d, rng) => {
  if (d >= 2 && rng() < 0.4) {
    const [thing, t] = pick(rng, [['ice', 0], ['a cold morning', 5], ['a warm room', 20], ['a hot bath', 40], ['a summer day', 28], ['inside a fridge', 4]] as [string, number][]);
    // #296: an estimate has no exact answer, so a decoy 1 °C away is as true as the answer. Decoys sit on a
    // ladder of `TEMP_STEP` (20 °C) either side of it — none is defensible (a fridge at 24 °C, a summer day at
    // 8 °C) and none is close to another. The ladder is derived from `TEMP_GAP`, the floor the rail holds.
    const ds = shuffle(rng, [1, 2, 3, -1, -2, -3].map(k => t + k * TEMP_STEP).filter(x => x >= 0 && x <= 100)).slice(0, 3).map(x => `${x}°C`);
    return wordQ(rng, `Temperature of ${thing}?`, `${t}°C`, ds, { say: `About what temperature is ${thing}?` });
  }
  const warmer = rng() < 0.5;
  const [ca, cb] = shuffle(rng, ['the town', 'the hill', 'the beach', 'the park', 'the wood', 'the lake']).slice(0, 2);
  let a = ri(rng, 0, 35), b = a; while (b === a) b = ri(rng, 0, 35);
  const first = warmer ? a > b : a < b;
  // `hintIsData`, for the same reason as `measureCompare()`: the options are the two places, so the
  // temperatures live in this line and nowhere else on the card (#328).
  return wordQ(rng, `Which was ${warmer ? 'warmer' : 'colder'}?`, first ? ca : cb, [first ? cb : ca], { hint: `${ca}: ${a}°C · ${cb}: ${b}°C`, hintIsData: true, say: `${ca} was ${a} degrees. ${cb} was ${b} degrees. Which was ${warmer ? 'warmer' : 'colder'}?` });
};
// Y2 statistics (#8). Each survey is three categories the child picks out by emoji, so the chart can be read
// without reading the words — the labels carry the emoji and so does the prompt.
const SURVEYS: readonly { what: string; rows: readonly [string, string][] }[] = [
  { what: 'fruit', rows: [['🍎', 'apples'], ['🍌', 'bananas'], ['🍓', 'strawberries']] },
  { what: 'pet', rows: [['🐶', 'dogs'], ['🐱', 'cats'], ['🐰', 'rabbits']] },
  { what: 'way to school', rows: [['🚌', 'bus'], ['🚗', 'car'], ['🚲', 'bike']] },
  { what: 'colour', rows: [['🔴', 'red'], ['🔵', 'blue'], ['🟢', 'green']] },
  { what: 'playtime game', rows: [['⚽', 'football'], ['🪢', 'skipping'], ['🏃', 'tag']] },
];
/**
 * A pictogram's symbol is deliberately **not** one of the categories. Drawing every row with the first
 * category's emoji made the cats row four dogs, which is the one place a topic premised on "the chart can be
 * read without reading the words" worked against itself (#8 review). A neutral symbol keys as "1 ⭐ = 2" and
 * claims to be nothing.
 */
const PICTO_SYMBOL = '⭐';
/**
 * Reading categorical data: tally chart (d1), pictogram with a key (d2), block diagram (d3).
 * The visual carries the data and the prompt never repeats it — that is the skill being practised, so a
 * question whose `say` read the counts aloud would answer itself for a child listening.
 *
 * Degenerate data is prevented before the question is phrased, never recovered from afterwards: a tie makes
 * "which was most" two-answered and an equal pair makes "how many more" zero. Both are re-rolled **at the
 * difficulty asked for**. An earlier version recursed into `y2Stats(1, rng)` on a tie, which quietly served a
 * Legend-stage child the d1 tally chart in 5.3% of d3 draws, and terminated only because d1 happens to force
 * `ask = 'one'` — a guard twenty-five lines away from the recursion it was holding up (#8 review).
 */
export const y2Stats: Generator = (d, rng) => {
  const survey = pick(rng, SURVEYS);
  const kind = d === 1 ? 'tally' : d === 2 ? 'pictogram' : 'block';
  // The pictogram key is the whole of its difficulty: counts must be whole multiples of it or the drawing
  // lies, so they are rolled in steps of the key. A tally or a block diagram has no key (#133) and counts in
  // ones — `step` is the roll unit and nothing else; it never reaches the visual of a chart without a key.
  const step = kind === 'pictogram' ? pick(rng, [2, 5]) : 1;
  const roll = () => survey.rows.map(() => ri(rng, 1, kind === 'block' ? 9 : 6) * step);
  const ask = d === 1 ? 'one' : pick(rng, d === 2 ? ['one', 'total'] : ['total', 'more', 'most']);

  let counts = roll();
  const [i, j] = shuffle(rng, [0, 1, 2]).slice(0, 2);
  // Bounded, and each re-roll keeps `kind`, `each` and `ask` exactly as generated.
  const degenerate = () => ask === 'most'
    ? counts.filter(n => n === Math.max(...counts)).length > 1
    : ask === 'more' && counts[i] === counts[j];
  for (let tries = 0; tries < 20 && degenerate(); tries++) counts = roll();
  // The terminator: a re-roll can be unlucky twenty times, so end it deterministically rather than loop on.
  if (degenerate()) counts[ask === 'most' ? 0 : i] = Math.max(...counts) + step;

  const rows = survey.rows.map(([icon, name], k) => ({ label: `${icon} ${name}`, n: counts[k] }));
  const visual: Question['visual'] = kind === 'pictogram'
    ? { type: 'chart', kind, rows, each: step, icon: PICTO_SYMBOL }
    : { type: 'chart', kind, rows };
  const chart = kind === 'tally' ? 'tally chart' : kind === 'pictogram' ? 'pictogram' : 'block diagram';

  if (ask === 'total') {
    const total = counts.reduce((a, b) => a + b, 0);
    return numQ(rng, `How many children altogether?`, total, {
      visual, hint: `Add up the ${chart}`, hintIsData: false, say: `Look at the ${chart}. How many children are there altogether?`,
    });
  }
  if (ask === 'more') {
    const [hi, lo] = counts[i] > counts[j] ? [i, j] : [j, i];   // never a negative answer, and never zero
    const [hiIcon, hiName] = survey.rows[hi], [loIcon, loName] = survey.rows[lo];
    return numQ(rng, `How many more ${hiIcon} than ${loIcon}?`, counts[hi] - counts[lo], {
      visual, say: `Look at the ${chart}. How many more children chose ${hiName} than ${loName}?`,
    });
  }
  if (ask === 'most') {
    const best = counts.indexOf(Math.max(...counts));
    return wordQ(rng, `Which did most children choose?`, survey.rows[best][1],
      survey.rows.filter((_, k) => k !== best).map(r => r[1]),
      { visual, say: `Look at the ${chart}. Which one did most children choose?` });
  }
  const k = ri(rng, 0, survey.rows.length - 1);
  const [icon] = survey.rows[k];
  return numQ(rng, `How many chose ${icon}?`, counts[k], {
    visual, hint: `Read the ${chart}`, hintIsData: false, say: `Look at the ${chart}. How many children chose this one?`,
  });
};
/**
 * Year 2 durations (#298 slice 3). Year 2 asks for two time facts — minutes in an hour, hours in a day — and
 * for one thing this topic never did: "compare and sequence intervals of time". Seconds in a minute, days in
 * a week, days in a fortnight, weeks in a year and the days in a named month are all Year 3 ("know the number
 * of seconds in a minute and the number of days in each month, year and leap year"), and the month-order draw
 * that took 35% of the cards is Year 1's, already covered by `y1-months`. All of that has left the topic.
 *
 * What replaces it, by stage: d1 the four facts below, d2 comparing intervals, d3 an end time.
 */
const DUR_FACTS: [string, number][] = [['minutes in an hour', 60], ['hours in a day', 24], ['minutes in half an hour', 30], ['minutes in a quarter of an hour', 15]];
/**
 * The intervals a comparison card draws from. Every phrase here is a **bubble label**, so each is kept as
 * short as `y2-time`'s longest (`quarter past 12`) — which is why `half an hour` appears and
 * `a quarter of an hour` does not. The values are distinct, so "the longest" of any subset is never a tie.
 */
const INTERVALS: [string, number][] = [['10 minutes', 10], ['15 minutes', 15], ['20 minutes', 20], ['half an hour', 30], ['40 minutes', 40], ['50 minutes', 50], ['1 hour', 60]];
/** Durations that land the end time back on Year 2's o'clock / quarter / half grid, so it has a clock phrase. */
const GRID_DURATIONS: [string, number][] = [['a quarter of an hour', 15], ['half an hour', 30], ['three quarters of an hour', 45], ['an hour', 60]];
/** Compare `n` intervals: which takes the longest, or the shortest. `n === 2` is the comparative form. */
function intervalCompare(rng: Rng, n: number): Question {
  const chosen = shuffle(rng, INTERVALS).slice(0, n);
  const big = rng() < 0.5;
  const target = chosen.reduce((best, cur) => (big ? cur[1] > best[1] : cur[1] < best[1]) ? cur : best);
  const ask = n === 2 ? (big ? 'Which takes longer?' : 'Which takes less time?') : (big ? 'Which takes the longest?' : 'Which takes the shortest?');
  // No hint: the bubbles *are* the durations, so a hint listing them again would only repeat the question —
  // and a hint is the one line a landscape phone can hide (#328). `optionsAreContent` tells `repeatKey`
  // (#451) that this generator's question lives in `options`, since no other field carries it.
  return wordQ(rng, ask, target[0], chosen.filter(c => c !== target).map(c => c[0]), { say: `${chosen.map(c => c[0]).join(', ')}. ${ask}`, optionsAreContent: true });
}
/**
 * "It starts at 3 o'clock and lasts half an hour. When does it end?" — a start on the quarter grid plus a
 * duration that keeps the end on it. The decoys are the mistakes the question is about: not adding at all,
 * adding a whole hour, and overshooting or undershooting by a quarter. They are taken in order until three
 * distinct ones are found, because the offsets collide for some durations (`45 + 15` and `60` are one time).
 */
function endTime(rng: Rng): Question {
  const h = ri(rng, 1, 12), m = pick(rng, [0, 15, 30, 45]);
  const [phrase, mins] = pick(rng, GRID_DURATIONS);
  const at = (t: number) => clockPhrase((Math.floor(t / 60) - 1) % 12 + 1, t % 60);
  const start = h * 60 + m;
  const ans = at(start + mins);
  const ds: string[] = [];
  for (const o of [0, mins + 15, mins - 15, 60, 30]) {
    if (o === mins) continue;
    const l = at(start + o);
    if (l !== ans && !ds.includes(l)) ds.push(l);
    if (ds.length === 3) break;
  }
  const said = `It starts at ${clockPhrase(h, m)} and lasts ${phrase}. When does it end?`;
  return wordQ(rng, said, ans, ds, { say: said });
}
export const y2Duration: Generator = (d, rng) => {
  if (d === 1) {
    const [phrase, n] = pick(rng, DUR_FACTS);
    return numQ(rng, `How many ${phrase}?`, n, { min: 0, max: 100, say: `How many ${phrase}?`, distractors: [n + 1, n - 1, n === 60 ? 30 : n * 2] });
  }
  if (d === 2) return intervalCompare(rng, rng() < 0.5 ? 2 : 3);
  return endTime(rng);
};
