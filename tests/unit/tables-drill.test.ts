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
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 2 * table, n * table - 2 * table, n * table + 3 * table, n * table - 3 * table] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};

/** #2316: a card gained a `why`; everything else about it must be the bytes it had. */
const noWhy = <T extends object>(c: T): Omit<T, 'why'> => { const { why: _why, ...rest } = c as T & { why?: string }; return rest; };

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
  it('y2-tables gives byte-identical d1 cards to before for the same seed (the reverse form is d2–d3 only, #923)', () => {
    const now = topicById('y2-tables')!.gen;
    for (const d of [1 as Difficulty]) for (let seed = 1; seed <= 200; seed++) expect(noWhy(now(d, rngOf(seed)))).toEqual(before(d, rngOf(seed)));
  });
  it('tablesQ is the one factory the mixed topic calls', () => {
    expect(tablesQ(1, rngOf(3), 5).prompt).toMatch(/5/);
  });
});

describe('times-table multiply cards (#2319)', () => {
  it.each([2, 5, 10])('every wrong option on a y2-tables-%i multiply card is a multiple of the table', (t) => {
    const gen = topicById(`y2-tables-${t}`)!.gen;
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) {
      const c = gen(d, rngOf(seed * 11 + d));
      if (!/^(\d+ × \d+|\d+ × \d+) = \?$/.test(c.prompt)) continue;
      for (const o of c.options) expect(+o % t).toBe(0);
      expect(new Set(c.options).size).toBe(c.options.length);
    }
  });
});

describe('y2-tables "Which makes P?" (#923)', () => {
  const gen = topicById('y2-tables')!.gen;
  const reverse = (d: Difficulty, n: number) => Array.from({ length: n }, (_, i) => gen(d, rngOf(i * 13 + d + 1))).filter(c => c.prompt.startsWith('Which makes'));
  it('d1 never asks it', () => expect(reverse(1, 400)).toHaveLength(0));
  it.each([2, 3] as Difficulty[])('d%i: about a third of cards, exactly one option multiplies to P, four fitting options', (d) => {
    const N = 1200, cards = reverse(d, N);
    expect(cards.length / N).toBeGreaterThan(0.28); expect(cards.length / N).toBeLessThan(0.38);
    for (const c of cards) {
      const P = +/^Which makes (\d+)\?$/.exec(c.prompt)![1];
      const prod = (o: string) => { const m = /^(\d+) × (\d+)$/.exec(o)!; return +m[1] * +m[2]; };
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4);
      expect(c.options.filter(o => prod(o) === P)).toEqual([c.answer]);
      const tables = new Set(c.options.map(o => o.split(' × ')[1])); expect(tables.size).toBe(1);
      expect([2, 5, 10]).toContain(+[...tables][0]);
      expect(c.say).toBe(`Which fact makes ${P}?`);
    }
  });
});
