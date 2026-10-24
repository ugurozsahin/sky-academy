// y4-story-md (#1141): problems that multiply and add, from the NC Year 4 wording. d1 is the distributive law
// (39 × 7 = 30 × 7 + 9 × 7), d2 integer scaling ("six times as tall"), d3 correspondence (starters × mains) and
// multiply-then-add. The decoys are the slips each form invites (the sum for the product, the product without the add,
// the other partial product). Every card also keeps an answer-units-digit twin and a leading-digit twin (#1058), so
// neither digit gives the answer away; a test counts both over 2,000 draws.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

/** Text before and after the number on a bubble: `£` before, `m` after. */
export type Unit = readonly [pre: string, post: string];

/** [unit, text]. `{a}` is the base measure, `{b}` the scale factor. */
export const SCALING: readonly (readonly [Unit, string])[] = [
  [['', ' m'], 'A fence is {a} m long. A wall is {b} times as long. How long is the wall?'],
  [['', ' cm'], 'A pencil is {a} cm long. A ruler is {b} times as long. How long is the ruler?'],
  [['', ' kg'], 'A cat weighs {a} kg. A pony is {b} times as heavy. How heavy is it?'],
  [['', ' g'], 'A mouse weighs {a} g. A rat is {b} times as heavy. How heavy is it?'],
  [['£', ''], 'A pen costs £{a}. A bag costs {b} times as much. How much is the bag?'],
  [['', ' l'], 'A jug holds {a} l. A tank holds {b} times as much. How much is that?'],
  [['', ' min'], 'A song lasts {a} min. A film is {b} times as long. How long is it?'],
];

/** [text, kind]. `{a}` and `{b}` are the two counts; `add` cards also have `{c}`, the loose extras. */
export const COUNTING: readonly (readonly [string, 'cor' | 'add'])[] = [
  ['A menu has {a} starters and {b} mains. How many meals of one of each?', 'cor'],
  ['A shop has {a} hats and {b} scarves. How many hat and scarf pairs?', 'cor'],
  ['There are {a} tops and {b} skirts. How many different outfits?', 'cor'],
  ['A stall has {a} cones and {b} flavours. How many ice creams?', 'cor'],
  ['A bike comes in {a} sizes and {b} colours. How many different bikes?', 'cor'],
  ['A bar has {a} breads and {b} fillings. How many different sandwiches?', 'cor'],
  ['There are {a} packs of {b} pens and {c} loose pens. How many pens?', 'add'],
  ['{a} boxes hold {b} eggs each, plus {c} spare eggs. How many eggs?', 'add'],
  ['{a} bags of {b} apples and {c} more apples. How many apples?', 'add'],
  ['{a} rows of {b} chairs and {c} extra chairs. How many chairs?', 'add'],
  ['{a} trays of {b} buns and {c} buns on a plate. How many buns?', 'add'],
  ['{a} teams of {b} children and {c} helpers. How many people?', 'add'],
];

const f = (n: number) => fmt(dec(n, 0));
const label = (v: number, [pre, post]: Unit) => pre + f(v) + post;
const leading = (v: number) => String(v)[0];

/** Up to three decoys: the first misconception, then a units-digit twin and a leading-digit twin of the answer
 *  where it has none (answers of 20 or more), then the other misconceptions, then values just off the answer. */
export function decoyValues(rng: Rng, answer: number, misconceptions: readonly number[]): number[] {
  const out: number[] = [];
  const add = (v: number) => { if (Number.isInteger(v) && v > 0 && v !== answer && !out.includes(v) && out.length < 3) out.push(v); };
  const sign = () => rng() < 0.5 ? 1 : -1;
  const twin = (same: (v: number) => boolean, steps: readonly number[]) => {
    if (answer < 20 || out.some(same)) return;
    const s = sign();
    for (const k of steps) for (const sg of [s, -s]) { const v = answer + sg * k; if (v > 0 && same(v) && !out.includes(v)) return add(v); }
  };
  const unitsTwin = (v: number) => v % 10 === answer % 10, leadTwin = (v: number) => leading(v) === leading(answer);
  if (misconceptions.length) add(misconceptions[0]);
  // A second misconception is taken only while the slots left still cover the twins it does not already supply.
  const second = misconceptions[1];
  if (second !== undefined && Number.isInteger(second) && second > 0 && second !== answer && !out.includes(second)) {
    const missing = answer < 20 ? 0 : [unitsTwin, leadTwin].filter(same => ![...out, second].some(same)).length;
    if (3 - out.length - 1 >= missing) add(second);
  }
  twin(unitsTwin, [10, 20, 30]);
  twin(leadTwin, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let k = 1; out.length < 3 && k < 100; k++) add(answer + sign() * k);
  return out;
}

/** [text, ...]: `{m}` boxes of `{a}` things. The partition is the hint, not the card (#2276). */
export const GROUPS: readonly string[] = [
  '{m} boxes hold {a} pencils each. How many pencils?',
  '{m} bags hold {a} marbles each. How many marbles?',
  '{m} shelves hold {a} books each. How many books?',
  '{m} trays hold {a} buns each. How many buns?',
  '{m} jars hold {a} sweets each. How many sweets?',
  '{m} packs hold {a} stickers each. How many stickers?',
];

function distributive(rng: Rng): Question {
  const t = ri(rng, 2, 9), u = ri(rng, 1, 9), m = ri(rng, 3, 9), a = t * 10 + u;
  const tp = t * 10 * m, up = u * m, whole = a * m;
  const head = `${a} × ${m} = ${t * 10} × ${m} + ${u} × ${m}`;
  const partial = rng() < 0.5;
  const prompt = partial ? `${head} = ${f(tp)} + ?` : pick(rng, GROUPS).replace('{m}', f(m)).replace('{a}', f(a));
  const answer = partial ? up : whole;
  const wrong = partial ? [tp, whole] : [tp, up];
    const options = decoyValues(rng, answer, wrong).map(f);
  return partial ? wordQ(rng, prompt, f(answer), options, { say: ks2Say(prompt) })
    : wordQ(rng, prompt, f(answer), options, { say: ks2Say(prompt), hint: 'Split into tens and ones, multiply each', hintIsData: false });
}

function scaling(rng: Rng): Question {
  for (;;) {
    const [unit, text] = pick(rng, SCALING), a = ri(rng, 2, 12), b = ri(rng, 2, 12);
    if (a === b) continue; // a + b would equal a × b at 2 and 2; equal numbers read as a trick
    const prompt = text.replace('{a}', f(a)).replace('{b}', f(b));
    return wordQ(rng, prompt, label(a * b, unit), decoyValues(rng, a * b, [a + b]).map(v => label(v, unit)), { say: ks2Say(prompt) });
  }
}

function counting(rng: Rng): Question {
  for (;;) {
    const [text, kind] = pick(rng, COUNTING), a = ri(rng, 2, 9), b = ri(rng, 2, 12), c = ri(rng, 2, 9);
    if (a === b && kind === 'cor') continue;
    const answer = kind === 'cor' ? a * b : a * b + c;
    const prompt = text.replace('{a}', f(a)).replace('{b}', f(b)).replace('{c}', f(c));
    const wrong = kind === 'cor' ? [a + b] : [a * b, a * b * c];
    return wordQ(rng, prompt, f(answer), decoyValues(rng, answer, wrong).map(f), { say: ks2Say(prompt) });
  }
}

export const y4StoryMD: Generator = (d: Difficulty, rng): Question => d === 1 ? distributive(rng) : d === 2 ? scaling(rng) : counting(rng);
