import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-factors')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1185 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Whether `x` is what the card asks to slice, re-derived from the prompt alone. */
function isTarget(prompt: string, x: number): boolean {
  let m: RegExpMatchArray | null;
  if ((m = prompt.match(/^Slice every factor of (\d+)$/))) return Number(m[1]) % x === 0;
  if ((m = prompt.match(/^Slice every multiple of (\d+)$/))) return x % Number(m[1]) === 0;
  if ((m = prompt.match(/^Slice every common factor of (\d+) and (\d+)$/))) return Number(m[1]) % x === 0 && Number(m[2]) % x === 0;
  throw new Error(`no oracle for ${prompt}`);
}

describe('y5-factors (#1185)', () => {
  it('is registered for Year 5 maths and draws a sequence from d2', () => {
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.sequenceFrom).toBe(2);
  });

  it('d1 is a four-option factor-pair partner: answer × factor = n, n ≤ 72, factor 2–12', () => {
    for (const q of draw(1)) {
      const m = q.prompt.match(/^(\d+) = (\d+) × \?$/)!;
      expect(m, q.prompt).not.toBeNull();
      const n = Number(m[1]), f = Number(m[2]);
      expect(n).toBeLessThanOrEqual(72); expect(f).toBeGreaterThanOrEqual(2); expect(f).toBeLessThanOrEqual(12);
      expect(Number(q.answer) * f).toBe(n);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.anyOrder).toBeUndefined();
    }
  });

  it('d1 offers the subtracted slip n − f, and the factor itself unless the leak rule swaps it', () => {
    let cards = 0;
    for (const q of draw(1)) {
      const m = q.prompt.match(/^(\d+) = (\d+) × \?$/)!, n = Number(m[1]), f = Number(m[2]);
      cards++; expect(q.options).toContain(String(n - f));
      if (n / f < 20) expect(q.options).toContain(String(f)); // a big answer may swap its last decoy for answer ± 10 (#1058)
    }
    expect(cards).toBe(2000);
  });

  it('d2 and d3 are any-order cards: six numbers, 2–4 targets, and the oracle holds on every target and decoy', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.anyOrder, q.prompt).toBe(true);
      expect(q.options).toHaveLength(6); expect(new Set(q.options).size).toBe(6);
      const targets = q.sequence!;
      expect(targets.length).toBeGreaterThanOrEqual(2); expect(targets.length).toBeLessThanOrEqual(4);
      for (const o of q.options) expect(isTarget(q.prompt, Number(o)), `${q.prompt} ${o}`).toBe(targets.includes(o));
    }
  });

  it('d2 mixes factor and multiple cards within their ranges', () => {
    const seen = { factor: 0, multiple: 0 };
    for (const q of draw(2)) {
      const nums = q.options.map(Number), n = Number(q.prompt.match(/(\d+)$/)![1]);
      if (q.prompt.includes('factor')) { seen.factor++; expect(n).toBeLessThanOrEqual(48); expect(Math.max(...nums)).toBeLessThanOrEqual(48); }
      else { seen.multiple++; expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(12); expect(Math.max(...nums)).toBeLessThanOrEqual(100); }
    }
    expect(seen.factor).toBeGreaterThan(500); expect(seen.multiple).toBeGreaterThan(500);
  });

  it('every d3 common-factor card has both numbers ≤ 60 and a decoy that divides exactly one of them', () => {
    for (const q of draw(3)) {
      const [a, b] = q.prompt.match(/\d+/g)!.map(Number);
      expect(a).toBeLessThanOrEqual(60); expect(b).toBeLessThanOrEqual(60);
      const oneSided = q.options.filter(o => !q.sequence!.includes(o)).some(o => (a % Number(o) === 0) !== (b % Number(o) === 0));
      expect(oneSided, q.prompt).toBe(true);
    }
  });

  it('say never carries a raw symbol, and every bubble label is plain digits', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.say ?? '').not.toMatch(/[×=]/);
      for (const o of q.options) expect(o).toMatch(/^\d+$/);
    }
  });

  it('d1 leak limit: at most 30% of in-scope cards have a last digit no decoy shares', () => {
    expect(leakShares(topic.gen, 1, 2000, { skipLeading: true }).units).toBeLessThanOrEqual(0.3);
  });
});
