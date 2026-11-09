// #2317 (y4-whichop): the why names what the operation does, then the sum with the story's answer filled in.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { apply, whyOp, type Op } from '../../src/curriculum/year4-whichop';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y4-whichop')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 6007 + d))); };

describe('y4-whichop why (#2317)', () => {
  it('carries the prompt numbers and the right result at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      const m = /: ([\d,]+) (.) ([\d,]+) = ([\d,]+)\.$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      const [a, b, r] = [m![1], m![3], m![4]].map(x => Number(x.replace(/,/g, '')));
      expect(m![2], q.prompt).toBe(q.answer);
      expect((q.prompt.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, ''))).sort(), q.prompt).toEqual([a, b].sort());
      expect(r, q.why).toBe(apply(m![2] as Op, a, b));
    }
  });
  it('writes the sum with its result', () => {
    expect(whyOp('÷', 48, 6)).toBe('Make equal groups: 48 ÷ 6 = 8.');
    expect(whyOp('+', 1200, 340)).toBe('Join them: 1,200 + 340 = 1,540.');
    expect(whyOp('−', 900, 250)).toBe('Take away or compare: 900 − 250 = 650.');
    expect(whyOp('×', 12, 7)).toBe('Equal groups: 12 × 7 = 84.');
  });
});
