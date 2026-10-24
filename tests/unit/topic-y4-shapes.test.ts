import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type GeoPart } from '../../src/curriculum';
import { SHAPES, STATEMENTS, IS_A, decoyOk, type Cls } from '../../src/curriculum/year4-shapes';
import { geometrySVG } from '../../src/ui/vis-geometry';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y4-shapes')!;
type Poly = Extract<GeoPart, { kind: 'polygon' }>;
type Pt = [number, number];
const polys = (q: ReturnType<typeof t.gen>) => (q.visual as { parts: Poly[] }).parts;

/** The oracle: every class a polygon belongs to (inclusive definitions), read from its vertices alone. */
function classesOf(pts: Pt[]): Set<string> {
  const n = pts.length, v = pts.map((p, i): Pt => [pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1]]), len = v.map(([x, y]) => Math.hypot(x, y));
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-3 * Math.max(a, b);
  const par = (i: number, j: number) => Math.abs(v[i][0] * v[j][1] - v[i][1] * v[j][0]) <= 1e-3 * len[i] * len[j];
  const rightAt = (i: number) => Math.abs(v[i][0] * v[(i + n - 1) % n][0] + v[i][1] * v[(i + n - 1) % n][1]) <= 1e-3 * len[i] * len[(i + n - 1) % n];
  return new Set(n === 3 ? triangleClasses(len, [0, 1, 2].some(rightAt), close) : quadClasses(len, par, [0, 1, 2, 3].every(rightAt), close));
}
function triangleClasses(len: number[], right: boolean, close: (a: number, b: number) => boolean): string[] {
  const e = [close(len[0], len[1]), close(len[1], len[2]), close(len[2], len[0])].filter(Boolean).length;
  return [...(e === 3 ? ['equilateral'] : []), e >= 1 ? 'isosceles' : 'scalene', ...(right ? ['right-angled'] : [])];
}
function quadClasses(len: number[], par: (i: number, j: number) => boolean, rights: boolean, close: (a: number, b: number) => boolean): string[] {
  const allEq = len.every(l => close(l, len[0])), pp = par(0, 2) && par(1, 3), out: string[] = [];
  if (pp) out.push('parallelogram');
  if (par(0, 2) !== par(1, 3)) out.push('trapezium');
  if (pp && rights) out.push('rectangle');
  if (pp && allEq) out.push('rhombus');
  if (pp && rights && allEq) out.push('square');
  if ([0, 1, 2, 3].some(i => close(len[i], len[(i + 1) % 4]) && close(len[(i + 2) % 4], len[(i + 3) % 4]))) out.push('kite');
  return out;
}
const exact = (c: Cls, s: Set<string>) => s.has(c);

