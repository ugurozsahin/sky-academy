// #2317 (y2-stats): the why restates the sum, the difference, the largest row or the count read, from the chart's own rows.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y2-stats')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };
type Row = { label: string; n: number };
const nameOf = (r: Row) => r.label.split(' ').slice(1).join(' ');

describe('y2-stats why (#2317)', () => {
  it('every why is the working from the chart\'s own rows, and all four kinds occur', () => {
    const kinds = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const rows = (q.visual as { rows: Row[] }).rows, w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) \+ (\d+) \+ (\d+) = (\d+)\.$/.exec(w))) {
        expect(rows.map(r => r.n)).toEqual([+m[1], +m[2], +m[3]]);
        expect(+m[1] + +m[2] + +m[3]).toBe(+m[4]);
        expect(q.answer).toBe(m[4]); kinds.add('total');
      } else if ((m = /^(\d+) − (\d+) = (\d+)\.$/.exec(w))) {
        expect(+m[1] - +m[2]).toBe(+m[3]);
        expect(q.answer).toBe(m[3]);
        const [hi, lo] = /more (\S+) than (\S+)\?/.exec(q.prompt)!.slice(1).map(icon => rows.find(r => r.label.startsWith(icon))!.n);
        expect([+m[1], +m[2]]).toEqual([hi, lo]); kinds.add('more');
      } else if ((m = /^(.+) has (\d+), the most\.$/.exec(w))) {
        expect(rows.find(r => nameOf(r) === m![1])!.n).toBe(+m[2]);
        expect(Math.max(...rows.map(r => r.n))).toBe(+m[2]);
        expect(q.answer).toBe(m[1]); kinds.add('most');
      } else {
        m = /^(.+): (\d+) children\.$/.exec(w);
        expect(m, w).toBeTruthy();
        const icon = /chose (\S+)\?/.exec(q.prompt)![1];
        expect(nameOf(rows.find(r => r.label.startsWith(icon))!)).toBe(m![1]);
        expect(rows.find(r => nameOf(r) === m![1])!.n).toBe(+m![2]);
        expect(q.answer).toBe(m![2]); kinds.add('one');
      }
    }
    expect([...kinds].sort()).toEqual(['more', 'most', 'one', 'total']);
  });
});
