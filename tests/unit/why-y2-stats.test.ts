// #2317 (y2-stats-table, y2-stats-order): the why restates the sum, the difference, the largest row or the ranking from the chart's own counts.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string) => { const t = TOPICS.find(x => x.id === id)!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };
type Row = { label: string; n: number };
const rowsOf = (v: unknown) => (v as { rows: Row[] }).rows;
const nameOf = (r: Row) => r.label.split(' ').slice(1).join(' ');

describe('Year 2 statistics whys (#2317)', () => {
  it('y2-stats-table: each why is the working from the table\'s own rows', () => {
    const kinds = new Set<string>();
    for (const q of draw('y2-stats-table')) {
      const rows = rowsOf(q.visual), w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) \+ (\d+) \+ (\d+) = (\d+)\.$/.exec(w))) {
        expect(rows.map(r => r.n)).toEqual([+m[1], +m[2], +m[3]]);
        expect(q.answer).toBe(m[4]); kinds.add('total');
      } else if ((m = /^(\d+) − (\d+) = (\d+)\.$/.exec(w))) {
        expect(+m[1] - +m[2]).toBe(+m[3]);
        expect(q.answer).toBe(m[3]);
        expect(rows.map(r => r.n)).toContain(+m[1]); expect(rows.map(r => r.n)).toContain(+m[2]); kinds.add('more');
      } else if ((m = /^(.+) has (\d+), the most\.$/.exec(w))) {
        expect(q.answer).toBe(m[1]);
        expect(rows.find(r => nameOf(r) === m![1])!.n).toBe(+m[2]);
        expect(Math.max(...rows.map(r => r.n))).toBe(+m[2]); kinds.add('most');
      } else {
        m = /^(.+): (\d+) children\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(rows.find(r => nameOf(r) === m![1])!.n).toBe(+m![2]);
        expect(q.answer).toBe(m![2]); kinds.add('one');
      }
    }
    expect([...kinds].sort()).toEqual(['more', 'most', 'one', 'total']);
  });
  it('y2-stats-order: the why lists the categories with their counts, biggest first, matching the answer', () => {
    for (const q of draw('y2-stats-order')) {
      const rows = rowsOf(q.visual), w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const parts = w.replace(/\.$/, '').split(', ').map(p => { const i = p.lastIndexOf(' '); return [p.slice(0, i), +p.slice(i + 1)] as const; });
      expect(parts.map(p => p[0]).join(',')).toBe(q.answer);
      for (const [name, n] of parts) expect(rows.find(r => nameOf(r) === name)!.n).toBe(n);
      expect(parts.map(p => p[1])).toEqual([...parts.map(p => p[1])].sort((a, b) => b - a));
    }
  });
});
