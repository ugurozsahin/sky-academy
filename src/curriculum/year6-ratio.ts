// Year 6 ratio strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
//
// y6-ratio (#1268): relative sizes, unequal sharing and scale factor (NC Y6 Ratio and proportion). d1 "for every" (2 red beads to
// every 3 blue; 12 red, so 18 blue), d2 unequal sharing (a ratio share, or "3/5 of 30 are boys"), d3 scale factor of an enlarged
// rectangle, as text, `slow`. The decoys are the misconceptions: the additive slip (12 + (3 − 2) = 13), the other part, the equal share.
//
// y6-percentof (#1269): percentages of amounts (NC Y6 R&P: "15% of 360"). d1 50/25/10/20/75 % of multiples of 20 to 400, d2 5/15/30/35/45/60 %
// of multiples of 20 to 2,000, d3 a hand-written bank (discount, measures, comparison, remainder), `slow`. Every d2 card offers the 10 % step
// alone as a decoy, every discount card the discount itself.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { ks2Say } from './ks2say';
import type { Topic } from './types';

/** Bead-style contexts: a singular and plural for each of the two kinds, so "1 red bead" and "2 red beads" both read right. */
const KINDS: { x: [string, string, string?]; y: [string, string, string?] }[] = [
  { x: ['red bead', 'red beads', 'red'], y: ['blue bead', 'blue beads', 'blue'] },
  { x: ['boy', 'boys'], y: ['girl', 'girls'] },
  { x: ['cat', 'cats'], y: ['dog', 'dogs'] },
  { x: ['apple', 'apples'], y: ['pear', 'pears'] },
  { x: ['pen', 'pens'], y: ['pencil', 'pencils'] },
  { x: ['hen', 'hens'], y: ['duck', 'ducks'] },
];
const PAIRS: [string, string][] = [['Ali', 'Bea'], ['Tom', 'Zoe'], ['Mia', 'Sam'], ['Ravi', 'Jo']];
const THINGS = ['stickers', 'marbles', 'sweets', 'conkers'];
const WHOLES: [string, string][] = [['class', 'boys'], ['team', 'girls'], ['choir', 'boys'], ['club', 'girls']];

/** A whole number as printed on a card: commas from four digits (#1047). */
const lab = (v: number) => v.toLocaleString('en-GB');
const noun = (k: [string, string, string?], n: number) => n === 1 ? k[0] : k[1];
const lead = (v: number) => String(v)[0];
const last = (v: number) => String(v).slice(-1);

/**
 * Three distinct decoys. `named` come first (the first is always kept when valid). A whole-number answer of 20 or more also gets one
 * decoy sharing its last digit and one sharing its leading digit (#1058's leak rule); the rest are neighbours of the answer.
 */
function decoys(rng: Rng, ans: number, named: number[]): number[] {
  const ds: number[] = [];
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v !== ans && !ds.includes(v);
  const add = (v: number | undefined) => { if (v !== undefined && ds.length < 3 && ok(v)) ds.push(v); };
  add(named[0]);
  if (ans >= 20) {
    if (!ds.some(v => last(v) === last(ans))) add([ans + 10, ans - 10, ans + 20, ans - 20].filter(ok)[rng() < 0.5 ? 0 : 1] ?? ans + 10);
    if (!ds.some(v => lead(v) === lead(ans))) add([1, -1, 2, -2, 3, -3, 4, -4].map(t => ans + t).find(v => ok(v) && lead(v) === lead(ans) && last(v) !== last(ans)));
  }
  named.slice(1).forEach(add);
  for (let s = 1; ds.length < 3; s++) { add(ans + s); add(ans - s); }
  return ds.slice(0, 3);
}

function card(rng: Rng, prompt: string, ans: number, named: number[], hint: string, why: string, slow = false): Question {
  const q = wordQ(rng, prompt, lab(ans), decoys(rng, ans, named).map(lab), { say: ks2Say(prompt), hint, hintIsData: false, why });
  return slow ? { ...q, slow: true } : q;
}

