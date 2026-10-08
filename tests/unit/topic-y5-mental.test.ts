import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-mental')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1183 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const sign = (s: string) => (s === '+' ? 1 : -1);

/** Solve the card from its prompt alone: the oracle. */
function solve(prompt: string): number {
  let m = prompt.match(/^([\d,]+) ([+−]) ([\d,]+) = \?$/);
  if (m) return num(m[1]) + sign(m[2]) * num(m[3]);
  m = prompt.match(/^\? ([+−]) ([\d,]+) = ([\d,]+)$/);
  if (m) return num(m[3]) - sign(m[1]) * num(m[2]);
  m = prompt.match(/^([\d,]+) ([+−]) \? = ([\d,]+)$/);
  if (m) return sign(m[2]) * (num(m[3]) - num(m[1]));
  throw new Error(`unparsed: ${prompt}`);
}

describe('y5-mental (#1183)', () => {
  it('is registered for Year 5 in the calc strand', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year5', 'maths', 'calc']);
  });

  it('oracle: every answer is exact, in 0..999,999, with 4 distinct commas-formatted options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 2000)) {
      expect(num(q.answer)).toBe(solve(q.prompt));
      expect(num(q.answer)).toBeGreaterThanOrEqual(0); expect(num(q.answer)).toBeLessThanOrEqual(999999);
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(o).toMatch(/^\d{1,3}(,\d{3})*$/); expect(num(o)).toBeLessThanOrEqual(999999); });
    }
  });

  it('the ladder: d1 stays within 100,000, d2 multiples of 1,000 reaching past it, d3 has near multiples and missing numbers', () => {
    for (const q of draw(1, 400)) expect(q.prompt).toMatch(/^[\d,]+ [+−] [\d,]+ = \?$/);
    let big = 0;
    for (const q of draw(2, 400)) { const [, a, , b] = q.prompt.match(/^([\d,]+) ([+−]) ([\d,]+) = \?$/)!; expect(num(b) % 1000).toBe(0); if (num(a) > 100000 || num(q.answer) > 100000) big++; }
    expect(big).toBeGreaterThan(200);
    const d3 = draw(3, 600);
    expect(d3.filter(q => q.prompt.includes('?') && !q.prompt.endsWith('= ?')).length).toBeGreaterThan(80);
    expect(d3.filter(q => /(9,999|4,998|1,999|99,999|19,998|2,997) = \?$/.test(q.prompt)).length).toBeGreaterThan(200);
  });

  it('every d3 compensation card offers the off-by-one decoy (forgot to take the 1 back)', () => {
    let seen = 0;
    for (const q of draw(3, 800)) {
      const m = q.prompt.match(/^([\d,]+) ([+−]) ([\d,]+) = \?$/);
      if (!m) continue;
      const b = num(m[3]), diff = { 9999: 1, 4998: 2, 1999: 1, 99999: 1, 19998: 2, 2997: 3 }[b];
      if (diff === undefined) continue;
      seen++;
      const a = num(q.answer);
      expect(q.options.map(num).some(o => Math.abs(o - a) === diff)).toBe(true);
    }
    expect(seen).toBeGreaterThan(300);
  });

  it('a lost exchange is offered: 360,000 − 90,000 style cards carry a decoy one column out', () => {
    let seen = 0;
    for (const q of draw(2, 800)) {
      const m = q.prompt.match(/^([\d,]+) − ([\d,]+) = \?$/);
      if (!m) continue;
      seen++;
      const a = num(q.answer), tz = String(num(m[2])).length - String(num(m[2])).replace(/0+$/, '').length;
      expect(q.options.map(num).some(o => Math.abs(o - a) === 10 ** tz)).toBe(true);
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('leak limit: at most 30% of cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(1900);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});
