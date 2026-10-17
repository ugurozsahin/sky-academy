import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { SHAPES_3D, sameShape } from '../../src/curriculum/util';
import { SOLIDS } from '../../src/curriculum/year6-nets';
import { foldFaces } from './helpers/cube-fold';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-nets')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1246 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Written here, not imported, so the table is checked against an independent list (faces / edges / vertices, and the net's faces).
const LEX: Record<string, [number, number, number, string]> = {
  'triangular prism': [5, 9, 6, '2 triangles, 3 rectangles'], 'pentagonal prism': [7, 15, 10, '2 pentagons, 5 rectangles'], 'hexagonal prism': [8, 18, 12, '2 hexagons, 6 rectangles'],
  'triangular-based pyramid': [4, 6, 4, '4 triangles'], 'square-based pyramid': [5, 8, 5, '1 square, 4 triangles'], 'pentagonal-based pyramid': [6, 10, 6, '1 pentagon, 5 triangles'],
  cube: [6, 12, 8, '6 squares'], cuboid: [6, 12, 8, '6 rectangles'],
};
const grid = (q: Question) => (q.visual as { grid: string[] }).grid;

describe('y6-nets (#1246)', () => {
  it('is registered for Year 6 maths in the geometry strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'geometry', title: 'Nets of 3-D Shapes' }); });

  it('the solids table equals the literal list and satisfies Euler (F + V − E = 2)', () => {
    expect(SOLIDS.map(s => s.name).sort()).toEqual(Object.keys(LEX).sort());
    for (const s of SOLIDS) {
      expect([s.faces, s.edges, s.vertices, s.net], s.name).toEqual(LEX[s.name]);
      expect(s.faces + s.vertices - s.edges, s.name).toBe(2);
    }
  });

  it('the cube, cuboid and square-based pyramid agree with SHAPES_3D', () => {
    for (const [, , p] of SHAPES_3D.filter(x => x[2].as !== 'sphere' && x[2].as !== 'cylinder' && x[2].as !== 'cone')) {
      const s = SOLIDS.find(x => x.name === p.as)!;
      expect([s.faces, s.edges, s.vertices]).toEqual([p.flat, p.edges, p.vertices]);
    }
  });

  it('every card has a speakable say, and every prompt is at most 60 characters with the solid name on the card, not a bubble', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.say, q.prompt).toBeTruthy(); expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(q.options.length);
      expect(rLblProblem(q), q.prompt).toBeNull();
      for (const o of q.options) expect(Object.keys(LEX)).not.toContain(o);
    }
  });

  it('d1: the answer is the table count, four distinct numbers, and the other counts of the solid appear as decoys', () => {
    let slips = 0;
    for (const q of draw(1)) {
      const m = /^How many (faces|edges|vertices) does a (.+) have\?$/.exec(q.prompt)!, row = LEX[m[2]], prop = ['faces', 'edges', 'vertices'].indexOf(m[1]);
      expect(q.answer, q.prompt).toBe(String(row[prop]));
      expect(q.options).toHaveLength(4);
      for (const o of q.options) expect(Number(o)).toBeGreaterThanOrEqual(1);
      if (row.slice(0, 3).some((v, i) => i !== prop && v !== row[prop] && q.options.includes(String(v)))) slips++;
    }
    expect(slips).toBeGreaterThan(250);
  });

  it('d2: yes exactly when the net lists that solid\'s faces; yes is right on 40–60 %; no card never pairs cube with cuboid; most no cards share a face count', () => {
    let yes = 0, no = 0, alike = 0;
    for (const q of draw(2)) {
      const m = /^Net: (.+)\. A (.+)\?$/.exec(q.prompt)!, [net, asked] = [m[1], m[2]];
      expect(LEX[asked], q.prompt).toBeDefined();
      const shown = Object.keys(LEX).find(k => LEX[k][3] === net)!;
      expect(q.answer, q.prompt).toBe(LEX[asked][3] === net ? 'yes' : 'no');
      expect([...q.options].sort()).toEqual(['no', 'yes']);
      if (q.answer === 'yes') yes++; else { no++; expect(sameShape(shown, asked)).toBe(false); if (LEX[shown][0] === LEX[asked][0]) alike++; }
    }
    expect(yes / 300).toBeGreaterThanOrEqual(0.4); expect(yes / 300).toBeLessThanOrEqual(0.6);
    expect(alike / no).toBeGreaterThanOrEqual(0.5);
  });

  it('d3: the fold simulation agrees with every answer, the shaded squares are opposite, and no decoy is opposite the asked letter', () => {
    const askedSeen = new Set<string>();
    for (const q of draw(3)) {
      const g = grid(q), cols = g[0].length;
      expect(cols).toBeLessThanOrEqual(7);
      const asked = /opposite ([A-D])\?$/.exec(q.prompt)![1]; askedSeen.add(asked);
      const faces = foldFaces(g.map(r => r.replace(/[A-D]/g, '#')));
      const at = (ch: string) => { const out: number[] = []; g.forEach((row, r) => [...row].forEach((c, i) => { if (c === ch) out.push(faces[r][i]!); })); return out; };
      const shaded = at('#'); expect(shaded).toHaveLength(2); expect(shaded[0] + shaded[1]).toBe(5);
      for (const L of ['A', 'B', 'C', 'D']) expect(at(L)).toHaveLength(1);
      const [fa] = at(asked), right = ['A', 'B', 'C', 'D'].filter(L => at(L)[0] === 5 - fa);
      expect(right).toHaveLength(1); expect(q.answer).toBe(right[0]);
      expect(q.options).toHaveLength(3); expect(q.options).not.toContain(asked);
      expect(q.options.filter(o => at(o)[0] === 5 - fa)).toEqual([q.answer]);
      expect(q.say).toContain('shaded and lettered');
    }
    expect([...askedSeen].sort()).toEqual(['A', 'B', 'C', 'D']);
  });
});
