import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-share')!;
const DRAWS = 300;

/** #986: sharing and grouping with the objects on the card; the answer times k is the objects shown. */
describe('y1-share (#986)', () => {
  it('is registered directly after y1-arrays', () => {
    const i = TOPICS.findIndex(t => t.id === 'y1-arrays');
    expect(TOPICS[i + 1].id).toBe('y1-share');
  });

  it('answer × k equals the objects shown, exactly, within 20, and the total is a decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9860 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const n = (q.visual as { type: string; n: number }).n;
        const m = /^Share (\d+) between (\d+)/.exec(q.prompt) ?? /^How many groups of (\d+) in (\d+)/.exec(q.prompt);
        expect(m, q.prompt).toBeTruthy();
        const share = q.prompt.startsWith('Share');
        const total = Number(share ? m![1] : m![2]), k = Number(share ? m![2] : m![1]);
        expect(total).toBe(n);
        expect(n).toBeLessThanOrEqual(20);
        expect(Number(q.answer) * k).toBe(n);
        expect(Number(q.answer)).toBeGreaterThanOrEqual(1);
        expect(q.options.every(o => Number(o) >= 0 && Number(o) <= 20)).toBe(true);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        if (Number(q.answer) !== total) expect(q.options, q.prompt).toContain(String(total));
      }
    }
  });

  it('d1 only shares (2 or 3, total ≤ 12), d2 only groups (2s, 5s, 10s), d3 mixes both', () => {
    const kinds = (d: Difficulty) => {
      const r = rng(9870 + d), seen = new Set<string>();
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        seen.add(q.prompt.startsWith('Share') ? 'share' : 'group');
        if (d === 1) {
          expect(Number((q.visual as { n: number }).n)).toBeLessThanOrEqual(12);
          expect([2, 3]).toContain(Number(/between (\d+)/.exec(q.prompt)![1]));
        }
        if (d === 2) expect([2, 5, 10]).toContain(Number(/groups of (\d+)/.exec(q.prompt)![1]));
      }
      return seen;
    };
    expect([...kinds(1)]).toEqual(['share']);
    expect([...kinds(2)]).toEqual(['group']);
    expect(kinds(3).size).toBe(2);
  });

  it('options per card: 3 at d1, 4 at d2–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9880 + d);
      for (let i = 0; i < 100; i++) expect(topic.gen(d, r).options.length).toBe(d === 1 ? 3 : 4);
    }
  });
});
