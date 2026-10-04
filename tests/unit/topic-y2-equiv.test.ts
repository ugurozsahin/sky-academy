import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sameFraction } from '../../src/curriculum/year2/number';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-equiv')!;
const DRAWS = 300;

// #1001: the equivalence of 2/4 and 1/2 is asked directly, as fractions and as fractions of a quantity.
describe('y2-equiv (#1001)', () => {
  it('registers directly after y2-fractions', () => {
    const ids = TOPICS.map(t => t.id);
    expect(ids.indexOf('y2-equiv')).toBe(ids.indexOf('y2-fractions') + 1);
  });

  it('fraction cards: exactly one of four options is equal in value to the asked fraction, from the Year 2 set', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1001 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (q.prompt.includes(' of ')) continue;
        const asked = /(\d\/\d)/.exec(q.prompt)![1];
        const [n, den] = asked.split('/').map(Number);
        expect(q.options.length, q.prompt).toBe(4);
        expect(q.options.filter(o => sameFraction(o, n, den)), q.prompt).toEqual([q.answer]);
        for (const o of q.options) expect(['1/2', '2/4', '1/3', '1/4', '3/4'], o).toContain(o);
        expect(q.say, q.prompt).toBeTruthy();
      }
    }
  });

  it('quantity cards (d3 only): the answer is half the whole, the whole a multiple of 4 up to 24', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1010 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (!q.prompt.includes(' of ')) continue;
        expect(d, 'quantity cards are the stretch').toBe(3);
        const whole = Number(/2\/4 of (\d+)/.exec(q.prompt)![1]);
        seen++;
        expect(whole % 4).toBe(0);
        expect(whole).toBeLessThanOrEqual(24);
        expect(q.answer).toBe(String(whole / 2));
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.say).toBeTruthy();
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('d1 draws all four picture cards: both directions, both shapes, and always a picture', () => {
    const r = rng(1020);
    const seen = new Set<string>();
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      const v = q.visual as { type: string; shape: string };
      expect(v.type).toBe('fraction');
      seen.add(`${q.prompt}|${v.shape}`);
    }
    expect(seen.size).toBe(4);
  });
});
