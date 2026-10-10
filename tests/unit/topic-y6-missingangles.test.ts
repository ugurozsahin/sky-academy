import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, GeoPart, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-missingangles')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1247 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
type Arc = Extract<GeoPart, { kind: 'angle' }>;
const parts = (q: Question) => { const v = q.visual; if (v?.type !== 'geometry') throw new Error('no drawing'); return v.parts; };
const arcs = (q: Question) => parts(q).filter((p): p is Arc => p.kind === 'angle');
const mod = (v: number) => ((v % 360) + 360) % 360;
const sumOf = (a: number[]) => a.reduce((s, v) => s + v, 0);

describe('y6-missingangles (#1247)', () => {
  it('is registered for Year 6 maths in the geometry strand', () => { expect(topic.year).toBe('year6'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('geometry'); });

  it('every card has four distinct options including the answer, a speakable say, and an answer in (0°, 360°) unless it is an angle sum', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      q.options.forEach(o => expect(o).toMatch(/^[\d,]+°$/));
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      if (!/add up to/.test(q.prompt)) q.options.forEach(o => { expect(num(o)).toBeGreaterThan(0); expect(num(o)).toBeLessThan(360); });
    }
  });

  it('d1: the answer follows the angle facts recomputed from the drawing, and every arc sweep is its stated value', () => {
    const kinds = { opposite: 0, line: 0, point: 0 };
    for (const q of draw(1, 600)) {
      const a = arcs(q), unk = a.filter(p => p.label === '?'), known = a.filter(p => p.label !== '?');
      expect(unk).toHaveLength(1);
      known.forEach(p => { expect(p.label).toBe(`${p.deg}°`); expect(p.deg % 5).toBe(0); });
      q.options.forEach(o => expect(num(o) % 5).toBe(0));
      if (/cross/.test(q.prompt) || /straight line/.test(q.prompt)) {
        expect(a).toHaveLength(2);
        const segs = parts(q).filter((p): p is Extract<GeoPart, { kind: 'segment' }> => p.kind === 'segment');
        expect(segs).toHaveLength(2);
        const dirs = segs.map(s => mod(Math.round(Math.atan2(s.a[1] - s.b[1], s.b[0] - s.a[0]) * 180 / Math.PI)));
        const lineDirs = dirs.map(v => v % 180);
        // each arc's two rays lie along the drawn lines
        a.forEach(p => { expect(lineDirs).toContain(mod(p.dir) % 180); expect(lineDirs).toContain(mod(p.dir + p.deg) % 180); });
        const opposite = mod(unk[0].dir - known[0].dir) === 180;
        expect(/cross/.test(q.prompt)).toBe(opposite);
        opposite ? kinds.opposite++ : kinds.line++;
        expect(q.answer).toBe(`${opposite ? known[0].deg : 180 - known[0].deg}°`);
        // the named slip: supplement for an opposite angle, the equal angle for an adjacent one
        expect(q.options.map(num)).toContain(opposite ? 180 - known[0].deg : known[0].deg);
      } else {
        kinds.point++;
        expect(a).toHaveLength(3); expect(sumOf(a.map(p => p.deg))).toBe(360);
        a.forEach((p, i) => { if (i) expect(p.dir).toBe(mod(a[i - 1].dir + a[i - 1].deg)); });
        expect(q.answer).toBe(`${360 - sumOf(known.map(p => p.deg))}°`);
      }
    }
    Object.values(kinds).forEach(n => expect(n).toBeGreaterThan(120));
  });

  it('d2 and d3 draw nothing', () => { for (const d of [2, 3] as Difficulty[]) draw(d).forEach(q => expect(q.visual, q.prompt).toBeUndefined()); });

  it('d2: triangle, isosceles and quadrilateral answers recompute, with the wrong-total decoy on every card', () => {
    const kinds = { tri: 0, iso: 0, quad: 0 };
    for (const q of draw(2, 600)) {
      const n = nums(q.prompt), ans = num(q.answer), opts = q.options.map(num);
      if (q.prompt.startsWith('Triangle')) {
        kinds.tri++; const s = n[0] + n[1]; expect(ans).toBe(180 - s);
        if (360 - s > 0 && 360 - s !== ans) expect(opts).toContain(360 - s);
      } else if (q.prompt.startsWith('Isosceles')) {
        kinds.iso++; expect(ans * 2 + n[0]).toBe(180); expect(opts).toContain(180 - n[0]);
      } else if (q.prompt.startsWith('Quadrilateral')) {
        kinds.quad++; const s = n[0] + n[1] + n[2]; expect(ans).toBe(360 - s);
        const wrong = Math.abs(180 - s); if (wrong > 0 && wrong !== ans) expect(opts).toContain(wrong);
      } else throw new Error(`unexpected prompt ${q.prompt}`);
    }
    Object.values(kinds).forEach(n => expect(n).toBeGreaterThan(120));
  });

  it('d3: polygon answers recompute, with the exterior-angle decoy on every regular-polygon card', () => {
    const sides: Record<string, number> = { pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10, dodecagon: 12 };
    const kinds = { each: 0, sum: 0, fifth: 0 }; const seen = new Set<number>();
    for (const q of draw(3, 600)) {
      const n = nums(q.prompt), ans = num(q.answer), opts = q.options.map(num);
      let m: RegExpExecArray | null;
      if ((m = /^Each angle of a regular (\w+) = \?°$/.exec(q.prompt))) {
        kinds.each++; const k = sides[m[1]]; seen.add(k); expect(ans).toBe(180 * (k - 2) / k); expect(opts).toContain(360 / k);
      } else if ((m = /^The angles in a (\w+) add up to \?°$/.exec(q.prompt))) {
        kinds.sum++; expect(ans).toBe((sides[m[1]] - 2) * 180); expect(opts).toContain(sides[m[1]] * 180);
      } else if (q.prompt.startsWith('Pentagon')) {
        kinds.fifth++; expect(n).toHaveLength(4); expect(ans).toBe(540 - sumOf(n)); expect(ans).toBeGreaterThan(0); expect(ans).toBeLessThan(360);
      } else throw new Error(`unexpected prompt ${q.prompt}`);
    }
    Object.values(kinds).forEach(n => expect(n).toBeGreaterThan(80)); expect(seen.size).toBe(6);
  });

  it('decoys do not give the answer away by its last or leading digit (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.counted).toBeGreaterThan(0); expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3); }
  });
});
