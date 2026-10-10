import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, GeoPart } from '../../src/curriculum';
import { angleKind, estimate } from '../../src/curriculum/year5-angles';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-angles')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1209 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const degOf = (q: ReturnType<typeof draw>[number]) => {
  const v = q.visual; if (v?.type !== 'geometry') throw new Error('no drawing');
  const a = v.parts.filter((p): p is Extract<GeoPart, { kind: 'angle' }> => p.kind === 'angle'); expect(a).toHaveLength(1); return a[0].deg;
};
const margin = (deg: number) => Math.min(...[90, 180, 270].map(m => Math.abs(deg - m)));

describe('y5-angles (#1209)', () => {
  it('is registered for Year 5 maths', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); });

  it('d1: the class matches the drawn deg; right angles are 10–20 %, reflex at least 25 %; every class appears', () => {
    const qs = draw(1, 600), counts: Record<string, number> = {};
    for (const q of qs) {
      const deg = degOf(q); counts[q.answer] = (counts[q.answer] ?? 0) + 1;
      expect(q.answer).toBe(angleKind(deg)); expect(deg % 5).toBe(0);
      if (deg !== 90) expect(margin(deg)).toBeGreaterThanOrEqual(15);
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
    }
    expect(counts.Right / 600).toBeGreaterThanOrEqual(0.1); expect(counts.Right / 600).toBeLessThanOrEqual(0.2);
    expect(counts.Reflex / 600).toBeGreaterThanOrEqual(0.25);
    expect(counts.Acute).toBeGreaterThan(0); expect(counts.Obtuse).toBeGreaterThan(0);
  });

  it('d2: the estimate is deg to the nearest 10°, options 40° apart, margins kept, reflex drawn', () => {
    let reflex = 0;
    for (const q of draw(2, 600)) {
      const deg = degOf(q), e = estimate(deg);
      expect(q.answer).toBe(`${e}°`); expect(margin(deg)).toBeGreaterThanOrEqual(15); expect(deg % 5).toBe(0);
      if (deg > 180) reflex++;
      const v = q.options.map(o => Number(o.replace('°', '')));
      expect(new Set(v).size).toBe(4);
      for (const a of v) { expect(a).toBeGreaterThanOrEqual(10); expect(a).toBeLessThanOrEqual(350); for (const b of v) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(40); }
    }
    expect(reflex).toBeGreaterThan(0);
  });

  it('estimate rounds a 5 up', () => { expect(estimate(185)).toBe(190); expect(estimate(204)).toBe(200); expect(estimate(35)).toBe(40); });

  it('d3: the keyed angle is the only one of the asked class; no drawing', () => {
    for (const q of draw(3, 600)) {
      const want = q.prompt.match(/^Which angle is (\w+)\?$/)![1], vals = q.options.map(o => Number(o.replace('°', '')));
      expect(q.visual).toBeUndefined();
      const hits = vals.filter(v => angleKind(v).toLowerCase() === want);
      expect(hits).toEqual([Number(q.answer.replace('°', ''))]);
      for (const v of vals) if (v !== 90) expect(margin(v)).toBeGreaterThanOrEqual(15);
    }
  });

  it('d2 last-digit leak share is at most 0.30 (#1058)', () => {
    expect(leakShares(topic.gen, 2, 2000, { skipLeading: true }).units).toBeLessThanOrEqual(0.3);
  });
});
