import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-factorpairs')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1139 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const isPair = (q: { prompt: string }) => q.prompt.startsWith('Which is a factor pair of');
const target = (p: string) => Number(p.match(/of (\d+)\?/)![1]);
const factors = (s: string) => s.split(' × ').map(Number) as [number, number];
const swapKey = (s: string) => factors(s).sort((a, b) => a - b).join('×');

describe('y4-factorpairs (#1139)', () => {
  it('is registered for Year 4', () => expect(topic.year).toBe('year4'));

  it('exactly one option multiplies to the target and no two options are swaps', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400).filter(isPair)) {
      const t = target(q.prompt);
      expect(q.options.filter(o => { const [a, b] = factors(o); return a * b === t; }), q.prompt).toEqual([q.answer]);
      expect(new Set(q.options.map(swapKey)).size, q.prompt).toBe(q.options.length);
      expect(q.options).toHaveLength(4);
    }
  });

  it('targets stay within 36, 72 and 144, and pairs with 1 appear only at d3', () => {
    for (const [d, max] of [[1, 36], [2, 72], [3, 144]] as [Difficulty, number][]) for (const q of draw(d, 400).filter(isPair)) {
      expect(target(q.prompt)).toBeLessThanOrEqual(max);
      if (d < 3) for (const o of q.options) expect(factors(o).every(n => n >= 2 && n <= 12), o).toBe(true);
    }
    expect(draw(3, 800).filter(isPair).some(q => q.options.some(o => factors(o).includes(1)))).toBe(true);
  });

  it('d1 and d2 are all pair cards; d3 mixes in the swap form', () => {
    expect(draw(1, 200).every(isPair)).toBe(true);
    expect(draw(2, 200).every(isPair)).toBe(true);
    expect(draw(3, 200).some(q => !isPair(q))).toBe(true);
  });

  it('one answer factor appears in a decoy on ≥70% of pair cards', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const cards = draw(d, 2000).filter(isPair);
      const hit = cards.filter(q => q.options.some(o => o !== q.answer && factors(o).some(n => factors(q.answer).includes(n))));
      expect(hit.length / cards.length, `d${d}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('the swap form: the answer is first × third, and the leak shares stay ≤30% for answers ≥ 20', () => {
    const cards = draw(3, 2000).filter(q => !isPair(q));
    expect(cards.length).toBeGreaterThan(300);
    for (const q of cards) {
      const [x, y, z, y2] = q.prompt.match(/\d+/g)!.map(Number);
      expect(y2).toBe(y);
      expect(Number(q.answer), q.prompt).toBe(x * z);
      expect([10, 20, 100]).toContain(x * z);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
    }
    const big = cards.filter(q => Number(q.answer) >= 20);
    const others = (q: typeof big[number]) => q.options.filter(o => o !== q.answer);
    const noUnits = big.filter(q => !others(q).some(o => Number(o) % 10 === Number(q.answer) % 10));
    const noLead = big.filter(q => !others(q).some(o => o[0] === q.answer[0]));
    expect(noUnits.length / big.length).toBeLessThanOrEqual(0.3);
    expect(noLead.length / big.length).toBeLessThanOrEqual(0.3);
  });
});
