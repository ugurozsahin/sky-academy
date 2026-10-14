import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { renderVisual } from '../../src/ui/visuals';

// Deterministic RNG (mulberry32), same construction `topic-y3-compare.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-line')!;
const DRAWS = 300;
const num = (label: string) => parseNum(label)!.v;
const draws = (d: Difficulty) => { const r = rng(1082_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const GAP: Record<Difficulty, number> = { 1: 300, 2: 200, 3: 20 };
const OPTIONS: Record<Difficulty, number> = { 1: 3, 2: 4, 3: 4 };

describe('y3-line (#1082)', () => {
  it('is registered once, in Year 3 maths', () => {
    expect(TOPICS.filter(t => t.id === 'y3-line')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('maths');
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the answer is the mark, decoys keep their gaps and none is an end`, () => {
      for (const q of draws(d)) {
        const v = q.visual;
        if (v?.type !== 'numberline') throw new Error('not a number line');
        expect(q.answer, q.prompt).toBe(q.options.find(o => num(o) === v.mark));
        expect(num(q.answer)).toBe(v.mark);
        expect(q.options).toHaveLength(OPTIONS[d]);
        expect(new Set(q.options).size).toBe(OPTIONS[d]);
        const vals = q.options.map(num);
        for (const x of vals) { expect(x).toBeGreaterThan(v.from); expect(x).toBeLessThan(v.to); }
        for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
          expect(Math.abs(vals[i] - vals[j]), `${vals}`).toBeGreaterThanOrEqual(GAP[d]);
        }
        expect(v.ends).toBe(true);
        expect(v.labels).toHaveLength(11);
        expect(v.to - v.from).toBe(d === 3 ? 100 : 1000);
        expect(v.step).toBe(d === 3 ? 10 : 100);
        if (d < 3) expect(v.from).toBe(0);
      }
    });
  }

  it('writes 1,000 with its comma in the prompt line, say and end label; the d1 line prints only 0 and 1,000', () => {
    for (const q of draws(1)) {
      expect(q.say).toBe('The line goes from 0 to 1,000. Which number is at the question mark?');
      const html = renderVisual(q.visual);
      const printed = [...html.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(m => m[1]).filter(Boolean);
      expect(printed).toHaveLength(3);
      expect(printed[0]).toBe('0');
      expect(printed).toContain('?');
      expect(printed[2]).toBe('1,000');
    }
  });

  it('d3 draws a 100-wide stretch inside 0-1,000 with both ends printed', () => {
    for (const q of draws(3)) {
      const v = q.visual as { from: number; to: number };
      expect(v.from % 100).toBe(0);
      const html = renderVisual(q.visual);
      expect((html.match(/<span/g) ?? []).length).toBe(11);
    }
  });
});
