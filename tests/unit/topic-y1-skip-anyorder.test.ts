import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y1-skip "Slice every multiple of 5/10" (#920)', () => {
  const t = TOPICS.find(x => x.id === 'y1-skip')!;

  it('declares sequenceFrom: 2, so the duel skips the any-order difficulties', () => {
    expect(t.sequenceFrom).toBe(2);
  });

  it('d1 never draws the any-order form', () => {
    const r = rng(9201);
    for (let i = 0; i < 300; i++) expect(t.gen(1, r).anyOrder).toBeFalsy();
  });

  it('at d2–d3 about 1 card in 3 is any-order, with a correct oracle, 1–100 range and the right decoys', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9200 + d);
      const DRAWS = 900;
      let anyOrder = 0, tenCards = 0, tenWithFiveDecoy = 0;
      for (let i = 0; i < DRAWS; i++) {
        const q = t.gen(d, r);
        if (!q.anyOrder) continue;
        anyOrder++;
        const m = q.prompt.match(/^Slice every multiple of (5|10)$/);
        expect(m, q.prompt).not.toBeNull();
        const step = Number(m![1]);
        const targets = q.sequence!.map(Number);
        const decoys = q.options.filter(o => !q.sequence!.includes(o)).map(Number);
        expect(targets.length, q.prompt).toBeGreaterThanOrEqual(2);
        expect(targets.length, q.prompt).toBeLessThanOrEqual(4);
        expect(q.options.length, q.prompt).toBe(6);
        for (const n of targets) expect(n % step, `${q.prompt}: target ${n}`).toBe(0);
        for (const n of decoys) expect(n % step, `${q.prompt}: decoy ${n}`).not.toBe(0);
        for (const n of [...targets, ...decoys]) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(100); }
        if (step === 5) {
          for (const dn of decoys) expect(targets.some(tn => Math.abs(dn - tn) <= 2), `${q.prompt}: decoy ${dn} not near a target`).toBe(true);
        } else {
          tenCards++;
          if (decoys.some(dn => dn % 5 === 0)) tenWithFiveDecoy++;
        }
      }
      const share = anyOrder / DRAWS;
      expect(share, `d${d}: share ${share}`).toBeGreaterThan(1 / 3 - 0.05);
      expect(share, `d${d}: share ${share}`).toBeLessThan(1 / 3 + 0.05);
      expect(tenCards, `d${d}: "of 10" cards`).toBeGreaterThan(0);
      expect(tenWithFiveDecoy, `d${d}: every "of 10" card needs a multiple-of-5 decoy`).toBe(tenCards);
    }
  });

  it('both multiples appear, with equal-ish chance', () => {
    const r = rng(9205); const seen = { 5: 0, 10: 0 };
    for (let i = 0; i < 900; i++) { const q = t.gen(3, r); if (q.anyOrder) seen[q.prompt.endsWith('10') ? 10 : 5]++; }
    expect(seen[5]).toBeGreaterThan(80); expect(seen[10]).toBeGreaterThan(80);
  });
});
