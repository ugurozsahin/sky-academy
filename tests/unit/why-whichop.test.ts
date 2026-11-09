// #2317 (y4-whichop): the why names what the operation does, then the sum with the story's answer filled in.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { whyOp } from '../../src/curriculum/year4-whichop';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y4-whichop')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 6007 + d))); };

describe('y4-whichop why (#2317)', () => {
  it('is set, short, and names the right operation at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).toContain(` ${q.answer} `);
    }
  });
  it('writes the sum with its result', () => {
    expect(whyOp('÷', 48, 6)).toBe('Share equally: 48 ÷ 6 = 8.');
    expect(whyOp('+', 1200, 340)).toBe('Join them: 1,200 + 340 = 1,540.');
    expect(whyOp('−', 900, 250)).toBe('Find the difference: 900 − 250 = 650.');
    expect(whyOp('×', 12, 7)).toBe('Equal groups: 12 × 7 = 84.');
  });
});
