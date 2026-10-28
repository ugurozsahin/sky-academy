// #2317 (multiplying decimals): each why shows the digits multiplied with no point, then where the point goes back.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-decmult')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-decmult whys (#2317)', () => {
  it('d1 and d2 cards multiply the digits, then put the point back to the right answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const m = /^([\d.]+) × (\d+) = \?$/.exec(q.prompt)!;
      const dp = (m[1].split('.')[1] ?? '').length, ints = Math.round(Number(m[1]) * 10 ** dp);
      const places = dp === 1 ? '1 place' : `${dp} places`, counted = (ints * Number(m[2]) / 10 ** dp).toFixed(dp);
      expect(q.why, q.prompt).toBe(`${ints} × ${m[2]} = ${ints * Number(m[2])}; point back ${places}: ${counted}${counted === q.answer ? '' : ` = ${q.answer}`}`);
      expect(Number(q.answer)).toBeCloseTo(Number(m[1]) * Number(m[2]), 6);
    }
  });
  it('a product ending in zero shows the spare zero, then drops it, so counting the places matches', () => {
    const zero = [...draws(1), ...draws(2)].filter(q => / = [\d.]+$/.test(q.why!) && q.why!.split(' = ').length === 3);
    expect(zero.length).toBeGreaterThan(10);
    for (const q of zero) expect(q.why, q.prompt).toMatch(/: \d+\.\d*0 = \d+(\.\d*[1-9])?$/);
  });
  it('d3 story cards give the same working and end in the built answer', () => {
    for (const q of draws(3)) {
      const m = /^(\d+) × (\d+) = (\d+); point back (\d) places?: ([\d.]+)(?: = ([\d.]+))?$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(Number(m[1]) * Number(m[2])).toBe(Number(m[3]));
      expect(m[6] ?? m[5], q.why).toBe(q.answer);
      expect((m[5].split('.')[1] ?? '').length, q.why).toBe(Number(m[4]));
      expect(Number(m[3]) / 10 ** Number(m[4])).toBeCloseTo(Number(q.answer), 6);
      expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14);
    }
  });
});