/** d1: for every q X there are p Y; given some X (a multiple of q), how many Y? Or the other way round. */
function forEvery(rng: Rng): Question {
  for (;;) {
    const a = ri(rng, 1, 9), b = ri(rng, 1, 9), k = ri(rng, 2, 12), flip = rng() < 0.5;
    if (a === b) continue;
    const [q, p] = flip ? [b, a] : [a, b], known = q * k, ans = p * k;
    if (ans > 100) continue;
    const kind = pick(rng, KINDS), [kx, ky] = flip ? [kind.y, kind.x] : [kind.x, kind.y];
    const prompt = `For every ${q} ${noun(kx, q)} there ${p === 1 ? 'is' : 'are'} ${p} ${noun(ky, p)}. ${known} ${kx[2] ?? kx[1]}: how many ${ky[2] ?? ky[1]}?`;
    // additive slip, the amount given, the amount times the wrong part
    return card(rng, prompt, ans, [known + (p - q), known, known * p], 'Find how many groups, then multiply',
      `${known} is ${k} groups of ${q}, and ${k} × ${p} = ${ans}`);
  }
}

/** d2, a ratio share: "Ali gets 2 for every 3 Bea gets". */
function ratioShare(rng: Rng): Question {
  for (;;) {
    const a = ri(rng, 1, 5), b = ri(rng, 1, 6), unit = ri(rng, 2, 12), total = (a + b) * unit;
    if (a === b || total > 120) continue;
    const [x, y] = pick(rng, PAIRS), thing = pick(rng, THINGS), askB = rng() < 0.5;
    const ans = (askB ? b : a) * unit, other = (askB ? a : b) * unit;
    const prompt = `${total} ${thing}: ${x} gets ${a} for every ${b} ${y} gets. How many for ${askB ? y : x}?`;
    return card(rng, prompt, ans, [other, total / 2, unit], 'Find the total number of parts first',
      `${a + b} parts, each ${unit}. ${askB ? b : a} × ${unit} = ${ans}`);
  }
}

/** d2, a fraction of a whole: "3/5 of a class of 30 are boys". */
function fractionShare(rng: Rng): Question {
  for (;;) {
    const d = ri(rng, 3, 10), n = ri(rng, 1, d - 1), unit = ri(rng, 2, 12), total = d * unit;
    if (total > 120 || n * 2 === d) continue;
    const [whole, who] = pick(rng, WHOLES), askRest = rng() < 0.5;
    const ans = (askRest ? d - n : n) * unit, other = (askRest ? n : d - n) * unit;
    const prompt = `${n}/${d} of a ${whole} of ${total} are ${who}. How many ${askRest ? 'are not' : 'are'}?`;
    return card(rng, prompt, ans, [other, total / 2, unit], 'Find one part first',
      `${d} parts, each ${unit}. ${askRest ? d - n : n} × ${unit} = ${ans}`);
  }
}

const sharing = (rng: Rng): Question => rng() < 0.5 ? ratioShare(rng) : fractionShare(rng);

/** d3: an enlargement as text. Either the new longer side, or the scale factor from an old and a new length. */
function scale(rng: Rng): Question {
  const k = ri(rng, 2, 6);
  if (rng() < 0.5) {
    for (;;) {
      const s = ri(rng, 2, 9), l = ri(rng, s + 1, 10);
      if (l * k > 60) continue;
      const prompt = `A ${s} cm by ${l} cm rectangle, scale factor ${k}. New longer side, in cm?`;
      return card(rng, prompt, l * k, [l + k, s * k, l * k + k], 'Multiply the length by the scale factor', `Longer side: ${l} × ${k} = ${l * k} cm`, true);
    }
  }
  for (;;) {
    const old = ri(rng, 2, 10);
    if (old * k > 60) continue;
    const prompt = `A ${old} cm side becomes ${old * k} cm. What is the scale factor?`;
    return card(rng, prompt, k, [old * k - old, old * k, old + k], 'Divide the new length by the old length', `New ÷ old: ${old * k} ÷ ${old} = ${k}`, true);
  }
}

export const y6Ratio: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? forEvery(rng) : d === 2 ? sharing(rng) : scale(rng);

