import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y2-measure-compare')!;
const nums = (p: string) => (p.match(/\d+/g) ?? []).map(Number);

describe('y2-measure-compare (#1003)', () => {
  it('is registered straight after y2-capacity', () => {
    const i = TOPICS.findIndex(t => t.id === 'y2-capacity');
    expect(TOPICS[i + 1].id).toBe('y2-measure-compare');
  });
  for (const d of [1, 2, 3] as Difficulty[]) it(`d${d}: the sign is true, one unit, numbers ≤ 100, three sign options`, () => {
    const r = rng(d + 1000); const units = new Set<string>(); let equal = 0, minGap = 999;
    for (let i = 0; i < 400; i++) {
      const q = topic.gen(d, r);
      const m = q.prompt.match(/^(\d+) (\w+) \? (\d+) (\w+)$/)!;
      expect(m, q.prompt).toBeTruthy();
      const [a, b] = [Number(m[1]), Number(m[3])];
      expect(m[2]).toBe(m[4]); units.add(m[2]);
      expect(q.answer).toBe(a < b ? '<' : a > b ? '>' : '=');
      expect([...q.options].sort()).toEqual(['<', '=', '>']);
      expect(Math.max(...nums(q.prompt))).toBeLessThanOrEqual(100);
      expect(q.say).toContain(' compared with ');
      expect(q.say).toMatch(/centimetres|metres|grams|kilograms|millilitres|litres/);
      if (a === b) equal++; else minGap = Math.min(minGap, Math.abs(a - b));
    }
    if (d === 1) { expect([...units].sort()).toEqual(['cm', 'm']); expect(minGap).toBeGreaterThanOrEqual(10); }
    else expect([...units].sort()).toEqual(['cm', 'g', 'kg', 'l', 'm', 'ml']);
    if (d < 3) expect(equal).toBe(0); else expect(equal).toBeGreaterThan(0);
  });
  it('d3 deals digit swaps such as 45 against 54', () => {
    const r = rng(77); let swaps = 0;
    for (let i = 0; i < 400; i++) { const [a, b] = nums(topic.gen(3, r).prompt.replace(/ (\w+) \? /, ' ? ')); if (a !== b && String(a) === [...String(b)].reverse().join('')) swaps++; }
    expect(swaps).toBeGreaterThan(10);
  });
});
