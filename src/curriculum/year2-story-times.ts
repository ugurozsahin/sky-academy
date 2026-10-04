// y2-story-times (#995): short spoken story problems with the 2, 5 and 10 tables — equal groups (×), sharing and
// grouping (÷). The answer is the template's operation on the two numbers in the prompt, so a test can recompute it.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, numQ } from './util';

/** Equal groups: `{g}` groups, `{e}` in each. The answer is g × e. */
export const TIMES: string[] = [
  'There are {g} bags with {e} apples in each bag. How many apples?',
  '{g} children each have {e} stickers. How many stickers altogether?',
  'A pack has {e} pencils. How many pencils are in {g} packs?',
  '{g} plates have {e} biscuits on each plate. How many biscuits in all?',
  '{g} frogs each eat {e} flies. How many flies do they eat?',
  'There are {g} boxes with {e} crayons in each. How many crayons?',
];
/** Sharing: `{t}` shared equally between `{k}`. The answer is t ÷ k. */
export const SHARE: string[] = [
  '{t} sweets are shared equally between {k} children. How many each?',
  '{t} marbles are shared equally between {k} friends. How many each?',
  '{t} grapes are shared equally between {k} monkeys. How many each?',
];
/** Grouping: `{t}` put into groups of `{k}`. The answer is t ÷ k. */
export const GROUP: string[] = [
  '{t} pencils are put into packs of {k}. How many packs?',
  '{t} children go into teams of {k}. How many teams?',
  '{t} eggs are put into boxes of {k}. How many boxes?',
];

const fill = (s: string, v: Record<string, number>) => s.replace(/\{(\w)\}/g, (_, k: string) => String(v[k]));

export const y2StoryTimes: Generator = (d: Difficulty, rng: Rng): Question => {
  const times = d === 1 || (d === 3 && rng() < 0.5);
  const table = pick(rng, [2, 5, 10]);
  let prompt: string, ans: number, other: number, visual: Question['visual'];
  if (times) {
    // d1 keeps the array on the card: at most 3 rows of up to 10: more rows push the sideways duel bar past its budget.
    const g = d === 1 ? ri(rng, 2, 3) : ri(rng, 2, 10);
    ans = g * table; other = g + table;
    prompt = fill(pick(rng, TIMES), { g, e: table });
    if (d === 1) visual = { type: 'array', rows: g, cols: table };
  } else {
    const n = ri(rng, 2, 10);
    ans = n; other = n * table + table;
    prompt = fill(pick(rng, rng() < 0.5 ? SHARE : GROUP), { t: n * table, k: table });
  }
  // The two numbers added (the repeated-addition slip), then ± the table and ± 1; ± 2 is the spare.
  const pool = [other, ans + table, ans - table, ans + 1, ans - 1, ans + 2];
  const ok = pool.filter((x, i) => x >= 0 && x <= 100 && x !== ans && pool.indexOf(x) === i);
  const keep = ok[0] === other ? [other] : [];
  const ds = [...keep, ...shuffle(rng, ok.slice(keep.length))].slice(0, 3);
  return numQ(rng, prompt, ans, { min: 0, max: 100, distractors: ds, visual, say: prompt });
};
