import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type GeoPart } from '../../src/curriculum';
import { STATEMENTS } from '../../src/curriculum/year5-polygons';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { geometrySVG } from '../../src/ui/vis-geometry';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y5-polygons')!;
type Poly = Extract<GeoPart, { kind: 'polygon' }>;
type Pt = [number, number];
const draw = (d: Difficulty, n = 300) => { const r = rng(1211 * 10 + d); return Array.from({ length: n }, () => t.gen(d, r)); };
const poly = (q: ReturnType<typeof t.gen>) => { const v = q.visual as { type: string; parts: Poly[] }; expect(v.type).toBe('geometry'); expect(v.parts).toHaveLength(1); return v.parts[0]; };

/** The oracle: sides and interior angles read from the vertices alone (tolerance 1e-6). */
function sidesAndAngles(pts: Pt[]) {
  const n = pts.length, v = pts.map((p, i): Pt => [pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1]]);
  const len = v.map(([x, y]) => Math.hypot(x, y));
  const ang = v.map((e, i) => { const b = v[(i + n - 1) % n]; return Math.acos(-(e[0] * b[0] + e[1] * b[1]) / (len[i] * len[(i + n - 1) % n])); });
  return { len, ang };
}
const allEq = (a: number[]) => a.every(x => Math.abs(x - a[0]) <= 1e-6 + 2e-3 * a[0]);
const isRegular = (pts: Pt[]) => { const { len, ang } = sidesAndAngles(pts); return allEq(len) && allEq(ang); };
const share = (qs: ReturnType<typeof draw>) => qs.filter(q => q.answer === 'Yes').length / qs.length;

describe('y5-polygons (#1211)', () => {
  it('is a Year 5 maths geometry topic with a safe icon', () => {
    expect(t).toMatchObject({ year: 'year5', subject: 'maths', strand: 'geometry', title: 'Regular Polygons', icon: '🔷' });
    expect(['⬟', '⬢']).not.toContain(t.icon);
  });

  it('every card is Yes/No with a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect([...q.options].sort()).toEqual(['No', 'Yes']); expect(q.options).toContain(q.answer);
      expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1 and d2: "regular" equals the side-and-angle computation from the vertices, at most 6 vertices', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const p = poly(q);
      expect(p.pts.length).toBeGreaterThanOrEqual(3); expect(p.pts.length).toBeLessThanOrEqual(6);
      expect(q.answer === 'Yes', q.prompt).toBe(isRegular(p.pts));
    }
  });

  it('yes is correct on 40–60 % of cards at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = share(draw(d)); expect(s, `d${d}`).toBeGreaterThanOrEqual(0.4); expect(s, `d${d}`).toBeLessThanOrEqual(0.6); }
  });

  it('d2: at least a third of the cards are rhombus or rectangle traps (equal sides only, or equal angles only)', () => {
    const qs = draw(2);
    const traps = qs.filter(q => { const { len, ang } = sidesAndAngles(poly(q).pts); return allEq(len) !== allEq(ang) && poly(q).pts.length === 4; });
    expect(traps.length / qs.length).toBeGreaterThanOrEqual(1 / 3);
    for (const q of traps) expect(q.answer).toBe('No');
  });

  it('d2: side labels are in cm and match the drawn lengths at one scale', () => {
    for (const q of draw(2)) {
      const p = poly(q), { len } = sidesAndAngles(p.pts);
      expect(p.sides, q.prompt).toHaveLength(p.pts.length);
      const cm = p.sides!.map(s => { const m = /^(\d+) cm$/.exec(s); expect(m, s).toBeTruthy(); return Number(m![1]); });
      const k = len[0] / cm[0];
      cm.forEach((c, i) => expect(Math.abs(len[i] / c - k), q.prompt).toBeLessThan(0.02 * k));
    }
  });

  it('d1 and d2: Yes and No cards are turned alike, so the tilt never gives the answer away', () => {
    const level = (pts: Pt[]) => pts.some((a, i) => { const b = pts[(i + 1) % pts.length]; return Math.abs(a[0] - b[0]) < 0.05 || Math.abs(a[1] - b[1]) < 0.05; });
    for (const d of [1, 2] as Difficulty[]) {
      const qs = draw(d, 600), rate = (yes: boolean) => { const g = qs.filter(q => (q.answer === 'Yes') === yes); return g.filter(q => level(poly(q).pts)).length / g.length; };
      expect(rate(true), `d${d} yes`).toBeLessThan(0.1); expect(rate(false), `d${d} no`).toBeLessThan(0.1);
      expect(Math.abs(rate(true) - rate(false)), `d${d}`).toBeLessThan(0.05);
    }
  });

  it('d3: text only, every statement from the hand-checked table with its answer', () => {
    const seen = new Set<string>();
    for (const q of draw(3, 600)) {
      expect(q.visual).toBeUndefined();
      const s = STATEMENTS.find(x => x.text === q.prompt)!;
      expect(s, q.prompt).toBeTruthy(); expect(q.answer).toBe(s.regular ? 'Yes' : 'No'); seen.add(s.text);
    }
    expect(seen.size).toBe(STATEMENTS.length);
  });

  it('draws without a warning', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 40)) expect(geometrySVG(q.visual as never)).toContain('class="poly"');
  });
});
