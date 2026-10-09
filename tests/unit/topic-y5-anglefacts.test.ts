import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, GeoPart, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-anglefacts')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1210 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const angles = (q: Question) => { const v = q.visual; if (v?.type !== 'geometry') throw new Error('no drawing'); return v.parts.filter((p): p is Extract<GeoPart, { kind: 'angle' }> => p.kind === 'angle'); };

describe('y5-anglefacts (#1210)', () => {
  it('is registered for Year 5 maths in the geometry strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('geometry'); });

  it('every card has four distinct options including the answer, every angle a multiple of 5, and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      if (q.answer.endsWith('°')) q.options.forEach(o => { expect(o).toMatch(/^\d+°$/); expect(num(o) % 5).toBe(0); });
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1: turns and right angles come to the right degrees', () => {
    const facts: Record<string, number> = { 'A quarter turn': 90, 'A half turn': 180, 'A three-quarter turn': 270, 'A whole turn': 360, 'A straight line': 180, '2 right angles': 180, '3 right angles': 270, '4 right angles': 360 };
    const seen = new Set<string>();
    for (const q of draw(1)) { const m = /^(.*) = \?°$/.exec(q.prompt)!; expect(m, q.prompt).not.toBeNull(); seen.add(m[1]); expect(q.answer).toBe(`${facts[m[1]]}°`); }
    expect(seen.size).toBe(Object.keys(facts).length);
  });

  it('d2: the arcs add to 180 (line) or 360 (point), the "?" arc is the answer, and its sweep is its value', () => {
    let line = 0, point = 0;
    for (const q of draw(2, 500)) {
      const a = angles(q), total = /line/.test(q.prompt) ? 180 : 360;
      total === 180 ? line++ : point++;
      expect(a).toHaveLength(total === 180 ? 2 : 3); expect(a.reduce((s, p) => s + p.deg, 0)).toBe(total);
      const unk = a.filter(p => p.label === '?'); expect(unk).toHaveLength(1);
      expect(q.answer).toBe(`${unk[0].deg}°`);
      a.filter(p => p.label !== '?').forEach(p => expect(p.label).toBe(`${p.deg}°`));
      a.forEach((p, i) => { expect(p.deg % 5).toBe(0); expect(p.deg).toBeGreaterThanOrEqual(30); if (i > 0) expect(p.dir).toBe(a[i - 1].dir + a[i - 1].deg); });
      const known = a.filter(p => p.label !== '?').reduce((s, p) => s + p.deg, 0);
      expect(q.options.map(num)).toContain(total === 180 ? 360 - a.find(p => p.label !== '?')!.deg : (Math.abs(180 - known) || known));
    }
    expect(line).toBeGreaterThan(150); expect(point).toBeGreaterThan(150);
  });

  it('d3: rectangle cards recompute, prompts are at most 60 characters, all three types appear', () => {
    const kinds = { width: 0, corner: 0, side: 0 };
    for (const q of draw(3, 600)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      let m: RegExpExecArray | null;
      if ((m = /^Rectangle: (\d+) cm long, perimeter (\d+) cm\. Width = \? cm$/.exec(q.prompt))) { kinds.width++; expect(q.answer).toBe(String(Number(m[2]) / 2 - Number(m[1]))); expect(q.options).toContain(String(Number(m[2]) - Number(m[1]))); }
      else if ((m = /^Diagonal splits a rectangle's corner: (\d+)° and \?°$/.exec(q.prompt))) { kinds.corner++; expect(q.answer).toBe(`${90 - Number(m[1])}°`); }
      else if ((m = /^Rectangle: one side (\d+) cm\. Opposite side = \? cm$/.exec(q.prompt))) { kinds.side++; expect(q.answer).toBe(m[1]); }
      else throw new Error(`unexpected prompt ${q.prompt}`);
    }
    Object.values(kinds).forEach(n => expect(n).toBeGreaterThan(100));
  });

  it('decoys do not give the answer away by its last or leading digit (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); if (s.counted > 0) { expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3); } }
  });
});