const PCT_D1 = [50, 25, 10, 20, 75], PCT_D2 = [5, 15, 30, 35, 45, 60];
const MEASURES: [string, string, number][] = [['kg', 'grams', 1000], ['litres', 'ml', 1000], ['m', 'cm', 100]];
const ITEMS: [string, string, string][] = [['children', 'walk to school', 'do not walk'], ['pages', 'have been read', 'are still to read'], ['sweets', 'are red', 'are not red'], ['seeds', 'have sprouted', 'have not sprouted']];

/** d1/d2: p % of an amount that is a multiple of 20, so the answer is whole. The 10 % step alone leads the decoys at d2. */
function percentOf(rng: Rng, d: 1 | 2): Question {
  const p = pick(rng, d === 1 ? PCT_D1 : PCT_D2), amount = 20 * ri(rng, 1, d === 1 ? 20 : 100), ans = amount * p / 100;
  const named = d === 1 ? [amount - ans, p, amount / 2] : [amount / 10, amount / 20, amount - ans];
  return card(rng, `${p}% of ${lab(amount)} = ?`, ans, named, d === 1 ? 'Find ten per cent first, then build up' : 'Find ten and five per cent first, then add',
    `5% of ${lab(amount)} is ${lab(amount / 20)}; ${p / 5} lots of that is ${lab(ans)}`);
}

/** d3: a hand-written bank of two-step and measures problems; every value is whole and at most 10,000. */
function percentWord(rng: Rng): Question {
  const t = ri(rng, 0, 3), p = pick(rng, [10, 20, 25, 30, 40, 50, 60, 75]);
  if (t === 0) {
    const price = 20 * ri(rng, 1, 15), off = price * p / 100;
    return card(rng, `A coat costs £${lab(price)}. It has ${p}% off. What is the new price in pounds?`, price - off, [off, price, price + off], 'Find the discount, then take it away', `${p}% of £${lab(price)} is £${lab(off)}, so pay £${lab(price - off)}`, true);
  }
  if (t === 1) {
    const [big, small, f] = pick(rng, MEASURES), n = ri(rng, 2, 9), q = pick(rng, [5, 15, 30, 40, 60]), ans = n * f * q / 100;
    return card(rng, `What is ${q}% of ${lab(n)} ${big}, in ${small}?`, ans, [ans * 10, n * q, ans / 10], 'Change to the small unit first', `${n} ${big} is ${lab(n * f)} ${small}; ${q}% of that is ${lab(ans)}`, true);
  }
  if (t === 2) {
    for (;;) {
      const a = 10 * ri(rng, 5, 30), b = 10 * ri(rng, 5, 30), pa = pick(rng, [20, 30, 40, 50, 60]), pb = pick(rng, [10, 20, 25, 40, 50, 75]);
      const va = a * pa / 100, vb = b * pb / 100;
      if (!Number.isInteger(va) || !Number.isInteger(vb) || va === vb) continue;
      return card(rng, `A: ${pa}% of ${a}. B: ${pb}% of ${b}. How many more in the bigger?`, Math.abs(va - vb), [va + vb, Math.min(va, vb), Math.abs(a - b)], 'Find both amounts, then subtract', `A is ${va}, B is ${vb}; they differ by ${Math.abs(va - vb)}`, true);
    }
  }
  const [what, did, not] = pick(rng, ITEMS), total = 20 * ri(rng, 2, 25), ans = total - total * p / 100;
  return card(rng, `${lab(total)} ${what}: ${p}% ${did}. How many ${not}?`, ans, [total * p / 100, total, total - p], 'Find the percentage, then take it away', `${p}% of ${lab(total)} is ${lab(total * p / 100)}; ${lab(total)} − ${lab(total * p / 100)} = ${lab(ans)}`, true);
}

export const Y6_RATIO: Topic[] = [
  { id: 'y6-ratio', title: 'Ratio and scale', icon: '⚖️', subject: 'maths', year: 'year6', strand: 'ratio', nc: 'Y6 R&P: relative sizes, unequal sharing, scale factor', gen: y6Ratio },
  { id: 'y6-percentof', title: 'Percentages of amounts', icon: '💯', subject: 'maths', year: 'year6', strand: 'ratio', nc: 'Y6 R&P: percentages of amounts, comparison', gen: (d, rng) => d === 3 ? percentWord(rng) : percentOf(rng, d) },
];
