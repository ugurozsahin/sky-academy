// y6-twounknowns (#1273): pairs that satisfy an equation with two unknowns (NC 6M32–33). d1 a + b = T, d2 2a + b = T or
// a × b = P with a < b, d3 count the pairs (marked `slow`). Many pairs work, so only one offered pair may fit: every
// decoy is checked against the equation, and the swapped answer of a symmetric equation is never offered.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { ks2Say } from './ks2say';

type Pair = [number, number];
const label = ([a, b]: Pair) => `${a} and ${b}`;

/** An equation card: the prompt, the answer pair, the test every pair must fail and the slip pairs worth offering. */
interface Card { prompt: string; ans: Pair; fits: (p: Pair) => boolean; slips: Pair[]; say: string; }

/** Three distinct decoys that fail the equation, slips first, then near misses of the answer. */
function decoys(c: Card, rng: Rng): Pair[] {
  const [a, b] = c.ans, out: Pair[] = [];
  const ok = (p: Pair) => p[0] >= 1 && p[1] >= 1 && p[0] <= 20 && p[1] <= 20 && !c.fits(p) && !out.some(o => o[0] === p[0] && o[1] === p[1]);
  const near: Pair[] = [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1], [a + 1, b + 1], [a - 1, b - 1], [a + 2, b], [a, b + 2]];
  for (const p of [...c.slips, ...shuffle(rng, near)]) if (out.length < 3 && ok(p)) out.push(p);
  return out;
}

const d1 = (rng: Rng): Card => {
  const a = ri(rng, 1, 20), b = ri(rng, 1, 20), t = a + b;
  if (t < 6 || t > 30 || a === b) return d1(rng);
  return { prompt: `a + b = ${t}. Which pair could a and b be?`, ans: [a, b], fits: p => p[0] + p[1] === t, slips: [[a + 1, b + 1]], say: `a plus b equals ${t}. Which pair could a and b be?` };
};

const d2Forms: ((r: Rng) => Card)[] = [
  r => {
    const k = ri(r, 2, 3), a = ri(r, 1, 12), b = ri(r, 1, 12), t = k * a + b;
    if (a === b) return d2Forms[0](r);
    return { prompt: `${k}a + b = ${t}. Which pair could a and b be?`, ans: [a, b], fits: p => k * p[0] + p[1] === t, slips: [[b, a]], say: `${k} a plus b equals ${t}. Which pair could a and b be?` };
  },
  r => {
    const a = ri(r, 2, 9), b = ri(r, a + 1, 12), p = a * b;
    return { prompt: `a × b = ${p}, and a is less than b. Which pair could a and b be?`, ans: [a, b], fits: q => q[0] * q[1] === p && q[0] < q[1], slips: [[a + 1, b], [a, b + 1]], say: `a times b equals ${p}, and a is less than b. Which pair could a and b be?` };
  },
];

/** Pairs of whole numbers from 1 to `m` that make `t`: a < b, any order with a and b different, or a ≤ b. */
export const countPairs = (m: number, t: number, mode: 'less' | 'order' | 'equal'): number => {
  let n = 0;
  for (let a = 1; a <= m; a++) for (let b = 1; b <= m; b++)
    if (a + b === t && (mode === 'order' ? a !== b : mode === 'less' ? a < b : a <= b)) n++;
  return n;
};

function d3(rng: Rng): Question {
  for (;;) {
    const m = ri(rng, 6, 9), t = ri(rng, 5, 17), ordered = rng() < 0.4;
    const less = countPairs(m, t, 'less'), order = countPairs(m, t, 'order'), equal = countPairs(m, t, 'equal');
    const ans = ordered ? order : less, flip = ordered ? less : order;
    if (ans < 2 || flip === ans || (!ordered && equal === less)) continue;
    const prompt = ordered
      ? `a and b differ, 1 to ${m}. Order matters. a + b = ${t}. How many pairs?`
      : `a and b: 1 to ${m}, a is less than b. a + b = ${t}. How many pairs?`;
    const spoken = ordered
      ? `a and b are different whole numbers from 1 to ${m}. Order matters. a plus b equals ${t}. How many pairs?`
      : `a and b are whole numbers from 1 to ${m}, and a is less than b. a plus b equals ${t}. How many pairs?`;
    const ds = [...new Set([flip, equal, ans + 1, ans - 1, ans + 2].filter(v => v >= 1 && v !== ans))].slice(0, 3);
    return { ...wordQ(rng, prompt, String(ans), ds.map(String), { say: ks2Say(spoken) }), slow: true };
  }
}

export const y6TwoUnknowns: Generator = (d: Difficulty, rng): Question => {
  if (d === 3) return d3(rng);
  const c = d === 1 ? d1(rng) : pick(rng, d2Forms)(rng);
  return wordQ(rng, c.prompt, label(c.ans), decoys(c, rng).map(label), { say: c.say });
};
