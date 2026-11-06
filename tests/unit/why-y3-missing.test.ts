// #2317 (y3-missing): the why is the number sentence with the gap filled in, in the order the card showed it.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y3-missing')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y3-missing why (#2317)', () => {
  it('is the prompt with the answer in the gap, and the sum is true', () => {
    for (const q of draw()) {
      expect(q.why, q.prompt).toBe(q.prompt.replace('?', q.answer));
      const m = /^(\d+) = (\d+) ([+−]) (\d+)$|^(\d+) ([+−]) (\d+) = (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [t, x, op, y] = m[1] ? [+m[1], +m[2], m[3], +m[4]] : [+m[8], +m[5], m[6], +m[7]];
      expect(op === '+' ? x + y : x - y).toBe(t);
    }
  });
});
