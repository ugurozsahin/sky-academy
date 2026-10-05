// y4-tables (#1070): multiplication and division facts to 12 × 12, weighted the way the STA Multiplication Tables
// Check weights them (assessment framework §5.2.1, Table 1: 6, 7, 8, 9 and 12 most, 2 and 10 least).
// The table `t` is the first factor and the other factor `n` runs 2–12 — no × 0 or × 1 facts (#1138).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, q } from './util';

/** STA Table 1's maximum items per table (2–12): the d3 weights. */
export const TABLE_WEIGHTS: Record<number, number> = { 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 2, 11: 3, 12: 4 };

type Form = 'mul' | 'div' | 'missing';
const FACTORS = Array.from({ length: 11 }, (_, i) => i + 2);
const PRODUCTS = [...new Set(FACTORS.flatMap(a => FACTORS.map(b => a * b)))];
const lead = (v: number) => String(v)[0];

function weightedTable(rng: Rng): number {
  const bag = Object.entries(TABLE_WEIGHTS).flatMap(([t, w]) => Array<number>(w).fill(Number(t)));
  return pick(rng, bag);
}

/** Three product decoys: a neighbouring fact, then one table product sharing the answer's units digit and one its
 *  leading digit (where such products exist), then other table products. Every decoy is a real table product. */
export function productDecoys(t: number, n: number, rng: Rng): number[] {
  const answer = t * n;
  const ok = (v: number) => v !== answer && PRODUCTS.includes(v);
  // The neighbouring fact is #1058's neighbourFact rule, kept inside 2–12 (its 12 × 1 would pass for a product).
  const pairs = [[t - 1, n], [t + 1, n], [t, n - 1], [t, n + 1]].filter(([x, y]) => x >= 2 && x <= 12 && y >= 2 && y <= 12);
  const neighbours = shuffle(rng, pairs.map(([x, y]) => x * y).filter(ok));
  const picked: number[] = neighbours.slice(0, 1);
  const add = (pool: number[]) => { const v = shuffle(rng, pool.filter(x => ok(x) && !picked.includes(x)))[0]; if (v !== undefined) picked.push(v); };
  if (!picked.some(v => v % 10 === answer % 10)) add(PRODUCTS.filter(v => v % 10 === answer % 10));
  if (!picked.some(v => lead(v) === lead(answer))) add(PRODUCTS.filter(v => lead(v) === lead(answer)));
  while (picked.length < 3) {
    const before = picked.length;
    add(PRODUCTS);
    if (picked.length === before) break;
  }
  return picked.slice(0, 3);
}

/** Three factor decoys in 2–12 for a quotient or missing factor: `x ± 1` and the other factor, then fills. */
function factorDecoys(answer: number, other: number, rng: Rng): number[] {
  const picked: number[] = [];
  const add = (v: number) => { if (v >= 2 && v <= 12 && v !== answer && !picked.includes(v)) picked.push(v); };
  add(answer - 1); add(answer + 1); add(other);
  for (const v of shuffle(rng, FACTORS)) if (picked.length < 3) add(v);
  return picked.slice(0, 3);
}

export const y4Tables: Generator = (d: Difficulty, rng): Question => {
  const t = d === 1 ? pick(rng, [6, 11]) : d === 2 ? pick(rng, [7, 9, 12]) : weightedTable(rng);
  const n = ri(rng, 2, 12);
  const form: Form = d === 3 ? pick(rng, ['mul', 'div', 'missing'] as const) : pick(rng, ['mul', 'div'] as const);
  const p = t * n;
  const [prompt, answer, decoys] = form === 'mul' ? [`${t} × ${n} = ?`, p, productDecoys(t, n, rng)]
    : form === 'div' ? [`${p} ÷ ${t} = ?`, n, factorDecoys(n, t, rng)]
    : [`? × ${n} = ${p}`, t, factorDecoys(t, n, rng)];
  return { ...q(prompt), answer: String(answer), options: shuffle(rng, [answer, ...decoys].map(String)) };
};
