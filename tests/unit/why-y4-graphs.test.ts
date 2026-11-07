// #2317 (y4-graphs): the why is the working from the chart's own values: the value read, the difference, the sum or the peak.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y4-graphs')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };
type Row = { label: string; n: number };

describe('y4-graphs why (#2317)', () => {
  it('is real working from the visual\'s own rows and lands on the answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const rows = (q.visual as unknown as { rows: Row[] }).rows, vals = rows.map(r => r.n), w = q.why!;
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) − (\d+) = (\d+)\.$/.exec(w))) {
        expect(+m[1] - +m[2], w).toBe(+m[3]); expect(q.answer).toBe(m[3]);
        expect(vals).toContain(+m[1]); expect(vals).toContain(+m[2]); kinds.add('diff');
      } else if ((m = /^(\d+) \+ (\d+) = (\d+)\.$/.exec(w))) {
        expect(+m[1] + +m[2], w).toBe(+m[3]); expect(q.answer).toBe(m[3]);
        expect(vals).toContain(+m[1]); expect(vals).toContain(+m[2]); kinds.add('sum');
      } else if ((m = /^(.+): (\d+(?:\.\d+)?)(?: \S+)?, the (\w+)\.$/.exec(w))) {
        expect(q.answer, w).toBe(m[1]); expect(Math.max(...vals)).toBe(+m[2]);
        expect(rows.find(r => r.label === m![1])!.n).toBe(+m[2]); kinds.add('peak');
      } else {
        m = /^(.+): (\d+(?:\.\d+)?)(?: \S+)?\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(rows.find(r => r.label === m![1])!.n).toBe(+m![2]); expect(q.answer).toBe(m![2]); kinds.add('read');
      }
    }
    expect([...kinds].sort()).toEqual(['diff', 'peak', 'read', 'sum']);
  });
});
