import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * Two more r-oddeven checks (#898), in their own file rather than `curriculum.test.ts`, whose `fileLines`
 * ratchet is frozen at 2641 (#1381).
 */
describe('r-oddeven: the ✅/❌ swap changes only the bubble text (#898)', () => {
  const t = TOPICS.find(x => x.id === 'r-oddeven')!;

  it('the spoken question is unchanged by the bubble swap', () => {
    const r = rng(898);
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (let i = 0; i < 150; i++) {
        const q = t.gen(d, r);
        const n = (q.visual as { n: number }).n;
        expect(q.say).toBe(d === 3 ? `Is ${n} odd or even?` : `There are ${n}. Can they all find a partner?`);
      }
    }
  });

  it('d1–d2 stay narrow: a one-character emoji pair reads as narrow on the #482 table, unlike the yes/no words it replaced', () => {
    const r = rng(899);
    for (const d of [1, 2] as Difficulty[]) for (let i = 0; i < 150; i++) expect(t.gen(d, r).wide).toBe(false);
  });
});
