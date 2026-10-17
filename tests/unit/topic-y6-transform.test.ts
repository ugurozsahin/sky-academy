import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question, Visual } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-transform')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1249 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Coords = Extract<Visual, { type: 'coords' }>;
const vis = (q: Question): Coords => { if (q.visual?.type !== 'coords') throw new Error('no grid'); return q.visual; };
type P = [number, number];
const num = (n: number) => (n < 0 ? '−' : '') + Math.abs(n);
const fmt = (p: P) => `(${num(p[0])}, ${num(p[1])})`;
const parse = (s: string): P => { const m = /^\((−?\d+), (−?\d+)\)$/.exec(s)!; const n = (t: string) => Number(t.replace('−', '-')); return [n(m[1]), n(m[2])]; };
const inGrid = (p: P) => p[0] >= -5 && p[0] <= 5 && p[1] >= -5 && p[1] <= 5;
const key = (pts: P[]) => pts.map(p => p.join(',')).sort().join(';');
const box = (pts: P[]) => ({ x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) });
const clash = (a: P[], b: P[]) => { const p = box(a), q = box(b); return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1; };
// Written here from the definitions, not imported: a reflection in the y-axis negates x, in the x-axis negates y; a half turn negates both.
const refl = (pts: P[], axis: string): P[] => pts.map(([x, y]) => axis === 'y' ? [-x, y] : [x, -y]);

describe('y6-transform (#1249)', () => {
  it('the conventions, pinned by hand: the y-axis negates x, the x-axis negates y, a move adds', () => {
    expect(refl([[2, 3]], 'y')).toEqual([[-2, 3]]); expect(refl([[2, 3]], 'x')).toEqual([[2, -3]]);
    expect(fmt([-3, 4])).toBe('(−3, 4)');
  });

  it('is registered for Year 6 maths in the geometry strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'geometry', title: 'Reflect in the Axes' }); });

  it('every card is on the −5…5 grid, with four distinct options (three lettered at d2), a speakable say, R-LBL labels and a real minus sign', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const v = vis(q); expect(v.size).toBe(5); expect(v.min).toBe(-5);
      expect(q.options).toHaveLength(d === 2 ? 3 : 4); expect(new Set(q.options).size).toBe(q.options.length); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(rLblProblem(q), q.prompt).toBeNull();
      expect(q.prompt + q.options.join('')).not.toMatch(/-\d/);
    }
  });

  it('d1: the answer is the start plus the move, and no decoy is on it', () => {
    for (const q of draw(1)) {
      const m = /^(\([^)]*\)) moves (.*)\. Now at\?$/.exec(q.prompt)!, start = parse(m[1]);
      let dx = 0, dy = 0;
      for (const part of m[2].split(', ')) { const [n, w] = part.split(' '); if (w === 'right') dx = Number(n); else if (w === 'left') dx = -Number(n); else if (w === 'up') dy = Number(n); else dy = -Number(n); }
      expect(q.answer, q.prompt).toBe(fmt([start[0] + dx, start[1] + dy]));
      expect(vis(q).points).toEqual([{ x: start[0], y: start[1], label: 'A' }]);
      for (const o of q.options) expect(inGrid(parse(o))).toBe(true);
    }
  });

  it('d2: exactly one lettered shape is the shaded one reflected, the other-axis reflection is always a decoy, and no two outlines overlap', () => {
    const axes = new Set<string>(), thirds = new Set<string>();
    for (const q of draw(2)) {
      const axis = /in the (\w)-axis\?$/.exec(q.prompt)![1], other = axis === 'x' ? 'y' : 'x'; axes.add(axis);
      const [shaded, ...cands] = vis(q).shapes!;
      expect(shaded.shaded).toBe(true); expect(cands.map(c => c.label)).toEqual(['A', 'B', 'C']);
      const sp = shaded.pts as P[], want = key(refl(sp, axis));
      expect(cands.filter(c => key(c.pts as P[]) === want).map(c => c.label), q.prompt).toEqual([q.answer]);
      expect(cands.some(c => key(c.pts as P[]) === key(refl(sp, other))), 'the other-axis decoy').toBe(true);
      expect(new Set(cands.map(c => key(c.pts as P[]))).size).toBe(3);
      for (const c of cands) { expect(c.pts.every(p => inGrid(p as P))).toBe(true); expect(clash(sp, c.pts as P[])).toBe(false); }
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(clash(cands[i].pts as P[], cands[j].pts as P[])).toBe(false);
      const half = key(sp.map(([x, y]) => [-x, -y] as P)), third = cands.find(c => key(c.pts as P[]) !== want && key(c.pts as P[]) !== key(refl(sp, other)))!;
      const bx = sp.map(p => p[0]), by = sp.map(p => p[1]), slid = sp.map(([x, y]) => [x - (Math.min(...bx) + Math.max(...bx)), y - (Math.min(...by) + Math.max(...by))] as P);
      expect([half, key(slid)], q.prompt).toContain(key(third.pts as P[]));   // a half turn, or the outline slid unflipped into the same place
      thirds.add(key(third.pts as P[]) === half ? 'half turn' : 'slid copy');
      expect([...q.options].sort()).toEqual(['A', 'B', 'C']);
      expect(sp.every(([x, y]) => Math.abs(x) >= 1 && Math.abs(y) >= 1)).toBe(true);
    }
    expect([...axes].sort()).toEqual(['x', 'y']); expect([...thirds].sort()).toEqual(['half turn', 'slid copy']);
  });

  it('d3: the answer is the (moved, then) reflected vertex, and the wrong-order and other-axis slips are decoys', () => {
    let two = 0, one = 0;
    for (const q of draw(3)) {
      const reflectOnly = /^Reflect (\([^)]*\)) in the (\w)-axis\.$/.exec(q.prompt), both = /^(\([^)]*\)): (.*), then reflect in (\w)-axis\.$/.exec(q.prompt);
      let start: P, axis: string, dx = 0, dy = 0;
      if (reflectOnly) { one++; start = parse(reflectOnly[1]); axis = reflectOnly[2]; }
      else {
        two++; start = parse(both![1]); axis = both![3];
        for (const part of both![2].split(', ')) { const [n, w] = part.split(' '); if (w === 'right') dx = Number(n); else if (w === 'left') dx = -Number(n); else if (w === 'up') dy = Number(n); else dy = -Number(n); }
      }
      const moved: P = [start[0] + dx, start[1] + dy], [ans] = refl([moved], axis);
      expect(q.answer, q.prompt).toBe(fmt(ans));
      expect(inGrid(moved) && inGrid(ans)).toBe(true);
      expect(q.options.filter(o => o === fmt(ans))).toHaveLength(1);
      const [wrong] = refl([moved], axis === 'x' ? 'y' : 'x');
      expect(fmt(wrong), q.prompt).not.toBe(q.answer);   // the moved point is never on its own mirror line, so the other axis always differs
      expect(q.options, q.prompt).toContain(fmt(wrong));
      for (const o of q.options) expect(inGrid(parse(o))).toBe(true);
    }
    expect(one).toBeGreaterThan(100); expect(two).toBeGreaterThan(100);
  });
});
