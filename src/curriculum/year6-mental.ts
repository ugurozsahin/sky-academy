// y6-mental (#1256): mental calculation with large numbers (NC 6 ASMD). d1 adds or takes round numbers (multiples of 10,000),
// d2 a times-table fact scaled by powers of ten (× or its inverse ÷), d3 two operations with × or ÷ written first so left-to-right
// and the order of operations agree. All integer maths. The place-value-shift decoy (×10, ÷10) comes first, as #1058 asks.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MINUS = '−', MAX = 10_000_000;
const show = (n: number) => fmt(dec(n, 0));
const lead = (n: number) => String(n)[0];

/** d1: add or subtract multiples of 10,000 (sometimes 50,000); the answer is 100,000 to 10,000,000. */
function round(rng: Rng): { prompt: string; ans: number; named: number[] } {
  const step = pick(rng, [10_000, 50_000]), add = rng() < 0.5;
  for (;;) {
    const a = step * ri(rng, 2, MAX / step - 1), b = step * ri(rng, 1, 40_000 / (step / 10_000) / 4);
    const ans = add ? a + b : a - b;
    if (ans < 100_000 || ans > MAX || b < 10_000) continue;
    return { prompt: `${show(a)} ${add ? '+' : MINUS} ${show(b)} = ?`, ans, named: [add ? a - b : a + b] };
  }
}

/** A table fact `a × b` with `i + j` zeros shared out, so the card reads "60 × 700". Returns the two factors and their product. */
function fact(rng: Rng): { x: number; y: number; prod: number } {
  for (;;) {
    const a = ri(rng, 2, 12), b = ri(rng, 2, 12), i = ri(rng, 0, 3), j = ri(rng, 0, 3);
    if (i + j < 1 || a * b * 10 ** (i + j) > MAX) continue;
    return { x: a * 10 ** i, y: b * 10 ** j, prod: a * b * 10 ** (i + j) };
  }
}

/** d2: `x × y`, or the inverse `prod ÷ y` with a whole quotient. */
function scaled(rng: Rng): { prompt: string; ans: number; named: number[] } {
  const { x, y, prod } = fact(rng);
  return rng() < 0.5
    ? { prompt: `${show(x)} × ${show(y)} = ?`, ans: prod, named: [x + y] }
    : { prompt: `${show(prod)} ÷ ${show(y)} = ?`, ans: x, named: [prod - y] };
}

/** d3: a × or ÷ first, then a + or − of a near-round number. Answers stay 1 to 10,000,000. */
function twoStep(rng: Rng): { prompt: string; ans: number; named: number[] } {
  for (;;) {
    const { x, y, prod } = fact(rng), times = rng() < 0.5, first = times ? prod : x;
    const c = pick(rng, [99, 999, 9_999, 250, 1_250, 750, 2_500, 5_000, 125]), add = rng() < 0.5;
    const ans = add ? first + c : first - c;
    if (ans < 1 || ans > MAX || first < 100) continue;
    const head = times ? `${show(x)} × ${show(y)}` : `${show(prod)} ÷ ${show(y)}`;
    return { prompt: `${head} ${add ? '+' : MINUS} ${show(c)} = ?`, ans, named: [first, add ? first - c : first + c] };
  }
}

/** Three decoys: a place-value shift first, then the named slips, then column slips sharing the answer's last and leading digit. */
function decoys(rng: Rng, ans: number, named: number[]): number[] {
  const valid = (v: number) => Number.isInteger(v) && v >= 1 && v <= MAX && v !== ans;
  const shifts = shuffle(rng, [ans * 10, ans / 10]).filter(valid);
  const slips = [10, 100, 1000, 10_000].flatMap(k => [ans + k, ans - k]).filter(v => valid(v) && lead(v) === lead(ans));
  const ds = [...new Set([...shifts.slice(0, 1), ...named.filter(valid), ...shifts.slice(1), ...slips])];
  const out = ds.slice(0, 3);
  if (ans >= 20) {
    const both = (v: number) => v % 10 === ans % 10 && lead(v) === lead(ans);
    const shares = (list: number[]) => list.some(v => v % 10 === ans % 10) && list.some(v => lead(v) === lead(ans));
    const fix = slips.find(v => both(v) && !out.includes(v));
    if (!shares(out) && fix !== undefined) out[out.length - 1] = fix;
  }
  for (let k = 1; out.length < 3; k++) for (const v of [ans + k * 10, ans - k * 10]) if (valid(v) && !out.includes(v) && out.length < 3) out.push(v);
  return out;
}

export const y6Mental: Generator = (d: Difficulty, rng: Rng): Question => {
  const { prompt, ans, named } = d === 1 ? round(rng) : d === 2 ? scaled(rng) : twoStep(rng);
  const card: Question = {
    prompt, say: ks2Say(prompt.replace('=', 'equals').replace('?', 'what')), answer: show(ans),
    options: shuffle(rng, [ans, ...decoys(rng, ans, named)].map(show)),
  };
  return d === 3 ? { ...card, slow: true } : card;
};
