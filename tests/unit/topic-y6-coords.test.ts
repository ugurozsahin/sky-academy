import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type Visual } from '../../src/curriculum';
import { coordsAnswer } from '../../src/curriculum/year6-coords';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y6-coords')!;
type Coords = Extract<Visual, { type: 'coords' }>;
type Q = ReturnType<typeof t.gen>;
type Pt = { x: number; y: number };
const vis = (q: Q) => q.visual as Coords;
const N = 300;
const draws = (d: Difficulty) => { const r = rng(1213 * d); return Array.from({ length: N }, () => t.gen(d, r)); };
const PAIR = /^\((−?\d+), (−?\d+)\)$/;
const parse = (s: string): Pt => { const m = s.match(PAIR)!; return { x: +m[1].replace('−', '-'), y: +m[2].replace('−', '-') }; };
const fmt = (p: Pt) => `(${p.x < 0 ? '−' : ''}${Math.abs(p.x)}, ${p.y < 0 ? '−' : ''}${Math.abs(p.y)})`;
const quadrant = (p: Pt) => `${Math.sign(p.x)}${Math.sign(p.y)}`;

describe('y6-coords (#1213)', () => {
  it('is a Year 6 maths geometry topic called Four-Quadrant Coordinates', () => {
    expect(t).toMatchObject({ year: 'year6', subject: 'maths', title: 'Four-Quadrant Coordinates', strand: 'geometry', icon: '🧭' });
  });

  it('every card draws a −5…5 grid with distinct, labelled, in-range points', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const v = vis(q);
      expect([v.size, v.min]).toEqual([5, -5]);
      expect(new Set(v.points.map(p => `${p.x},${p.y}`)).size, q.prompt).toBe(v.points.length);
      expect(new Set(v.points.map(p => p.label)).size).toBe(v.points.length);
      for (const p of v.points) { expect(p.x >= -5 && p.x <= 5 && p.y >= -5 && p.y <= 5, `${p.label} in range`).toBe(true); expect(p.x !== 0 && p.y !== 0, `${p.label} off the axes`).toBe(true); }
    }
  });

  it('every negative label uses U+2212 and never an ASCII hyphen', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      for (const s of [q.prompt, q.answer, ...q.options]) expect(s, s).not.toMatch(/-/);
      for (const s of q.options.concat(q.answer)) if (s.includes(',')) expect(s).toMatch(PAIR);
      expect(q.say, q.prompt).not.toMatch(/[−()]/);
    }
  });

  it('d1: the answer is the plotted point, and the swapped pair is an option whenever it differs', () => {
    let negatives = 0;
    for (const q of draws(1)) {
      const label = q.prompt.match(/^What are the coordinates of ([A-D])\?$/)![1], v = vis(q);
      expect(q.answer).toBe(coordsAnswer.read(v.points, label));
      const p = parse(q.answer), swapped = fmt({ x: p.y, y: p.x });
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      if (swapped !== q.answer) expect(q.options, q.prompt).toContain(swapped);
      for (const o of q.options) if (o !== q.answer) { const s = parse(o); expect(Math.abs(s.x) === Math.abs(p.x) && Math.abs(s.y) === Math.abs(p.y) || (Math.abs(s.x) === Math.abs(p.y) && Math.abs(s.y) === Math.abs(p.x)), `${o} is a named slip of ${q.answer}`).toBe(true); }
      if (p.x < 0 || p.y < 0) negatives++;
    }
    expect(negatives, 'negative coordinates are common').toBeGreaterThan(N / 2);
  });

  it('d2: the letter sits at the pair, the others at its swapped and sign-slip places, in at least three quadrants', () => {
    for (const q of draws(2)) {
      const pair = parse(q.prompt.match(/^Which point is at (\(.*\))\?$/)![1]), v = vis(q);
      expect(q.answer).toBe(coordsAnswer.at(v.points, pair));
      expect(q.answer).toHaveLength(1);
      expect(q.options.slice().sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(v.points).toHaveLength(4);
      expect(new Set(v.points.map(quadrant)).size, q.prompt).toBeGreaterThanOrEqual(3);
      const places = v.points.filter(p => p.label !== q.answer).map(p => fmt(p));
      expect(places, 'the swapped place is a decoy').toContain(fmt({ x: pair.y, y: pair.x }));
      for (const o of places) { const s = parse(o); expect(Math.abs(s.x) === Math.abs(pair.x) || Math.abs(s.x) === Math.abs(pair.y), `${o} is a slip of ${fmt(pair)}`).toBe(true); }
    }
  });

  it('d3: the answer is B + C − A, recomputed here, over a rectangle that crosses an axis', () => {
    for (const q of draws(3)) {
      const v = vis(q), [a, b, c] = v.points;
      expect(v.points.map(p => p.label)).toEqual(['A', 'B', 'C']);
      expect(v.join).toEqual(['B', 'A', 'C']);
      expect(b.y).toBe(a.y);
      expect(c.x).toBe(a.x);   // the right angle is at A
      const want = { x: b.x + c.x - a.x, y: b.y + c.y - a.y };
      expect(q.answer).toBe(fmt(want));
      expect(q.answer).toBe(fmt(coordsAnswer.corner(a, b, c)));
      expect(b.x * a.x < 0 || c.y * a.y < 0, 'straddles an axis').toBe(true);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      const swapped = fmt({ x: want.y, y: want.x });
      if (swapped !== q.answer) expect(q.options).toContain(swapped);
    }
  });
});
