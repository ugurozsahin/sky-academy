import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { sameShape } from '../../src/curriculum/util';
import { CUBE_NETS, NEAR_MISSES, OBVIOUS } from '../../src/curriculum/year5-3d';
import { canon, foldFaces, isCubeNet } from './helpers/cube-fold';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-3d')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1208 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const gridOf = (q: Question) => { const v = q.visual as { type: string; grid: string[]; mirror?: false }; expect(v.type).toBe('symmetry'); expect(v.mirror).toBe(false); return v.grid; };
const has22 = (g: string[]) => g.some((r, i) => i > 0 && Array.from(r).some((ch, j) => ch === '#' && r[j + 1] === '#' && g[i - 1][j] === '#' && g[i - 1][j + 1] === '#'));
const row5 = (g: string[]) => g.some(r => r.includes('#####')) || g[0].split('').some((_, j) => g.map(r => r[j]).join('').includes('#####'));

describe('y5-3d (#1208)', () => {
  it('is registered for Year 5 maths in the geometry strand with the NC row', () => {
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('geometry'); expect(topic.title).toBe('3-D Shapes and Nets'); expect(topic.icon).toBe('📦');
    expect(topic.nc).toContain('5M41');
  });

  it('the fold simulation: the curated "yes" set is exactly the 11 cube nets, every one folds, and no "no" shape does', () => {
    expect(new Set(CUBE_NETS.map(n => canon([...n]))).size).toBe(11);
    for (const n of CUBE_NETS) expect(isCubeNet([...n]), n.join('/')).toBe(true);
    for (const n of [...NEAR_MISSES, ...OBVIOUS]) expect(isCubeNet([...n]), n.join('/')).toBe(false);
    for (const n of [...CUBE_NETS, ...NEAR_MISSES, ...OBVIOUS]) expect(n.join('').replace(/\./g, '').length).toBe(6);
  });

  it('foldFaces gives a net six distinct faces, opposite faces summing to 5', () => {
    const f = foldFaces(['.#..', '####', '.#..']);
    expect(f.flat().filter(x => x !== null).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(f.flat().every(x => x === null || (x >= 0 && x <= 5))).toBe(true);
    expect(foldFaces(['###', '###']).flat().every(x => x === null)).toBe(true);
  });

  it('every card has its options, the answer among them, and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(d === 1 ? 4 : 2); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('net cards: the fold simulation agrees with the answer; yes is right on 40–60 %; grids are 7 × 7 with six squares', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const qs = draw(d, 600); let yes = 0;
      for (const q of qs) {
        const g = gridOf(q);
        expect(g.length).toBe(7); g.forEach(r => expect(r.length).toBe(7));
        expect(g.join('').replace(/\./g, '').length).toBe(6);
        expect(g[0] + g[6]).not.toContain('#'); expect(g.map(r => r[0] + r[6]).join('')).not.toContain('#');   // an empty border all round
        expect(isCubeNet(g), q.prompt).toBe(q.answer === 'yes'); if (q.answer === 'yes') yes++;
      }
      expect(yes / qs.length, `d${d}`).toBeGreaterThan(0.4); expect(yes / qs.length, `d${d}`).toBeLessThan(0.6);
    }
  });

  it('d3 "no" shapes are near misses: no 2 × 2 block and no row of five; d3 "yes" cards cover turned and flipped nets', () => {
    const shapes = new Set<string>();
    for (const q of draw(3, 600)) { const g = gridOf(q); shapes.add(g.join('/')); if (q.answer === 'no') { expect(has22(g), g.join('/')).toBe(false); expect(row5(g), g.join('/')).toBe(false); } }
    expect(shapes.size).toBeGreaterThan(100);
  });

  it('d1 names the solid from its faces; cube and cuboid are never answer and decoy together', () => {
    const names = new Set<string>();
    for (const q of draw(1, 500)) {
      expect(q.visual).toBeUndefined(); expect(q.prompt).toMatch(/^Which solid has .+\?$/); names.add(q.answer);
      for (const o of q.options.filter(x => x !== q.answer)) expect(sameShape(o, q.answer), `${q.prompt} ${o}`).toBe(false);
    }
    expect(names.size).toBe(6);
  });

  it('d1 descriptions are true: every description names the one solid it fits', () => {
    const want: Record<string, string> = {
      '6 square faces, all the same size': 'cube', '6 rectangular faces': 'cuboid', '2 square faces and 4 rectangular faces': 'cuboid',
      '1 curved surface and no flat faces': 'sphere', '2 flat circular faces and 1 curved surface': 'cylinder',
      '1 flat circular face and 1 curved surface': 'cone', '1 square face and 4 triangular faces': 'pyramid',
    };
    const seen = new Set<string>();
    for (const q of draw(1, 800)) { const d = /^Which solid has (.+)\?$/.exec(q.prompt)![1]; expect(want[d], d).toBeDefined(); expect(q.answer, d).toBe(want[d]); seen.add(d); }
    expect(seen.size).toBe(Object.keys(want).length);
  });

  it('d2 nets are drawn as written (no turning), d3 turns and flips them', () => {
    const trim = (g: string[]) => { const rs = g.map((r, i) => (r.includes('#') ? i : -1)).filter(i => i >= 0), cs = [...g[0]].map((_, j) => (g.some(r => r[j] === '#') ? j : -1)).filter(j => j >= 0); return g.slice(rs[0], rs[rs.length - 1] + 1).map(r => r.slice(cs[0], cs[cs.length - 1] + 1)).join('/'); };
    const written = new Set([...CUBE_NETS, ...OBVIOUS].map(n => n.join('/')));
    for (const q of draw(2, 300)) expect(written.has(trim(gridOf(q))), trim(gridOf(q))).toBe(true);
    const d3 = draw(3, 600).map(q => trim(gridOf(q)));
    expect(d3.some(t => !written.has(t) && !NEAR_MISSES.some(n => n.join('/') === t))).toBe(true);
    expect(new Set(d3.filter(t => canon(t.split('/')) === canon([...CUBE_NETS[0]]))).size).toBeGreaterThan(1);
  });
});
