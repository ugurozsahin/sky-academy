import { describe, expect, it } from 'vitest';
import { y6Fdp } from '../../src/curriculum/year6-fdp';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

describe('y6-fdp d1 fraction decoys are in lowest terms (#2319)', () => {
  it('"n ÷ d as a fraction" offers no reducible fraction, over 300 seeds', () => {
    let cards = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = y6Fdp(1, rngOf(seed));
      if (!/ as a fraction$/.test(q.prompt)) continue;
      cards++;
      expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) { const [n, d] = o.split('/').map(Number); expect(gcd(n, d), `${q.prompt}: ${o}`).toBe(1); }
    }
    expect(cards).toBeGreaterThan(80);
  });
});