describe('y4-shapes (#1154)', () => {
  it('is a Year 4 maths geometry topic', () => {
    expect(t).toMatchObject({ year: 'year4', subject: 'maths', title: 'Triangles and Quadrilaterals', strand: 'geometry' });
  });

  it('every template is its own class by the vertex oracle, and the exact class only (the IS_A table lists the rest)', () => {
    for (const [cls, tpls] of Object.entries(SHAPES) as [Cls, typeof SHAPES[Cls]][]) for (const tpl of tpls) {
      const s = classesOf(tpl.pts);
      if (cls === 'irregular') { expect(s.size, cls).toBe(0); continue; }
      expect(exact(cls, s), `${cls} ${JSON.stringify(tpl.pts)}`).toBe(true);
      for (const c of s) expect(c === cls || IS_A[cls]?.includes(c as Cls), `${cls} is also ${c}`).toBe(true);
    }
  });

  it('an equilateral triangle is drawn with equal sides to 0.1 %, and tick marks sit on equal sides', () => {
    const r = rng(5);
    for (let i = 0; i < 100; i++) for (const p of polys(t.gen(2, r))) {
      const len = p.pts.map((a, j) => Math.hypot(p.pts[(j + 1) % 3][0] - a[0], p.pts[(j + 1) % 3][1] - a[1]));
      if (p.ticks?.join() === '1,1,1') for (const l of len) expect(Math.abs(l - len[0]) / len[0]).toBeLessThan(0.001);
    }
  });

  it('d2/d3: the answer is in the asked class, no decoy is, and the answer is exactly that class', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(1154 + d), asked = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const q = t.gen(d, r), parts = polys(q);
        const cls = q.prompt.replace(/^Which is (the|an?) /, '').replace(/\?$/, '').replace(/ triangle$/, '') as Cls;
        asked.add(cls);
        expect(parts).toHaveLength(3);
        for (const p of parts) expect(p.pts, `${q.prompt}: every d${d} shape has ${d === 2 ? 3 : 4} vertices`).toHaveLength(d === 2 ? 3 : 4);
        const ans = parts[q.answer.charCodeAt(0) - 65];
        const sets = parts.map(p => classesOf(p.pts));
        expect(sets[q.answer.charCodeAt(0) - 65].has(cls), q.prompt).toBe(true);
        sets.forEach((s, k) => { if (k !== q.answer.charCodeAt(0) - 65) expect(s.has(cls), `${q.prompt} decoy ${k}`).toBe(false); });
        expect(ans.label).toBe(q.answer);
        expect(q.options.slice().sort()).toEqual(['A', 'B', 'C']);
        // the answer is never a more special member: a plain rectangle, parallelogram, isosceles or scalene
        const a = sets[q.answer.charCodeAt(0) - 65];
        if (cls === 'rectangle') expect(a.has('square')).toBe(false);
        if (cls === 'parallelogram') expect(a.has('rectangle') || a.has('rhombus')).toBe(false);
        if (cls === 'isosceles') expect(a.has('equilateral')).toBe(false);
        if (cls === 'scalene') expect(a.has('right-angled')).toBe(false);
        // a trapezium never beside the parallelogram family
        const all = new Set(sets.flatMap(s => [...s]));
        if (cls === 'trapezium') expect(all.has('parallelogram')).toBe(false);
        if (all.has('trapezium') && cls !== 'trapezium') expect(sets.some(s => s.has('parallelogram'))).toBe(false);
      }
      expect(asked.size).toBe(d === 2 ? 4 : 6);
    }
  });

  it('tick marks sit on equal sides: a ticked side matches another by count exactly when it matches by length, and never an unticked one', () => {
    for (const [cls, tpls] of Object.entries(SHAPES)) for (const tpl of tpls) {
      const n = tpl.pts.length, len = tpl.pts.map((a, i) => Math.hypot(tpl.pts[(i + 1) % n][0] - a[0], tpl.pts[(i + 1) % n][1] - a[1]));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const [ti, tj] = [tpl.ticks?.[i] ?? 0, tpl.ticks?.[j] ?? 0], same = Math.abs(len[i] - len[j]) < 1e-6;
        if (ti || tj) expect(ti === tj, `${cls} sides ${i},${j}`).toBe(same);
      }
    }
  });

  it('a statement is false of every "no" class for its yes shape (read by the oracle), and the polygon guard rejects a bad right index', () => {
    for (const s of STATEMENTS) for (const tpl of SHAPES[s.yes]) for (const no of s.no) expect(classesOf(tpl.pts).has(no), `${s.has}: ${s.yes} v ${no}`).toBe(false);
    const warn = console.warn; console.warn = () => {};
    try { expect(geometrySVG({ type: 'geometry', parts: [{ kind: 'polygon', pts: [[1, 1], [9, 1], [1, 9]], right: [5] }] })).not.toContain('<path'); } finally { console.warn = warn; }
  });

  it('decoyOk gives every asked class at least two legal decoy classes', () => {
    const tri: Cls[] = ['equilateral', 'isosceles', 'scalene', 'right-angled'], quad: Cls[] = ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezium', 'kite', 'irregular'];
    for (const pool of [tri, quad]) for (const asked of pool.filter(c => c !== 'irregular')) expect(pool.filter(c => decoyOk(asked, c)).length, asked).toBeGreaterThanOrEqual(2);
  });

  it('each letter answers 25–42 % of 1,500 d2 and d3 cards', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(77 + d), n: Record<string, number> = { A: 0, B: 0, C: 0 };
      for (let i = 0; i < 1500; i++) n[t.gen(d, r).answer]++;
      for (const k of 'ABC') { expect(n[k] / 1500).toBeGreaterThan(0.25); expect(n[k] / 1500).toBeLessThan(0.42); }
    }
  });

  it('d1: Yes/No, true and false about half each, and the statement table is true of its yes term only', () => {
    const r = rng(11); let yes = 0; const N = 600;
    for (let i = 0; i < N; i++) {
      const q = t.gen(1, r);
      // the statement is drawn: one unlettered polygon in the middle third (#2271)
      const drawn = polys(q);
      expect(drawn).toHaveLength(1);
      expect(drawn[0].label).toBeUndefined();
      expect(Math.min(...drawn[0].pts.map(p => p[0]))).toBeGreaterThanOrEqual(35);
      expect(Math.max(...drawn[0].pts.map(p => p[0]))).toBeLessThanOrEqual(64);
      // the key follows the statement: Yes exactly when the asked term is the statement's own shape
      const st = STATEMENTS.find(x => q.prompt.startsWith(`A ${x.noun} has ${x.has}. Is it `))!, asked = q.prompt.match(/Is it (?:an? )?([a-z-]+)\?$/)![1];
      expect(st, q.prompt).toBeTruthy();
      expect([st.yes, ...st.no]).toContain(asked);
      expect(q.answer, q.prompt).toBe(asked === st.yes ? 'Yes' : 'No');
      expect(q.options.slice().sort()).toEqual(['No', 'Yes']);
      if (q.answer === 'Yes') yes++;
    }
    expect(yes / N).toBeGreaterThan(0.4); expect(yes / N).toBeLessThan(0.6);
    // the statement itself must settle each "no": the yes term is never a member of a no term (the inclusive reading), and a card never asks whether a shape is the one it names
    for (const s of STATEMENTS) for (const n of s.no) {
      expect(s.no).not.toContain(s.yes);
      expect(IS_A[s.yes]?.includes(n) ?? false, `${s.has}: ${s.yes} is a ${n}`).toBe(false);
    }
  });

  it('terms never reach a bubble, and the drawing uses design tokens only', () => {
    const r = rng(3);
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 100; i++) {
      const q = t.gen(d, r);
      expect(q.options.every(o => o.length <= 3)).toBe(true);
      if (q.visual) expect(geometrySVG(q.visual as never)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it('every polygon stays inside its own third of the viewBox, with the letter under it', () => {
    const r = rng(9), bands = [[2, 31], [35, 64], [68, 97]];
    for (let i = 0; i < 300; i++) for (const d of [2, 3] as Difficulty[]) polys(t.gen(d, r)).forEach((p, k) => {
      for (const [x, y] of p.pts) { expect(x).toBeGreaterThanOrEqual(bands[k][0] - 0.01); expect(x).toBeLessThanOrEqual(bands[k][1] + 0.01); expect(y).toBeGreaterThanOrEqual(5.99); expect(y).toBeLessThanOrEqual(54.01); }
    });
  });
});
