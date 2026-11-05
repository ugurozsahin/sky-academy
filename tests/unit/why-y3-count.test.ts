// #2317 (y3-count): the why shows the step counted, or the sum that is 10 or 100 more or less.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const num = (s: string) => +s.replace(/,/g, '');
const draw = () => { const t = TOPICS.find(x => x.id === 'y3-count')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y3-count why (#2317)', () => {
  it('every why matches its own question and answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      let m: RegExpExecArray | null;
      if ((m = /^Count (on|back) (\d+) each time: ([\d,]+), ([\d,]+)\.$/.exec(w))) {
        const step = +m[2] * (m[1] === 'on' ? 1 : -1);
        expect(num(m[4])).toBe(num(q.answer));
        expect(num(m[3]) + step).toBe(num(q.answer));
        expect(q.prompt).toContain(m[3]); kinds.add(m[1]);
      } else {
        m = /^([\d,]+) ([+−]) (\d+) = ([\d,]+)$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(num(m![4])).toBe(num(q.answer));
        expect(num(m![1]) + (m![2] === '+' ? 1 : -1) * +m![3]).toBe(num(q.answer));
        expect(q.prompt).toBe(`${m![3]} ${m![2] === '+' ? 'more' : 'less'} than ${m![1]} = ?`); kinds.add('sum' + m![2]);
      }
    }
    expect([...kinds].sort()).toEqual(['back', 'on', 'sum+', 'sum−']);
  });
});
