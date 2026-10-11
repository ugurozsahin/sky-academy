// Year 6 ratio strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
//
// y6-ratio (#1268): relative sizes, unequal sharing and scale factor (NC Y6 Ratio and proportion). d1 "for every" (2 red beads to
// every 3 blue; 12 red, so 18 blue), d2 unequal sharing (a ratio share, or "3/5 of 30 are boys"), d3 scale factor of an enlarged
// rectangle, as text, `slow`. The decoys are the misconceptions: the additive slip (12 + (3 − 2) = 13), the other part, the equal share.
// import: y6-percentof
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

function card(rng: Rng, prompt: string, ans: number, named: number[], hint: string, slow = false): Question {
  const q = wordQ(rng, prompt, String(ans), decoys(rng, ans, named).map(String), { say: ks2Say(prompt), hint, hintIsData: false });
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
    const prompt = `For every ${q} ${noun(kx, q)} there are ${p} ${noun(ky, p)}. ${known} ${kx[2] ?? kx[1]}: how many ${ky[2] ?? ky[1]}?`;
    // additive slip, the amount given, the amount times the wrong part
    return card(rng, prompt, ans, [known + (p - q), known, known * p], 'Find how many groups, then multiply');
  }
}

/** d2: unequal sharing, as a ratio share or as a fraction of a whole. */
function sharing(rng: Rng): Question {
  if (rng() < 0.5) {
    for (;;) {
      const a = ri(rng, 1, 5), b = ri(rng, 1, 6), unit = ri(rng, 2, 12), total = (a + b) * unit;
      if (a === b || total > 120) continue;
      const [x, y] = pick(rng, PAIRS), thing = pick(rng, THINGS), askB = rng() < 0.5;
      const ans = (askB ? b : a) * unit, other = (askB ? a : b) * unit;
      const prompt = `${total} ${thing}: ${x} gets ${a} for every ${b} ${y} gets. How many for ${askB ? y : x}?`;
      return card(rng, prompt, ans, [other, total / 2, unit], 'Find the total number of parts first');
    }
  }
  for (;;) {
    const d = ri(rng, 3, 10), n = ri(rng, 1, d - 1), unit = ri(rng, 2, 12), total = d * unit;
    if (total > 120 || n * 2 === d) continue;
    const [whole, who] = pick(rng, WHOLES), askRest = rng() < 0.5;
    const ans = (askRest ? d - n : n) * unit, other = (askRest ? n : d - n) * unit;
    const prompt = `${n}/${d} of a ${whole} of ${total} are ${who}. How many ${askRest ? 'are not' : 'are'}?`;
    return card(rng, prompt, ans, [other, total / 2, unit], 'Find one part first');
  }
}

/** d3: an enlargement as text. Either the new longer side, or the scale factor from an old and a new length. */
function scale(rng: Rng): Question {
  const k = ri(rng, 2, 6);
  if (rng() < 0.5) {
    for (;;) {
      const s = ri(rng, 2, 9), l = ri(rng, s + 1, 10);
      if (l * k > 60) continue;
      const prompt = `A ${s} cm by ${l} cm rectangle, scale factor ${k}. New longer side, in cm?`;
      return card(rng, prompt, l * k, [l + k, s * k, l * k + k], 'Multiply the length by the scale factor', true);
    }
  }
  for (;;) {
    const old = ri(rng, 2, 10);
    if (old * k > 60) continue;
    const prompt = `A ${old} cm side becomes ${old * k} cm. What is the scale factor?`;
    return card(rng, prompt, k, [old * k - old, old * k, old + k], 'Divide the new length by the old length', true);
  }
}

export const y6Ratio: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? forEvery(rng) : d === 2 ? sharing(rng) : scale(rng);

export const Y6_RATIO: Topic[] = [
  { id: 'y6-ratio', title: 'Ratio and scale', icon: '⚖️', subject: 'maths', year: 'year6', strand: 'ratio', nc: 'Y6 R&P: relative sizes, unequal sharing, scale factor', gen: y6Ratio },

  // slot: y6-percentof
];
