// Times-table questions (#916): one factory, so the mixed y2-tables topic and the three single-table drills draw alike.
import type { Generator, Difficulty, Question } from './types';
import { ri, pick, numQ, q, wordQ, shuffle } from './util';

/** One 2×, 5× or 10× card for `table`: d1 multiply, d2 adds divide, d3 adds the missing factor. A multiply card's decoys are neighbouring multiples of the table (#2319), never a number the table cannot make. */
export const tablesQ = (d: Difficulty, rng: () => number, table: number): Question => {
  const n = ri(rng, 1, 12), why = `${n} × ${table} = ${n * table}`;   // #2316: every card's reason is the multiplication fact behind it
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 2 * table, n * table - 2 * table, n * table + 3 * table, n * table - 3 * table], why }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p), why }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p), why });
};
/**
 * #923: the reverse form — "Which makes P?" with four facts on the bubbles. Decoys keep the answer's table and
 * step the other factor by one to three, so each is a table step off and none multiplies to P: the same table
 * with a different factor can never reach P, so no commuted or alternative factorisation (20 = 4 × 5) is a decoy.
 */
export const tablesPickQ = (rng: () => number, table: number): Question => {
  const n = ri(rng, 1, 12), p = n * table;
  const near = shuffle(rng, [n - 1, n + 1]).concat(shuffle(rng, [n - 2, n + 2, n + 3, n - 3])).filter(a => a >= 1 && a <= 12);
  return wordQ(rng, `Which makes ${p}?`, `${n} × ${table}`, near.slice(0, 3).map(a => `${a} × ${table}`), { say: `Which fact makes ${p}?`, why: `${n} × ${table} = ${p}` });
};
/**
 * #1127: Year 4's reverse forms — "Which makes P?" / "Which makes Q?" with four calculations on the bubbles, both
 * factors 2–12. Decoys are neighbouring table steps; every decoy's value differs from the target, so no commuted or
 * other factorisation of it (24 = 4 × 6) is ever a decoy, and every ÷ option is a whole-number quotient.
 */
export const y4TablesPickMulQ = (rng: () => number): Question => {
  const a = ri(rng, 2, 12), b = ri(rng, 2, 12), p = a * b;
  const ok = ([x, y]: number[]) => x >= 2 && x <= 12 && y >= 2 && y <= 12 && x * y !== p;
  const step1 = shuffle(rng, [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]).filter(ok);
  const step2 = shuffle(rng, [[a - 2, b], [a + 2, b], [a, b - 2], [a, b + 2]]).filter(ok);
  const decoys = [...new Set([...step1, ...step2].map(([x, y]) => `${x} × ${y}`))].slice(0, 3);
  return wordQ(rng, `Which makes ${p}?`, `${a} × ${b}`, decoys, { say: `Which fact makes ${p}?`, wide: true });
};
export const y4TablesPickDivQ = (rng: () => number): Question => {
  const d = ri(rng, 2, 12), qt = ri(rng, 2, 12);
  const other = (): number => { const o = shuffle(rng, Array.from({ length: 11 }, (_, i) => i + 2).filter(x => x !== d)); return o[0]; };
  const label = (quot: number, div: number) => `${quot * div} ÷ ${div}`;
  const ok = (quot: number) => quot >= 2 && quot <= 12 && quot !== qt;
  const same = shuffle(rng, [qt - 1, qt + 1]).filter(ok).map(x => label(x, d));
  const d2 = other();
  const diff = shuffle(rng, [qt - 2, qt + 2]).filter(ok).map(x => label(x, d2));
  const fill = shuffle(rng, [qt - 3, qt + 3, qt - 4, qt + 4]).filter(ok).map(x => label(x, d2));
  const decoys = [...new Set([...same, ...diff, ...fill])].slice(0, 3);
  return wordQ(rng, `Which makes ${qt}?`, label(qt, d), decoys, { say: `Which division makes ${qt}?`, wide: true });
};
/** The mixed topic picks its table first, then draws the card — the rng order it always had at d1. From d2, one card in three is the reverse form. */
export const y2Tables: Generator = (d, rng) => {
  const table = d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]);
  return d > 1 && rng() < 1 / 3 ? tablesPickQ(rng, table) : tablesQ(d, rng, table);
};
/** A drill's generator for one fixed table. */
export const tableDrill = (table: number): Generator => (d, rng) => tablesQ(d, rng, table);
