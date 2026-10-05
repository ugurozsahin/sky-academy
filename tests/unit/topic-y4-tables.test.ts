import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { TABLE_WEIGHTS } from '../../src/curriculum/year4-tables';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y4-tables')!;
const draws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Independent oracle: the table, the other factor and the answer, read from the prompt alone. */
function parse(prompt: string) {
  let m = prompt.match(/^(\d+) × (\d+) = \?$/);
  if (m) return { form: 'mul', t: Number(m[1]), n: Number(m[2]), answer: Number(m[1]) * Number(m[2]) };
  m = prompt.match(/^(\d+) ÷ (\d+) = \?$/);
  if (m) return { form: 'div', t: Number(m[2]), n: Number(m[1]) / Number(m[2]), answer: Number(m[1]) / Number(m[2]) };
  m = prompt.match(/^\? × (\d+) = (\d+)$/);
  expect(m, prompt).toBeTruthy();
  return { form: 'missing', t: Number(m![2]) / Number(m![1]), n: Number(m![1]), answer: Number(m![2]) / Number(m![1]) };
}

describe('y4-tables (#1070)', () => {
  it('is registered once, in Year 4', () => {
    expect(TOPICS.filter(t => t.id === 'y4-tables')).toHaveLength(1);
    expect(topic.year).toBe('year4');
  });

  it('every answer matches the prompt, factors are 2–12, quotients are whole, options are distinct and short', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_100)) {
      const { t, n, answer } = parse(c.prompt);
      expect(Number(c.answer), c.prompt).toBe(answer);
      expect(Number.isInteger(answer) && Number.isInteger(t) && Number.isInteger(n), c.prompt).toBe(true);
      expect(t >= 2 && t <= 12 && n >= 2 && n <= 12, c.prompt).toBe(true);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      for (const o of c.options) expect(o.length, c.prompt).toBeLessThanOrEqual(3);
    }
  });

  it('d1 uses the 6 and 11 tables, d2 the 7, 9 and 12, both × and ÷ only', () => {
    for (const [d, tables] of [[1, [6, 11]], [2, [7, 9, 12]]] as [Difficulty, number[]][]) {
      const seen = new Set<number>(), forms = new Set<string>();
      for (const c of draws(d, 1070_200)) { const p = parse(c.prompt); seen.add(p.t); forms.add(p.form); }
      expect([...seen].sort((a, b) => a - b)).toEqual(tables);
      expect([...forms].sort()).toEqual(['div', 'mul']);
    }
  });

  it('d3 draws all three forms and every table 2–12', () => {
    const forms = new Set<string>(), tables = new Set<number>();
    for (const c of draws(3, 1070_300, 1000)) { const p = parse(c.prompt); forms.add(p.form); tables.add(p.t); }
    expect([...forms].sort()).toEqual(['div', 'missing', 'mul']);
    expect(tables.size).toBe(11);
  });

  it('d3 table frequencies sit within ±2 points of the STA Table 1 weights', () => {
    const total = Object.values(TABLE_WEIGHTS).reduce((a, b) => a + b, 0);
    const counts: Record<number, number> = {};
    const all = draws(3, 1070_400, 10000);
    for (const c of all) { const { t } = parse(c.prompt); counts[t] = (counts[t] ?? 0) + 1; }
    for (const [t, w] of Object.entries(TABLE_WEIGHTS)) {
      expect(Math.abs((counts[Number(t)] ?? 0) / all.length - w / total) * 100, `table ${t}`).toBeLessThan(2);
    }
  });

  it('product cards carry a neighbouring fact among the decoys', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_500)) {
      const p = parse(c.prompt);
      if (p.form !== 'mul') continue;
      // A neighbour is only on offer when both factors stay in 2–12; at the edge (2 × 2, 12 × 12) some are missing.
      const pairs = [[p.t - 1, p.n], [p.t + 1, p.n], [p.t, p.n - 1], [p.t, p.n + 1]].filter(([x, y]) => x >= 2 && x <= 12 && y >= 2 && y <= 12);
      const legal = pairs.map(([x, y]) => x * y).filter(v => v !== p.answer);
      expect(c.options.some(o => legal.includes(Number(o))), c.prompt).toBe(true);
    }
  });

  it('≤30% of product cards of 20 or more have a unique units or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d, 2000);
      expect(counted, `d${d}`).toBeGreaterThan(0);
      expect(units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
