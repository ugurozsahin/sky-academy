import { describe, it, expect } from 'vitest';
import { y2Related } from '../../src/curriculum/year2-related';
import type { Difficulty } from '../../src/curriculum/types';
import { solve } from './helpers/ks2-oracle';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const draw = (d: Difficulty, n = 600) => { const r = rng(d * 97 + 5); return Array.from({ length: n }, () => y2Related(d, r)); };
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y2-related (#1000)', () => {
  for (const d of [1, 2, 3] as const) it(`d${d}: the shown fact is the prompt with every number divided by 10, and the answer fills the gap`, () => {
    for (const q of draw(d)) {
      expect(q.visual?.type).toBe('word');
      const fact = q.visual?.type === 'word' ? q.visual.text : '';
      expect(solve(q.prompt), q.prompt).toBe(Number(q.answer));
      const filled = q.prompt.replace('?', q.answer);
      expect(nums(fact).map(n => n * 10), `${fact} vs ${filled}`).toEqual(nums(filled));
      expect(fact.replace(/\d+/g, '#')).toBe(filled.replace(/\d+/g, '#'));
    }
  });
  it('is + at d1, − at d2, and hides the second number or the result at d3', () => {
    for (const q of draw(1)) { expect(q.prompt).toContain('+'); expect(q.prompt.endsWith('= ?')).toBe(true); }
    for (const q of draw(2)) { expect(q.prompt).toContain('−'); expect(q.prompt.endsWith('= ?')).toBe(true); }
    const d3 = draw(3);
    expect(d3.some(q => q.prompt.includes('+ ?'))).toBe(true);
    expect(d3.some(q => q.prompt.includes('− ?'))).toBe(true);
    expect(d3.some(q => q.prompt.endsWith('= ?'))).toBe(true);
  });
  it('keeps the fact within 10 and every answer and option within 0–100, with 4 distinct options', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d)) {
      const fact = q.visual?.type === 'word' ? q.visual.text : '';
      expect(Math.max(...nums(fact))).toBeLessThanOrEqual(10);
      expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(+o).toBeGreaterThanOrEqual(0); expect(+o).toBeLessThanOrEqual(100); }
    }
  });
  it('carries the unscaled fact number among the decoys (the mistake the card targets)', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d)) expect(q.options, q.prompt).toContain(String(Number(q.answer) / 10));
  });
  it('speaks the fact and the question with no symbols left in the line', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d)) {
      expect(q.say).toMatch(/^\d+ (plus|minus) \d+ equals \d+\. So /);
      expect(q.say).not.toMatch(/[+−×÷=?]/);
      expect(q.say!.endsWith('what') || /\d$/.test(q.say!)).toBe(true);
    }
  });
});
