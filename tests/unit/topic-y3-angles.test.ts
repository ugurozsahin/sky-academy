import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type GeoPart } from '../../src/curriculum';
import { geoAnswer, segDir, type GeoAsk } from '../../src/curriculum/year3-angles';
import { repeatKey } from '../../src/game/session';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y3-angles')!;
const ASKS: [string, GeoAsk][] = [
  ['Which angle is a right angle?', 'right'], ['Which angle is less than a right angle?', 'less'], ['Which angle is greater than a right angle?', 'greater'],
  ['Which line is horizontal?', 'horizontal'], ['Which line is vertical?', 'vertical'],
  ['Which pair of lines is parallel?', 'parallel'], ['Which pair of lines is perpendicular?', 'perpendicular'],
];
const parts = (q: ReturnType<typeof t.gen>) => (q.visual as { parts: GeoPart[] }).parts;

describe('y3-angles (#1075)', () => {
  it('is a Year 3 maths geometry topic with the plain title', () => {
    expect(t).toMatchObject({ year: 'year3', subject: 'maths', title: 'Right Angles and Lines', strand: 'geometry' });
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over 2,000 draws the answer equals the value computed from the drawn parts, with exactly one true option and no duplicates`, () => {
      const r = rng(1075 + d);
      for (let i = 0; i < 2000; i++) {
        const q = t.gen(d, r);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        const ask = ASKS.find(([p]) => p === q.prompt);
        if (!ask) {   // d1 only: a yes/no card or a turn fact
          if (q.prompt === 'Is this a right angle?') {
            expect(q.options.sort()).toEqual(['No', 'Yes']);
            expect(q.answer).toBe((parts(q)[0] as { deg: number }).deg === 90 ? 'Yes' : 'No');
          } else {
            const want = /half-turn/.test(q.prompt) ? 2 : /three-quarters/.test(q.prompt) ? 3 : 4;
            expect(q.prompt).toMatch(/^How many right angles make /);
            expect(q.answer).toBe(String(want));
            expect(q.options.slice().sort()).toEqual(['1', '2', '3', '4']);
          }
          expect(d).toBe(1);
          continue;
        }
        const truth = geoAnswer(parts(q), ask[1]);
        expect(truth, q.prompt).toEqual([q.answer]);
        expect(q.options.slice().sort()).toEqual(['A', 'B', 'C']);
      }
    });
  }

  it('d1 draws all of: right and wrong angles, and the three turn facts', () => {
    const r = rng(11); const seen = new Set<string>();
    for (let i = 0; i < 400; i++) { const q = t.gen(1, r); seen.add(q.prompt === 'Is this a right angle?' ? q.answer : q.prompt); }
    expect([...seen].sort()).toEqual(['No', 'Yes', 'How many right angles make a half-turn?', 'How many right angles make a whole turn?', 'How many right angles make three-quarters of a turn?'].sort());
  });

  it('d2 wrong letters are the named slips: the acute angle often sits square to the page while the right angle is mostly tilted', () => {
    const r = rng(22); let tiltedRight = 0, rights = 0, axisAcute = 0, acutes = 0;
    for (let i = 0; i < 1500; i++) {
      const q = t.gen(2, r);
      for (const p of parts(q)) {
        if (p.kind !== 'angle') continue;
        if (p.deg === 90) { rights++; if (p.dir % 90 !== 0) tiltedRight++; }
        if (p.deg < 90) { acutes++; if (p.dir % 90 === 0) axisAcute++; }
        expect(p.deg === 90 || (p.deg >= 30 && p.deg <= 65) || (p.deg >= 115 && p.deg <= 160)).toBe(true);
        expect(p.deg % 5).toBe(0);
      }
    }
    expect(tiltedRight / rights).toBeGreaterThan(0.6);
    expect(axisAcute / acutes).toBeGreaterThan(0.3);
  });

  it('d3 wrong letters are the named slips: slanted, the other axis, a perpendicular for a parallel, a parallel for a perpendicular, 15°+ off', () => {
    const r = rng(33); let levelCorrect = 0, corrects = 0;
    for (let i = 0; i < 1500; i++) {
      const q = t.gen(3, r), ps = parts(q).filter((p): p is Extract<GeoPart, { kind: 'segment' }> => p.kind === 'segment');
      const ask = ASKS.find(([p]) => p === q.prompt)![1];
      if (ask === 'horizontal' || ask === 'vertical') {
        const target = ask === 'horizontal' ? 0 : 90;
        for (const s of ps) if (s.label !== q.answer) expect(Math.min(Math.abs(segDir(s) - target), 180 - Math.abs(segDir(s) - target))).toBeGreaterThanOrEqual(14.5);
      } else {
        const gaps = [0, 2, 4].map(k => { const d = Math.abs(segDir(ps[k]) - segDir(ps[k + 1])); return Math.min(d, 180 - d); });
        const wrong = gaps.filter((_, k) => ps[2 * k].label !== q.answer);
        if (ask === 'parallel') { expect(wrong.every(g => g >= 19.5)).toBe(true); expect(wrong.some(g => Math.abs(g - 90) < 0.5)).toBe(true); }
        else { expect(wrong.some(g => g < 0.5)).toBe(true); expect(wrong.every(g => Math.abs(g - 90) >= 14.5)).toBe(true); }
        corrects++; if (segDir(ps[2 * ['A', 'B', 'C'].indexOf(q.answer)]) % 90 < 0.5) levelCorrect++;
      }
    }
    expect(levelCorrect / corrects).toBeLessThan(0.2);   // the right pair is not always square to the page
  });

  it('the options are letters, Yes/No or 1–4 — no unit digit to leak, so the #1058 limit cannot apply', () => {
    const r = rng(44);
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) for (const o of t.gen(d, r).options) expect(o).toMatch(/^(A|B|C|Yes|No|[1-4])$/);
  });

  it('the repeat key reads the geometry, not the labels', () => {
    const base = (deg: number, label: string): ReturnType<typeof t.gen> => ({ ...t.gen(2, rng(1)), visual: { type: 'geometry', parts: [{ kind: 'angle', at: [10, 10], dir: 10, deg, label }] } });
    expect(repeatKey(base(40, 'A'))).not.toBe(repeatKey(base(45, 'A')));
    expect(repeatKey(base(40, 'A'))).toBe(repeatKey(base(40, 'B')));
  });
});
