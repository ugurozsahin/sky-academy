// Times-table questions (#916): one factory, so the mixed y2-tables topic and the three single-table drills draw alike.
import type { Generator, Difficulty, Question } from './types';
import { ri, pick, numQ, q, wordQ, shuffle } from './util';

/** One 2×, 5× or 10× card for `table`: d1 multiply, d2 adds divide, d3 adds the missing factor. */
export const tablesQ = (d: Difficulty, rng: () => number, table: number): Question => {
  const n = ri(rng, 1, 12);
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 1] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};
/**
 * #923: the reverse form — "Which makes P?" with four facts on the bubbles. Decoys keep the answer's table and
 * step the other factor by one to three, so each is a table step off and none multiplies to P: the same table
 * with a different factor can never reach P, so no commuted or alternative factorisation (20 = 4 × 5) is a decoy.
 */
export const tablesPickQ = (rng: () => number, table: number): Question => {
  const n = ri(rng, 1, 12), p = n * table;
  const near = shuffle(rng, [n - 1, n + 1]).concat(shuffle(rng, [n - 2, n + 2, n + 3, n - 3])).filter(a => a >= 1 && a <= 12);
  return wordQ(rng, `Which makes ${p}?`, `${n} × ${table}`, near.slice(0, 3).map(a => `${a} × ${table}`), { say: `Which fact makes ${p}?` });
};
/** The mixed topic picks its table first, then draws the card — the rng order it always had at d1. From d2, one card in three is the reverse form. */
export const y2Tables: Generator = (d, rng) => {
  const table = d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]);
  return d > 1 && rng() < 1 / 3 ? tablesPickQ(rng, table) : tablesQ(d, rng, table);
};
/** A drill's generator for one fixed table. */
export const tableDrill = (table: number): Generator => (d, rng) => tablesQ(d, rng, table);
