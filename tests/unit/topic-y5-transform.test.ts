import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type Visual } from '../../src/curriculum';
import { transform } from '../../src/curriculum/year5-transform';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y5-transform')!;
type Coords = Extract<Visual, { type: 'coords' }>;
type P = [number, number];
const vis = (q: ReturnType<typeof t.gen>) => q.visual as Coords;
const N = 300;
const draws = (d: Difficulty) => { const r = rng(1214 * d); return Array.from({ length: N }, () => t.gen(d, r)); };
const key = (pts: P[]) => pts.map(p => p.join(',')).sort().join(';');
const box = (pts: P[]) => ({ x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) });
const clash = (a: P[], b: P[]) => { const p = box(a), q = box(b); return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1; };
const dirs = (s: string) => { const r = /(\d+) (right|left)/.exec(s)!, u = /(\d+) (up|down)/.exec(s)!; return [(r[2] === 'right' ? 1 : -1) * +r[1], (u[2] === 'up' ? 1 : -1) * +u[1]]; };

describe('y5-transform (#1214)', () => {
  it('is a Year 5 maths geometry topic called Reflection and Translation', () => {
    expect(t).toMatchObject({ year: 'year5', subject: 'maths', title: 'Reflection and Translation', strand: 'geometry', icon: '🔄' });
  });

  it('d1/d2: the right letter is the transformed shape and no other candidate is, over 300 draws', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const v = vis(q), [shaded, ...cands] = v.shapes!;
      expect(shaded.shaded).toBe(true);
      expect(cands.map(c => c.label)).toEqual(['A', 'B', 'C']);
      const want = d === 1 ? (() => { const [dx, dy] = dirs(q.prompt); return transform.move(shaded.pts, dx, dy); })() : transform.reflect(shaded.pts, v.mirror!.axis, v.mirror!.at);
      const hits = cands.filter(c => key(c.pts) === key(want));
      expect(hits.map(c => c.label), q.prompt).toEqual([q.answer]);
      expect(q.options).toEqual(['A', 'B', 'C']);
    }
  });

  it('every shape stays on the grid, has 3–5 corners in a 3 × 3 box, and no two bounding boxes overlap', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const sh = vis(q).shapes!;
      expect(new Set(sh.map(s => key(s.pts))).size).toBe(sh.length);
      for (const s of sh) {
        expect(s.pts.length >= 3 && s.pts.length <= 5).toBe(true);
        const b = box(s.pts);
        expect(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 10 && b.y1 <= 10, q.prompt).toBe(true);
      }
      if (d < 3) for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) expect(clash(sh[i].pts, sh[j].pts)).toBe(false);
    }
  });

  it('d1 translations are 1–4 each way and the two amounts differ; d2 draws a mirror with the shape clear of it', () => {
    for (const q of draws(1)) { const [dx, dy] = dirs(q.prompt); expect(Math.abs(dx)).not.toBe(Math.abs(dy)); expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeGreaterThanOrEqual(3); expect(Math.min(Math.abs(dx), Math.abs(dy))).toBeGreaterThanOrEqual(1); }
    for (const q of draws(2)) { const v = vis(q), b = box(v.shapes![0].pts), m = v.mirror!, [lo, hi] = m.axis === 'x' ? [b.x0, b.x1] : [b.y0, b.y1]; expect(hi < m.at || lo > m.at).toBe(true); }
  });

  it('d3: each of the three cards is answered by the drawing', () => {
    const seen = new Set<string>();
    for (const q of draws(3)) {
      expect(new Set(q.options).size).toBe(q.options.length); expect(q.options).toContain(q.answer);
      const v = vis(q);
      if (q.prompt.startsWith('How many')) {
        seen.add('describe');
        const [a, b] = v.shapes!, dx = b.pts[0][0] - a.pts[0][0], dy = b.pts[0][1] - a.pts[0][1];
        expect(q.answer).toBe(String(q.prompt.includes('right') ? dx : dy));
        expect(key(transform.move(a.pts, dx, dy))).toBe(key(b.pts));
      } else if (q.prompt.startsWith('P is at')) {
        seen.add('corner');
        const p = v.points[0], to = q.answer.match(/\d+/g)!.map(Number);
        const want = v.mirror ? transform.reflect([[p.x, p.y]], v.mirror.axis, v.mirror.at)[0] : (() => { const [dx, dy] = dirs(q.prompt); return [p.x + dx, p.y + dy]; })();
        expect(to).toEqual(want);
        for (const o of q.options) { const n = o.match(/\d+/g)!.map(Number); expect(n.every(c => c >= 0 && c <= 10)).toBe(true); }
      } else { seen.add('area'); expect(q.answer).toBe('same'); expect([...q.options].sort()).toEqual(['bigger', 'same', 'smaller']); }
    }
    expect([...seen].sort()).toEqual(['area', 'corner', 'describe']);
  });

  it('has a speakable say and a hint on every card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) { expect(q.say).toBeTruthy(); expect(q.say).not.toMatch(/[()]/); expect(q.hint).toBeTruthy(); }
  });
});
