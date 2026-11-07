// #2317 (y5-linegraph): the why is the working from the graph's own readings: the reading, the difference, the total, or the extreme.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y5-linegraph')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y5-linegraph why (#2317)', () => {
  it('is real working read from the chart and lands on the answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      const rows = (q.visual as { rows: { label: string; n: number }[] }).rows;
      const at = (l: string) => rows.find(r => r.label === l)!.n;
      let m: RegExpExecArray | null;
      if ((m = /^At (.+) the line reaches (\d+) \S+\.$/.exec(w))) {
        expect(at(m[1]), w).toBe(+m[2]); expect(q.answer).toBe(m[2]); kinds.add('read');
      } else if ((m = /^(\d+) − (\d+) = (\d+) \S+\.$/.exec(w))) {
        expect(+m[1] - +m[2], w).toBe(+m[3]); expect(q.answer).toBe(m[3]);
        const vals = rows.map(r => r.n);
        kinds.add(+m[1] === Math.max(...vals) && +m[2] === Math.min(...vals) && /^highest/i.test(q.prompt) ? 'range' : 'diff');
      } else if ((m = /^(\d+) \+ (\d+) \+ (\d+) = (\d+) \S+\.$/.exec(w))) {
        expect(+m[1] + +m[2] + +m[3], w).toBe(+m[4]); expect(q.answer).toBe(m[4]); kinds.add('total');
      } else {
        m = /^The (highest|lowest) point is (\d+) \S+, at (.+)\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(at(m![3]), w).toBe(+m![2]); expect(q.answer).toBe(m![3]); kinds.add('extreme');
      }
    }
    expect([...kinds].sort()).toEqual(['diff', 'extreme', 'range', 'read', 'total']);
  });
});
