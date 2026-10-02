// Times-table questions (#916): one factory, so the mixed y2-tables topic and the three single-table drills draw alike.
import type { Generator, Difficulty, Question } from './types';
import { ri, pick, numQ, q } from './util';

/** One 2×, 5× or 10× card for `table`: d1 multiply, d2 adds divide, d3 adds the missing factor. */
export const tablesQ = (d: Difficulty, rng: () => number, table: number): Question => {
  const n = ri(rng, 1, 12);
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 1] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};
/** The mixed topic picks its table first, then draws the card — the rng order it always had. */
export const y2Tables: Generator = (d, rng) => tablesQ(d, rng, d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]));
/** A drill's generator for one fixed table. */
export const tableDrill = (table: number): Generator => (d, rng) => tablesQ(d, rng, table);
