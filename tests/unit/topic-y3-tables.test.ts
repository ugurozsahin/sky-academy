import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { y3TablesQ } from '../../src/curriculum/year3-calc';
import { solve } from './helpers/ks2-oracle';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-tables')!;
const DIFFS: Difficulty[] = [1, 2, 3];
const draws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Every number in a prompt, in order. */
const nums = (p: string) => (p.match(/\d+/g) ?? []).map(Number);

describe('y3-tables (#1087)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-tables')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('oracle: every answer equals the prompt\'s own arithmetic', () => {
    for (const d of DIFFS) for (const c of draws(d, 1087_100)) {
      expect(solve(c.prompt), c.prompt).toBe(Number(c.answer));
      expect(c.options, c.prompt).toContain(c.answer);
      expect(new Set(c.options).size, c.prompt).toBe(4);
    }
  });

  it('every card uses table 3, 4 or 8 and a factor of 1–12', () => {
    for (const d of DIFFS) for (const c of draws(d, 1087_200)) {
      const ns = nums(c.prompt), a = Number(c.answer);
      if (/÷|\?\s*×|×\s*\?/.test(c.prompt) && !/^\d+ × \d+ = \?$/.test(c.prompt)) {
        // ÷ and missing-factor cards: the answer is the other factor, the table is the dividend over it
        const t = Math.max(...ns) / a;
        expect([3, 4, 8], c.prompt).toContain(t);
        expect(a, c.prompt).toBeGreaterThanOrEqual(1);
        expect(a, c.prompt).toBeLessThanOrEqual(12);
      } else {
        const [x, y] = ns;
        expect([x, y].some(v => [3, 4, 8].includes(v)), c.prompt).toBe(true);
        expect(Math.max(x, y), c.prompt).toBeLessThanOrEqual(12);
        expect(Math.min(x, y), c.prompt).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('d1 is 4× and 8× only; d2 and d3 reach all three tables and all three forms', () => {
    const d1 = draws(1, 1087_300);
    expect(d1.every(c => /^(4|8) × \d+ = \?$/.test(c.prompt))).toBe(true);
    for (const d of [2, 3] as Difficulty[]) {
      const cs = draws(d, 1087_310);
      for (const t of [3, 4, 8]) expect(cs.some(c => nums(c.prompt).includes(t) && c.prompt.includes(String(t))), `table ${t}`).toBe(true);
      expect(cs.some(c => c.prompt.includes('÷')), 'division').toBe(true);
      expect(cs.some(c => c.prompt.includes('×')), 'multiplication').toBe(true);
    }
    expect(draws(3, 1087_320).some(c => c.prompt.startsWith('?')), 'missing first factor').toBe(true);
    expect(draws(3, 1087_330).some(c => /^\d+ × \?/.test(c.prompt)), 'missing second factor').toBe(true);
    expect(draws(3, 1087_340).some(c => /÷ \?/.test(c.prompt)), 'missing divisor').toBe(true);
  });

  it('d1: the shown fact, doubled, is the asked fact', () => {
    for (const c of draws(1, 1087_400)) {
      const [t, n] = nums(c.prompt);
      expect(c.visual?.type, c.prompt).toBe('word');
      const [x, y, z] = nums((c.visual as { text: string }).text);
      expect(x * 2, c.prompt).toBe(t);
      expect(y, c.prompt).toBe(n);
      expect(x * y, c.prompt).toBe(z);
      expect(z * 2, c.prompt).toBe(Number(c.answer));
      expect(c.say, c.prompt).toContain(`${x} times ${y} is ${z}`);
    }
  });

  it('y3TablesQ with a fixed table uses only that table (a plain card for 3×, which has no doubling link)', () => {
    for (const t of [3, 4, 8] as const) for (const d of DIFFS) {
      const r = rng(1087_500 + t + d);
      for (let i = 0; i < 300; i++) {
        const c = y3TablesQ(d, r, t);
        expect(nums(c.prompt).includes(t), c.prompt).toBe(true);
        expect(solve(c.prompt), c.prompt).toBe(Number(c.answer));
        if (t === 3 && d === 1) { expect(c.visual, c.prompt).toBeUndefined(); expect(c.prompt).toMatch(/^\d+ × 3 = \?$/); }
      }
    }
  });

  it('every card, at every difficulty, carries at least one neighbouring-fact decoy', () => {
    for (const d of DIFFS) for (const c of draws(d, 1087_600)) {
      const ns = nums(c.prompt), a = Number(c.answer);
      let near: number[];
      if (/^\d+ × \d+ = \?$/.test(c.prompt)) {
        const [x, y] = ns;
        near = [(x - 1) * y, (x + 1) * y, x * (y - 1), x * (y + 1)];
        if (c.visual?.type === 'word') near.push(nums((c.visual as { text: string }).text)[2]); // d1: the undoubled fact
      } else near = [a - 1, a + 1, Math.max(...ns) / a]; // quotients and factors: n ± 1, or the divisor copied
      expect(c.options.some(o => o !== c.answer && near.includes(Number(o))), c.prompt + ' ' + c.options).toBe(true);
    }
  });

  it('d1 shows the undoubled fact as a decoy on a share of cards (it is one candidate among the neighbours)', () => {
    const cs = draws(1, 1087_610).filter(c => c.visual);
    const share = cs.filter(c => c.options.includes(String(nums((c.visual as { text: string }).text)[2]))).length / cs.length;
    expect(share).toBeGreaterThan(0.2);
  });

  it('factor and quotient answers never get a decoy outside 0–12', () => {
    for (const c of draws(3, 1087_620)) if (!/^\d+ × \d+ = \?$/.test(c.prompt)) for (const o of c.options) expect(Number(o), c.prompt).toBeLessThanOrEqual(12);
  });

  for (const d of DIFFS) it(`#1058 leak limit at d${d}: ≤ 0.30 for the units and the leading digit`, () => {
    const s = leakShares(topic.gen, d, 2000);
    if (d < 3) expect(s.counted).toBeGreaterThan(0); // d3 answers are factors of 12 or less: out of #1058's scope
    expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3);
  });
});
