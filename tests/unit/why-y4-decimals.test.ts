// #2317 (y4-decimals family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { whyOf } from '../../src/curriculum/year4-decimals';

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
      expect(q.prompt.includes('/') ? q.answer : q.prompt.split(' ')[0], q.why).toBe(m![3]);
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
  it('singular and plural agree, pinned case by case', () => {
    expect(whyOf({ n: 1, den: 10, dp: 1 }, '0.1')).toBe('1/10 is 1 tenth, 0.1');
    expect(whyOf({ n: 3, den: 10, dp: 1 }, '0.3')).toBe('3/10 is 3 tenths, 0.3');
    expect(whyOf({ n: 11, den: 10, dp: 1 }, '1.1')).toBe('11/10 is 1 whole and 1 tenth, 1.1');
    expect(whyOf({ n: 21, den: 10, dp: 1 }, '2.1')).toBe('21/10 is 2 whole and 1 tenth, 2.1');
    expect(whyOf({ n: 11, den: 100, dp: 2 }, '0.11')).toBe('11/100 is 1 tenth and 1 hundredth, 0.11');
    expect(whyOf({ n: 5, den: 100, dp: 2 }, '0.05')).toBe('5/100 is 5 hundredths, 0.05');
    expect(whyOf({ n: 1, den: 100, dp: 2 }, '0.01')).toBe('1/100 is 1 hundredth, 0.01');
    expect(whyOf({ n: 1, den: 2, dp: 1 }, '0.5')).toBe('1/2 is 5 tenths, 0.5');
    expect(whyOf({ n: 3, den: 4, dp: 2 }, '0.75')).toBe('3/4 is 75 hundredths, 0.75');
    expect(() => whyOf({ n: 1, den: 3, dp: 1 }, '0.3')).toThrow();
  });
  it('no drawn why says "1 tenths" or "1 hundredths", and none says "0 tenths"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.why).not.toMatch(/\b1 (tenths|hundredths)|\b0 tenth/);
  });
});
