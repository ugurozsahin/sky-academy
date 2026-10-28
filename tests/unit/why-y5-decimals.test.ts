// #2317 (y5-decimals family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-decimals')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y5-decimals whys (#2317)', () => {
  it('rank cards list every value in order, so the asked rank sits where the question says', () => {
    for (const lvl of [1, 3] as Difficulty[]) for (const q of draws(lvl).filter(x => x.prompt.startsWith('Which is the'))) {
      const list = q.why!.replace('Smallest to largest: ', '').split(', ');
      expect(list.slice().sort((a, b) => Number(a) - Number(b)), q.why).toEqual(list);
      expect(new Set(list).size, q.why).toBe(4);
      expect(list, q.why).toContain(q.answer);
      const ask = /^Which is the (.+)\?$/.exec(q.prompt)![1];
      const idx = { largest: 3, smallest: 0, 'second largest': 2, 'second smallest': 1 }[ask]!;
      expect(list[idx], q.prompt).toBe(q.answer);
    }
  });
  it('place-value facts multiply by the real factor and reach the answer', () => {
    for (const q of [...draws(1), ...draws(2)]) {
      const m = /^1 (tenth|hundredth) is (\d+) (hundredths|thousandths), so (\d) × (\d+) = (\d+)$/.exec(q.why!);
      if (!m) continue;
      expect(Number(m[4]) * Number(m[5]), q.why).toBe(Number(m[6]));
      expect(m[6], q.why).toBe(q.answer);
      expect(m[2], q.why).toBe(m[5]);
      const asked = /^How many (hundredths|thousandths) make (0\.\d+)\?$/.exec(q.prompt)!;
      expect(asked[1], q.why).toBe(m[3]);
      expect(Number(asked[2]) * (m[3] === 'hundredths' ? 100 : 1000), q.prompt).toBeCloseTo(Number(m[6]));
    }
  });
  it('0.001 more shows the real sum, and a number-line marker counts real 0.002 steps', () => {
    for (const q of draws(2)) {
      const m = /^Add 1 thousandth: ([\d.]+) \+ 0\.001 = ([\d.]+)$/.exec(q.why!);
      if (m) { expect(q.prompt, q.why).toBe(`What is 0.001 more than ${m[1]}?`); expect(Number(m[1]) + 0.001, q.why).toBeCloseTo(Number(m[2]), 6); expect(m[2]).toBe(q.answer); continue; }
      const l = /^A is (\d) steps of 0\.002 from ([\d.]+), so it is ([\d.]+)$/.exec(q.why!);
      if (l) { expect(Number(l[2]) + 0.002 * Number(l[1]), q.why).toBeCloseTo(Number(l[3]), 6); expect(l[3]).toBe(q.answer); }
    }
  });
  it('every question at every level has a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
});
