// #2317 (y5-decfrac): each why counts the places after the point, or shows the step down to the simplest form.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-decfrac')!.gen(d, rngOf((s + 1) * 104729 + d)));
const all = ([1, 2, 3] as Difficulty[]).flatMap(draws);

describe('y5-decfrac whys (#2317)', () => {
  it('every question has a why of at most 14 words that ends on the answer', () => {
    for (const q of all) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(q.answer), q.why).toBe(true);
    }
  });
  it('a decimal to a fraction names the number of places and the matching bottom', () => {
    let seen = 0;
    for (const q of all) {
      const w = /^(\S+) has (\d) places? after the point: (\d+)\/(\d+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(q.prompt.startsWith(`${w[1]} = ?`), q.prompt).toBe(true);
      expect(w[4]).toBe(String(10 ** Number(w[2])));
    }
    expect(seen).toBeGreaterThan(100);
  });
  it('a fraction to a decimal reads the top off the bottom', () => {
    let seen = 0;
    for (const q of all) {
      const w = /^(\d+)\/(\d+) is (\d+) (tenths|hundredths): (\S+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(w[3]).toBe(w[1]);
      expect(w[4]).toBe(w[2] === '10' ? 'tenths' : 'hundredths');
    }
    expect(seen).toBeGreaterThan(100);
  });
  it('a decimal to a fraction in simplest form divides top and bottom by their common factor', () => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    let seen = 0;
    for (const q of all) {
      const w = /^(\S+) = (\d+)\/(\d+); divide both by (\d+): (\d+)\/(\d+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      const dp = (w[1].split('.')[1] ?? '').length;
      expect(w[2], q.why).toBe(String(Math.round(Number(w[1]) * 10 ** dp)));
      expect(w[3], q.why).toBe(String(10 ** dp));
      expect(Number(w[2]) / Number(w[4])).toBe(Number(w[5]));
      expect(Number(w[3]) / Number(w[4])).toBe(Number(w[6]));
      expect(gcd(Number(w[5]), Number(w[6])), q.why).toBe(1);
    }
    expect(seen).toBeGreaterThan(10);
  });
  it('a simplest-form fraction to a decimal shows the raw fraction it reduces from', () => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    let seen = 0;
    for (const q of all) {
      const w = /^(\d+)\/(\d+) = (\d+)\/(\d+), which is (\S+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      const dp = (w[5].split('.')[1] ?? '').length;
      expect(w[4], q.why).toBe(String(10 ** dp));
      expect(w[3], q.why).toBe(String(Math.round(Number(w[5]) * 10 ** dp)));
      expect(Number(w[1]) * Number(w[4]), q.why).toBe(Number(w[3]) * Number(w[2]));
      expect(gcd(Number(w[1]), Number(w[2])), q.why).toBe(1);
    }
    expect(seen).toBeGreaterThan(10);
  });
});
