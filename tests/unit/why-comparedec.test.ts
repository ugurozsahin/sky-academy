// #2317 (decimals family): each y4-comparedec why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-comparedec')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y4-comparedec whys (#2317)', () => {
  it('rounding names the real tenths digit and the direction it sends the number', () => {
    for (const q of draws(1)) {
      const s = q.prompt.split(' ')[0], tenths = Number(s.split('.')[1]);
      const m = /^Tenths digit (\d) is (5 or more, so round up|under 5, so stay) to (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(Number(m[1]), q.why).toBe(tenths);
      expect(m[2].startsWith('5'), q.why).toBe(tenths >= 5);
      expect(m[3], q.why).toBe(q.answer);
    }
  });
  it('a comparison names the first place the digits differ, and its sign agrees with the answer', () => {
    for (const q of draws(2)) {
      const [a, b] = q.prompt.split(' ? ');
      if (a === b) { expect(q.why).toBe('Every digit matches, so they are equal'); continue; }
      const m = /^(Tenths|Hundredths): (\d) is (less than|more than) (\d), so (less|greater)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const at = [...a].findIndex((c, i) => c !== b[i]);
      expect(m[1], q.why).toBe(at === 2 ? 'Tenths' : 'Hundredths');
      expect([m[2], m[4]], q.why).toEqual([a[at], b[at]]);
      expect(m[5] === 'less', q.why).toBe(q.answer === '<');
      expect(m[3] === 'less than', q.why).toBe(q.answer === '<');
    }
  });
  it('an ordering card says what to compare, matching its places', () => {
    for (const q of draws(3)) {
      const dp = q.options![0].split('.')[1].length;
      expect(q.why).toBe(dp === 1 ? 'Same ones digit, so the smaller tenths come first' : 'Same ones digit: compare tenths, then hundredths');
    }
  });
});
