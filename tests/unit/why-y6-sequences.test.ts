// #2317 (y6-sequences): each why names the step between two terms and the rule it gives, and the rule is true of the card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-sequences')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace('−', '-'));

describe('y6-sequences whys (#2317)', () => {
  it('every card has a short why in the form "b − a = step, so ± step"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      const m = /^([\d.]+) − ([\d.]+) = ([\d.]+), so ([+−]) ([\d.]+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      expect(num(m![1]) - num(m![2])).toBeCloseTo(num(m![3]), 6);
      expect(m![5]).toBe(m![3]);
    }
  });
  it('the step in the why is the one the shown terms make, and the rule is the answer at d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const shown = (q.prompt.match(/-?[\d.]+/g) ?? []).map(num);
      const m = /= ([\d.]+), so ([+−]) /.exec(q.why!)!;
      const step = (m[2] === '+' ? 1 : -1) * num(m[1]);
      expect(shown[1] - shown[0], q.prompt + ' | ' + q.why).toBeCloseTo(step, 6);
      if (d === 3) expect(q.answer).toBe(`${m[2]} ${m[1]}`);
    }
  });
});
