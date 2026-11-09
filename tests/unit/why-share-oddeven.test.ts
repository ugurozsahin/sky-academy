// #2317 (r-share, r-oddeven): the why shows the two equal shares, or the pairs and what is left over.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const qs = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 7919 + d))));

describe('Reception sharing and pairing why (#2317)', () => {
  it('r-share: the why is the two equal shares making the total', () => {
    for (const q of qs('r-share')) {
      const total = +q.prompt.match(/Share (\d+)/)![1];
      expect(q.why).toBe(`${q.answer} and ${q.answer} make ${total}.`);
      expect(+q.answer * 2).toBe(total);
    }
  });
  it('r-oddeven: the why counts the pairs and says whether one is left over, agreeing with the answer', () => {
    for (const q of qs('r-oddeven')) {
      const n = +q.say!.match(/\d+/)![0];
      const even = n % 2 === 0;
      expect(q.answer).toBe(q.prompt.includes('odd or even') ? (even ? 'even' : 'odd') : even ? '✅' : '❌');
      if (n === 1) expect(q.why).toBe('1 is on its own.');
      else expect(q.why).toBe(`${n} in twos: ${n >> 1} pair${n >> 1 > 1 ? 's' : ''}, ${even ? 'none' : 'one'} left over.`);
    }
  });
});
