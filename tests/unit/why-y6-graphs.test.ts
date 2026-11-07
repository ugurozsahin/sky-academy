// #2317 (y6-graphs): the why is the working from the graph's own ratio or readings: 8 km is 5 miles, or the cyclist's difference.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y6-graphs')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y6-graphs why (#2317)', () => {
  it('is real working and lands on the answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) km is (\d+) miles: 8 km is 5 miles\.$/.exec(w))) {
        expect(+m[1] * 5 / 8, w).toBe(+m[2]); expect(q.answer).toBe(m[2]); kinds.add('km');
      } else if ((m = /^(\d+) miles is (\d+) km: 5 miles is 8 km\.$/.exec(w))) {
        expect(+m[1] * 8 / 5, w).toBe(+m[2]); expect(q.answer).toBe(m[2]); kinds.add('miles');
      } else if ((m = /^5 miles is 8 km, so (\d+) miles is (\d+) km\.$/.exec(w))) {
        expect(+m[1] * 8 / 5, w).toBe(+m[2]); expect(q.answer).toBe(m[2]); kinds.add('beyond');
      } else if ((m = /^(\d+) − (\d+) = (\d+) km\.$/.exec(w))) {
        expect(+m[1] - +m[2], w).toBe(+m[3]); expect(q.answer).toBe(m[3]); kinds.add('cyclist');
      } else {
        m = /^(\d+) miles is (\d+) km, and (\d+) − (\d+) = (\d+)\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(+m![1] * 8 / 5).toBe(+m![2]); expect(+m![3] - +m![4]).toBe(+m![5]); expect(q.answer).toBe(m![5]); kinds.add('further');
      }
    }
    expect([...kinds].sort()).toEqual(['beyond', 'cyclist', 'further', 'km', 'miles']);
  });
});
