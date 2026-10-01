import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-fracof')!;
const DRAWS = 400;
const draws = (d: Difficulty) => { const r = rng(1092 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
/** Independent oracle: read the card from its prompt alone. */
function parse(prompt: string) {
  const f = prompt.match(/^(\d+)\/(\d+) of (\d+) = \?$/);
  if (f) { const [num, den, whole] = f.slice(1).map(Number); return { num, den, whole, answer: whole / den * num }; }
  const r = prompt.match(/^1\/(\d+) of a number is (\d+)\. What is the number\?$/)!;
  expect(r, prompt).toBeTruthy();
  return { num: 1, den: Number(r[1]), whole: Number(r[2]) * Number(r[1]), answer: Number(r[2]) * Number(r[1]), reverse: true };
}

describe('y3-fracof (#1092)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-fracof')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('every answer matches the oracle, is whole, and sits once among four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const p = parse(c.prompt);
      expect(Number.isInteger(p.answer), c.prompt).toBe(true);
      expect(p.num, c.prompt).toBeLessThan(p.den);
      expect((c.say ?? '').length, c.prompt).toBeGreaterThan(0);
      expect(Number(c.answer), c.prompt).toBe(p.answer);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      for (const o of c.options) expect(Number(o) >= 0, c.prompt).toBe(true);
    }
  });

  it('uses only denominators 2, 3, 4, 5, 6, 8, 10; d1 is unit fractions of 4–12 with 2–5', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const p = parse(c.prompt);
      expect([2, 3, 4, 5, 6, 8, 10]).toContain(p.den);
      if (d === 1) { expect(p.num, c.prompt).toBe(1); expect(p.den, c.prompt).toBeLessThanOrEqual(5); expect(p.whole).toBeGreaterThanOrEqual(4); expect(p.whole).toBeLessThanOrEqual(12); }
    }
  });

  it('only d1 carries an objects visual, whose n is the whole', () => {
    for (const c of draws(1)) { expect(c.visual).toMatchObject({ type: 'objects', n: parse(c.prompt).whole }); }
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d)) expect(c.visual, c.prompt).toBeUndefined();
  });

  it('d2 and d3 draw non-unit fractions and denominators beyond 5', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const cards = draws(d).map(c => parse(c.prompt));
      expect(cards.some(c => !c.reverse && c.num > 1), `d${d} non-unit`).toBe(true);
      expect(cards.some(c => c.den > 5), `d${d} denominators beyond 5`).toBe(true);
    }
  });

  it('d3 asks for the whole from a part on some cards, and non-unit fractions on others', () => {
    const cards = draws(3).map(c => parse(c.prompt));
    expect(cards.some(c => c.reverse)).toBe(true);
    expect(cards.some(c => !c.reverse && c.num > 1)).toBe(true);
  });

  it('every non-unit card offers the unit-fraction decoy', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d)) {
      const p = parse(c.prompt);
      if (p.reverse || p.num === 1) continue;
      expect(c.options, c.prompt).toContain(String(p.whole / p.den));
    }
  });

  it('every card has a say with no raw fraction', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(c.say, c.prompt).not.toMatch(/\d\/\d|\?/);
  });

  it('decoys leak neither the units nor the leading digit more than 30% of the time', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units, `d${d}`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
