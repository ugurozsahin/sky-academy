import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type GeoPart } from '../../src/curriculum';
import { angleAnswer, angleClass, orderOf } from '../../src/curriculum/year4-angles';
import { geometrySVG, rayEnds, RAY } from '../../src/ui/vis-geometry';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y4-angles')!;
type Angle = Extract<GeoPart, { kind: 'angle' }>;
const angles = (q: ReturnType<typeof t.gen>) => (q.visual as { parts: Angle[] }).parts;
const sorted = (a: number[]) => a.slice().sort((x, y) => x - y);

describe('y4-angles (#1153)', () => {
  it('is a Year 4 maths geometry topic, a sequence from d3', () => {
    expect(t).toMatchObject({ year: 'year4', subject: 'maths', title: 'Acute and Obtuse Angles', sequenceFrom: 3, strand: 'geometry' });
  });

  it('no angle lies in 75–105° except exactly 90°, and the rendered arms span `deg`', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1153 + d);
      for (let i = 0; i < 300; i++) for (const a of angles(t.gen(d, r))) {
        expect(a.deg === 90 || a.deg < 75 || a.deg > 105).toBe(true);
        const [e1, e2] = rayEnds(a);
        const ang = (e: [number, number]) => Math.atan2(-(e[1] - a.at[1]), e[0] - a.at[0]) * 180 / Math.PI;
        expect((((ang(e2) - ang(e1)) % 360) + 360) % 360).toBeCloseTo(a.deg % 360, 5);
        expect(Math.hypot(e1[0] - a.at[0], e1[1] - a.at[1])).toBeCloseTo(a.len ?? RAY, 5);
        expect(a.dir % 15).toBe(0);
      }
    }
  });

  it('d1: the answer is the class of the drawn angle, from all three words', () => {
    const r = rng(11), seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const q = t.gen(1, r), [a] = angles(q);
      expect(angles(q)).toHaveLength(1);
      expect(q.answer).toBe(angleClass(a.deg));
      expect(q.options.slice().sort()).toEqual(['Acute', 'Obtuse', 'Right']);
      seen.add(q.answer);
    }
    expect(seen.size).toBe(3);
  });

  it('d2: exactly one angle satisfies the question, sizes 20° apart, each letter answers 25–42%', () => {
    const r = rng(22), count: Record<string, number> = { A: 0, B: 0, C: 0 };
    const asks = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      const q = t.gen(2, r), parts = angles(q);
      const ask = q.prompt === 'Which is the largest angle?' ? 'largest' : q.prompt === 'Which angle is obtuse?' ? 'obtuse' : 'acute';
      asks.add(ask);
      expect(angleAnswer(parts, ask)).toEqual([q.answer]);
      const s = sorted(parts.map(a => a.deg));
      expect(s[1] - s[0]).toBeGreaterThanOrEqual(20);
      expect(s[2] - s[1]).toBeGreaterThanOrEqual(20);
      expect(Math.max(...s)).toBeLessThan(180);
      expect(q.options.slice().sort()).toEqual(['A', 'B', 'C']);
      count[q.answer]++;
    }
    expect(asks.size).toBe(3);
    for (const k of 'ABC') { expect(count[k] / 1500).toBeGreaterThan(0.25); expect(count[k] / 1500).toBeLessThan(0.42); }
  });

  it('d3: a letter sequence smallest to largest, sizes 20° apart, 180° appears, smallest has the longest arms on 40–60%', () => {
    const r = rng(33);
    let trap = 0, straight = 0;
    for (let i = 0; i < 1000; i++) {
      const q = t.gen(3, r), parts = angles(q), order = orderOf(parts);
      expect(q.sequence).toEqual(order);
      expect(q.answer).toBe(order.join(','));
      expect(q.options.slice().sort()).toEqual(['A', 'B', 'C']);
      const s = sorted(parts.map(a => a.deg));
      expect(s[1] - s[0]).toBeGreaterThanOrEqual(20);
      expect(s[2] - s[1]).toBeGreaterThanOrEqual(20);
      if (s[2] === 180) straight++;
      const small = parts.find(a => a.label === order[0])!;
      if (small.len === Math.max(...parts.map(a => a.len!))) trap++;
    }
    expect(trap / 1000).toBeGreaterThan(0.4);
    expect(trap / 1000).toBeLessThan(0.6);
    expect(straight).toBeGreaterThan(0);
  });

  it('an angle part without `len` renders as it did before (y3-angles unchanged)', () => {
    const a: Angle = { kind: 'angle', at: [50, 38], dir: 30, deg: 60, label: 'A' };
    const same = geometrySVG({ type: 'geometry', parts: [a] });
    expect(same).toBe(geometrySVG({ type: 'geometry', parts: [{ ...a, len: RAY }] }));
    expect(geometrySVG({ type: 'geometry', parts: [{ ...a, len: 10 }] })).not.toBe(same);
  });
});
