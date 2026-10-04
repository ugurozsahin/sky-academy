import { describe, it, expect } from 'vitest';
import { y2CoinCombo } from '../../src/curriculum/year2-coincombo';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const DRAWS = 300;
/** Pence in a printed amount: `35p` → 35, `£1` → 100. */
const pence = (s: string) => (s.includes('£') ? 100 : Number(s.replace('p', '')));
const coinsOf = (label: string) => label.split(' + ').map(pence);
const total = (label: string) => coinsOf(label).reduce((s, n) => s + n, 0);
const LIMITS = { 1: { max: 20, sizes: [2], coins: [1, 2, 5, 10] }, 2: { max: 50, sizes: [2], coins: [1, 2, 5, 10, 20] }, 3: { max: 100, sizes: [2, 3], coins: [5, 10, 20, 50] } } as const;

describe('y2-coincombo (#1002)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`d${d}: exactly one option sums to the target, with distinct coin sets and short labels`, () => {
      const rng = mulberry32(1002 + d);
      const lim = LIMITS[d];
      for (let i = 0; i < DRAWS; i++) {
        const q = y2CoinCombo(d, rng);
        const target = pence(q.prompt.match(/£1|\d+p/)![0]);
        expect(target).toBeLessThanOrEqual(lim.max);
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.answer);
        expect(q.options.filter(o => total(o) === target)).toEqual([q.answer]);
        expect(new Set(q.options.map(o => coinsOf(o).join(','))).size).toBe(4);
        for (const o of q.options) {
          expect(o.length).toBeLessThanOrEqual(15);
          expect(o).not.toMatch(/\./);
          const cs = coinsOf(o);
          expect(lim.sizes as readonly number[]).toContain(cs.length);
          for (const c of cs) expect(lim.coins as readonly number[]).toContain(c);
          expect([...cs].sort((a, b) => b - a)).toEqual(cs);
        }
      }
    });

    it(`d${d}: say names the target in pence and carries no decimal or mixed amount`, () => {
      const rng = mulberry32(2002 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = y2CoinCombo(d, rng);
        const target = pence(q.prompt.match(/£1|\d+p/)![0]);
        expect(q.say).toBe(`Which coins make ${target === 100 ? 'a pound' : `${target} pence`}?`);
        expect(q.prompt + q.say).not.toMatch(/\.\d|£\d+ and/);
      }
    });
  }
});
