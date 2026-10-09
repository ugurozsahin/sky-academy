import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { areaOf, edgeWalk, halfArea } from './helpers/grid-measure';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-area')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1205 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const gridOf = (q: Question) => { const v = q.visual as { type: string; grid: string[]; mirror?: false } | undefined; if (!v) return undefined; expect(v.type).toBe('symmetry'); expect(v.mirror).toBe(false); return v.grid; };
const isArea = (q: Question) => /Area/.test(q.prompt);
const swapped = (q: Question, other: number) => other === Number(q.answer) || q.options.includes(String(other));

describe('y5-area (#1205)', () => {
  it('is registered for Year 5 maths in the measure strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); });

  it('every card has four distinct bare-number options including the answer, and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      q.options.forEach(o => expect(o).toMatch(/^\d+$/));
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1: rectangle area from the grid or from sides 2–12, and the perimeter is a decoy', () => {
    let grids = 0, texts = 0;
    for (const q of draw(1)) {
      const g = gridOf(q);
      if (g) { grids++; expect(g.length).toBeLessThanOrEqual(14); expect(g[0].length).toBeLessThanOrEqual(14); expect(q.prompt).toBe(`Each square is 1 cm². ${g[0].length} squares wide. Area = ? cm²`); expect(q.answer).toBe(String(areaOf(g))); expect(g.join('')).not.toMatch(/[h.]/); if (edgeWalk(g) !== areaOf(g)) expect(q.options).toContain(String(edgeWalk(g))); }
      else {
        texts++; const m = /^(\d+) cm by (\d+) cm\. Area = \? cm²$/.exec(q.prompt)!; expect(m, q.prompt).not.toBeNull();
        const [l, w] = [Number(m[1]), Number(m[2])]; expect(Math.min(l, w)).toBeGreaterThanOrEqual(2); expect(Math.max(l, w)).toBeLessThanOrEqual(12);
        expect(q.answer).toBe(String(l * w)); expect(q.options).toContain(String(2 * (l + w)));
      }
    }
    expect(grids).toBeGreaterThan(100); expect(texts).toBeGreaterThan(100);
  });

  it('d2: composite perimeter equals the edge walk and offers the area; metre cards use area m² or perimeter m', () => {
    let comp = 0, areaM = 0, perimM = 0;
    for (const q of draw(2, 600)) {
      const g = gridOf(q);
      if (g) {
        comp++; expect(q.prompt).toBe('Each side is 1 cm. Perimeter = ? cm');
        expect(g.length).toBeLessThanOrEqual(14); expect(g[0].length).toBeLessThanOrEqual(14);
        expect(g.join('').split('#').length - 1).toBeLessThanOrEqual(20); expect(g.join('')).not.toMatch(/h/);
        expect(q.answer).toBe(String(edgeWalk(g))); expect(swapped(q, areaOf(g))).toBe(true);
        continue;
      }
      const m = /^(\d+) m by (\d+) m\. (Area = \? m²|Perimeter = \? m)$/.exec(q.prompt)!; expect(m, q.prompt).not.toBeNull();
      const [l, w] = [Number(m[1]), Number(m[2])];
      if (m[3].startsWith('Area')) { areaM++; expect(q.answer).toBe(String(l * w)); expect(q.options).toContain(String(2 * (l + w))); }
      else { perimM++; expect(q.answer).toBe(String(2 * (l + w))); expect(q.options).toContain(String(l * w)); }
    }
    expect(comp).toBeGreaterThan(250); expect(areaM).toBeGreaterThan(60); expect(perimM).toBeGreaterThan(60);
  });

  it('d3: half-square estimates count each half as ½ with an even number of halves; corner cuts take the cut away', () => {
    let est = 0, cut = 0;
    for (const q of draw(3, 600)) {
      const g = gridOf(q);
      if (g) {
        est++; expect(q.prompt).toBe('Count half squares as ½. Area is about ? cm²');
        const halves = g.join('').split('h').length - 1; expect(halves).toBeGreaterThan(0); expect(halves % 2).toBe(0);
        expect(halfArea(g) % 2).toBe(0); expect(q.answer).toBe(String(halfArea(g) / 2));
        expect(q.options).toContain(String(halfArea(g) / 2 + halves / 2)); // halves counted as whole squares
        expect(g.length).toBeLessThanOrEqual(14); expect(g[0].length).toBeLessThanOrEqual(14);
        continue;
      }
      cut++; expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      const m = /^(\d+) × (\d+) cm rectangle, (\d+) × (\d+) cm corner cut off\. Area = \? cm²$/.exec(q.prompt)!; expect(m, q.prompt).not.toBeNull();
      const [l, w, a, b] = m.slice(1).map(Number);
      expect(Math.min(l, w)).toBeGreaterThanOrEqual(4); expect(Math.max(l, w)).toBeLessThanOrEqual(12); expect(a).toBeLessThanOrEqual(3); expect(b).toBeLessThanOrEqual(3);
      expect(q.answer).toBe(String(l * w - a * b)); expect(q.options).toContain(String(l * w));
    }
    expect(est).toBeGreaterThan(250); expect(cut).toBeGreaterThan(150);
  });

  it('the area/perimeter swap is a decoy on every card where the two values differ', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const g = gridOf(q);
      if (g && d === 3) continue;
      if (g) { const other = isArea(q) ? edgeWalk(g) : areaOf(g); expect(swapped(q, other), q.prompt).toBe(true); continue; }
      const nums = (q.prompt.match(/\d+/g) ?? []).map(Number);
      const [l, w] = nums; const area = d === 3 ? l * w - nums[2] * nums[3] : l * w, per = 2 * (l + w);
      if (d === 3) { expect(q.options, q.prompt).toContain(String(per)); continue; }
      expect(swapped(q, isArea(q) ? per : area), q.prompt).toBe(true);
    }
  });

  it('leak limit: at most 30% of in-scope cards have an answer whose last or leading digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); if (s.counted < 100) continue; expect(s.units / s.counted, `d${d} last`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
