// #2317 (y5-timetable): the why is the stop's time, the two times and their gap, or the start time plus the journey.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y5-timetable')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };
const mins = (c: string) => +c.slice(0, 2) * 60 + +c.slice(3);

describe('y5-timetable why (#2317)', () => {
  it('is short, true to the arithmetic and lands on the answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      let m: RegExpExecArray | null;
      if ((m = /^(.+) is at (\d\d:\d\d) on the timetable\.$/.exec(w))) { expect(q.answer).toBe(m[2]); kinds.add('read'); }
      else if ((m = /^(\d\d:\d\d) to (\d\d:\d\d) is (\d+) min\.$/.exec(w))) { expect(mins(m[2]) - mins(m[1]), w).toBe(+m[3]); expect(q.answer).toBe(m[3]); kinds.add('gap'); }
      else { m = /^(\d\d:\d\d) \+ (\d+) min = (\d\d:\d\d)\.$/.exec(w); expect(m, w).toBeTruthy(); expect(mins(m![1]) + +m![2], w).toBe(mins(m![3])); expect(q.answer).toBe(m![3]); kinds.add('complete'); }
    }
    expect([...kinds].sort()).toEqual(['complete', 'gap', 'read']);
  });
});
