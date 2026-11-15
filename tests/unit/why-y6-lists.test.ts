// #2318 (y6-lists): d1–d2 name the mark's job (COLON_WHY / SEMICOLON_WHY, pinned in topic-y6-lists.test.ts); d3 names the style two bullets share.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { bulletStyle, bulletWhy } from '../../src/curriculum/year6-lists';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-lists')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-lists says why (#2318)', () => {
  it('words both bullet styles', () => {
    expect(bulletWhy(true)).toBe('Two bullets start with a capital and end with a full stop.');
    expect(bulletWhy(false)).toBe('Two bullets start with a small letter and have no full stop.');
  });
  it('every draw has a why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); }
  });
  it('d3 names the shared style, matching the two bullets that are not the answer', () => {
    for (const q of draws(3)) {
      const caps = q.why!.includes('capital');
      const others = q.options.filter(o => o !== q.answer);
      expect(others).toHaveLength(2);
      for (const o of others) expect(bulletStyle(o)).toBe(`${caps}/${caps}`);   // capital and full stop together, as the why says
    }
  });
});
