// #916: the 2×, 5× and 10× drills each draw one table only, and the mixed y2-tables topic is unchanged.
import { describe, it, expect } from 'vitest';
import { drillsFor, topicById } from '../../src/curriculum';
import { tablesQ } from '../../src/curriculum/tables';
import { ri, pick, numQ, q } from '../../src/curriculum/util';
import type { Difficulty, Generator } from '../../src/curriculum/types';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const DS: Difficulty[] = [1, 2, 3];

// The generator exactly as it stood before #916, kept here as the reference for the byte-identical criterion.
const before: Generator = (d, rng) => {
  const table = d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]);
  const n = ri(rng, 1, 12);
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 1] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};

describe('times-table drills (#916)', () => {
  it('are the three Year 2 drills, in the chooser list only', () => {
    expect(drillsFor('year2', 'maths').map(t => t.id)).toEqual(expect.arrayContaining(['y2-tables-2', 'y2-tables-5', 'y2-tables-10']));
  });
  it.each([2, 5, 10])('y2-tables-%i uses only its table and its answer satisfies the oracle', (t) => {
    const gen = topicById(`y2-tables-${t}`)!.gen;
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) {
      const c = gen(d, rngOf(seed * 7 + d));
      const mul = /^(\d+) × (\d+) = \?$/.exec(c.prompt), div = /^(\d+) ÷ (\d+) = \?$/.exec(c.prompt), miss = /^\? × (\d+) = (\d+)$/.exec(c.prompt);
      if (mul) { const [a, b] = [+mul[1], +mul[2]]; expect([a, b]).toContain(t); expect(+c.answer).toBe(a * b); expect(Math.min(a, b) >= 1 && Math.max(a, b) <= Math.max(12, t)).toBe(true); }
      else if (div) { expect(+div[2]).toBe(t); expect(+c.answer).toBe(+div[1] / t); expect(d).toBeGreaterThan(1); }
      else if (miss) { expect(+miss[1]).toBe(t); expect(+c.answer).toBe(+miss[2] / t); expect(d).toBe(3); }
      else throw new Error(`unexpected prompt ${c.prompt}`);
      expect(c.options).toContain(c.answer);
    }
  });
  it('y2-tables gives byte-identical cards to before for the same seed', () => {
    const now = topicById('y2-tables')!.gen;
    for (const d of DS) for (let seed = 1; seed <= 200; seed++) expect(now(d, rngOf(seed))).toEqual(before(d, rngOf(seed)));
  });
  it('tablesQ is the one factory the mixed topic calls', () => {
    expect(tablesQ(1, rngOf(3), 5).prompt).toMatch(/5/);
  });
});
