import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-areaperim')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1243 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const rect = (s: string): [number, number] => { const m = /^(\d+) × (\d+)$/.exec(s)!; return [Number(m[1]), Number(m[2])]; };
const areaOf = ([a, b]: [number, number]) => a * b, perimOf = ([a, b]: [number, number]) => 2 * (a + b);

describe('y6-areaperim (#1243)', () => {
  it('is registered for Year 6 maths in the measure strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'measure' }); });

  it('every card has four distinct options including the answer and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1: exactly one option has the shown rectangle\'s area, and the same-perimeter decoy is on every card', () => {
    for (const q of draw(1)) {
      const shown = rect(/^Same area as (.+)\?$/.exec(q.prompt)![1]);
      expect(q.options.filter(o => areaOf(rect(o)) === areaOf(shown)), q.prompt).toEqual([q.answer]);
      expect(q.options.some(o => o !== q.answer && perimOf(rect(o)) === perimOf(shown)), q.prompt).toBe(true);
      expect(perimOf(rect(q.answer)), q.prompt).not.toBe(perimOf(shown));
    }
  });

  it('d2: the perimeter card recomputes from both rectangles, the other card has exactly one biggest area', () => {
    let perim = 0, big = 0;
    for (const q of draw(2)) {
      const m = /^(\d+ × \d+) and (\d+ × \d+): same area\. Perimeter of (\d+ × \d+) = \? cm$/.exec(q.prompt);
      if (m) {
        perim++;
        const [a, b] = [rect(m[1]), rect(m[2])];
        expect(areaOf(a), q.prompt).toBe(areaOf(b)); expect(perimOf(a), q.prompt).not.toBe(perimOf(b));
        expect(q.answer, q.prompt).toBe(String(perimOf(b)));
        expect(q.options, q.prompt).toContain(String(perimOf(a)));
      } else {
        big++;
        const P = Number(/^All have perimeter (\d+) cm\. Biggest area\?$/.exec(q.prompt)![1]);
        for (const o of q.options) expect(perimOf(rect(o)), q.prompt).toBe(P);
        const top = Math.max(...q.options.map(o => areaOf(rect(o))));
        expect(q.options.filter(o => areaOf(rect(o)) === top), q.prompt).toEqual([q.answer]);
      }
    }
    expect(perim).toBeGreaterThan(100); expect(big).toBeGreaterThan(100);
  });

  it('d3: the area and perimeter fix one rectangle, and the answer is its longer side', () => {
    for (const q of draw(3)) {
      const m = /^Rectangle: area (\d+) cm², perimeter (\d+) cm\. Longer side = \? cm$/.exec(q.prompt)!;
      const A = Number(m[1]), h = Number(m[2]) / 2, fits: number[] = [];
      for (let w = 1; w <= h; w++) if (w * (h - w) === A) fits.push(Math.max(w, h - w));
      // w and h − w are both roots, so each rectangle is found twice, always with the same longer side
      expect(fits, q.prompt).toEqual([Number(q.answer), Number(q.answer)]);
    }
  });

  it('prompts are at most 60 characters or carry their own say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 100)) expect(q.prompt.length <= 60 || q.say, q.prompt).toBeTruthy();
  });

  it('#1058 leak limit: the last and leading digit of an answer of 20 or more are shared by at most 30% of cards', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      if (s.counted < 50) continue;
      expect(s.units / s.counted, `d${d} last digit`).toBeLessThanOrEqual(0.3); expect(s.leading / s.counted, `d${d} leading digit`).toBeLessThanOrEqual(0.3);
    }
  });
});
