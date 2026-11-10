// #2318 (y2-spell-more): the why names the rule of the bank the word came from.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { A_BEFORE_L, O_FOR_UH, EY, A_AFTER_W, W_OR_AR, S_FOR_ZH } from '../../src/curriculum/year2-spell-more';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = () => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === 'y2-spell-more')!.gen(d, rngOf((s + 1) * 104729 + d))));

describe('y2-spell-more says why (#2318)', () => {
  const rules: [string, readonly (readonly [string, ...unknown[]])[]][] = [
    ['a before l says or: -all, -alk.', A_BEFORE_L], ['o can say u: a tricky spelling.', O_FOR_UH], ['The -ey ending says ee.', EY],
    ['After w, a can say o.', A_AFTER_W], ['After w: or says ur, ar says or.', W_OR_AR], ['The s can say zh.', S_FOR_ZH],
  ];
  it('every card carries the rule of the bank its answer is in', () => {
    for (const q of all()) {
      const hit = rules.find(([, bank]) => bank.some(r => r[0] === q.answer));
      expect(hit, q.answer).toBeTruthy();
      expect(q.why).toBe(hit![0]);
    }
  });
});
