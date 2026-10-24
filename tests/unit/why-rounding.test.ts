// #2317: the rounding families' why agrees with the answer — "round up" exactly when the answer is above the number given.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const num = (s: string) => Number(s.replace(/[£,]/g, ''));

describe('the rounding why matches the answer (#2317)', () => {
  for (const id of ['y4-round', 'y5-round', 'y5-rounddec', 'y6-round']) {
    it(`${id}: "round up" appears exactly when the answer is above the number`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      let checked = 0;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d));
        if (!q.why?.startsWith('The ') || !q.why.includes('digit')) continue;   // the y4 number-line card is not a rounding
        const n = num(/£?\d[\d,]*(?:\.\d+)?/.exec(q.prompt)![0]), ans = num(q.answer);
        expect(q.why.includes('round up'), `${q.prompt} → ${q.answer}: ${q.why}`).toBe(ans > n);
        checked++;
      }
      expect(checked).toBeGreaterThan(300);
    });
  }
  it('the y4 number-line card says where the ? is, and that is its answer', () => {
    const t = TOPICS.find(x => x.id === 'y4-round')!;
    const lines = Array.from({ length: 200 }, (_, s) => t.gen(3, rngOf((s + 1) * 104729 + 3))).filter(q => q.why?.startsWith('Each gap'));
    expect(lines.length).toBeGreaterThan(10);
    for (const q of lines) expect(q.why).toContain(q.answer);
  });
});
