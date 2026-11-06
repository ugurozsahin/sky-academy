// #2317 (y3-angles): the why names the property that makes the answer right, and the letter it points at.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-angles')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y3-angles why (#2317)', () => {
  it('is set, short, and names the answer letter on the lettered cards', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14);
      if (d > 1) expect(q.why, q.prompt).toMatch(new RegExp(`(Angle|Line|Pair) ${q.answer}\\b`));
    }
  });
  it('turn cards state the count and the yes/no card agrees with its answer', () => {
    for (const q of draw(1)) {
      if (/right angles make/.test(q.prompt)) expect(q.why).toContain(` is ${q.answer} right angles.`);
      else expect(/right angle\.$/.test(q.why!)).toBe(q.answer === 'Yes');
    }
  });
});
