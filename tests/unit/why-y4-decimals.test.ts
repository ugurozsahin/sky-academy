// #2317 (y4-decimals family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-decimals')!.gen(d, rngOf((s + 1) * 104729 + d)));
const fracOf = (s: string) => { const [n, den] = s.split('/').map(Number); return n / den; };

describe('y4-decimals whys (#2317)', () => {
  it('every question has a short why that names its fraction and its decimal', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^(\d+\/\d+) is (.+), ([\d.]+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      expect(q.why!.length, q.why).toBeLessThanOrEqual(50);
      const frac = q.prompt.includes('/') ? q.prompt.split(' ')[0] : q.answer;
      expect(m![1], q.why).toBe(frac);
      expect(Number(m![3]), q.why).toBeCloseTo(fracOf(frac), 9);
    }
  });
  it('the place values spoken are the real ones', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const dec = q.why!.split(', ').pop()!, [w, fr = ''] = dec.split('.');
      const t = /(\d+) tenths?/.exec(q.why!), h = /(\d+) hundredths?/.exec(q.why!), whole = /(\d+) whole/.exec(q.why!);
      if (whole) expect([whole[1], t![1]], q.why).toEqual([w, fr]);
      else if (h && t) expect(`${t[1]}${h[1]}`, q.why).toBe(fr);
      else if (h) expect(h[1], q.why).toBe(String(Number(fr)));
      else expect(t![1], q.why).toBe(fr);
    }
  });
});
