import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-longdiv')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1255 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const sum = (p: string) => { const m = p.match(/^([\d,]+) ÷ (\d+)/)!; return { n: num(m[1]), d: Number(m[2]) }; };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const isMixed = (q: Question) => q.prompt.includes('mixed number');
const MIXED = /^(\d+) (\d+)\/(\d+)$/;
/** Value of a mixed-number or decimal label as a fraction over d, or null. */
const valueOver = (label: string, d: number) => {
  const m = MIXED.exec(label); if (m) return { w: Number(m[1]), n: Number(m[2]) * d / Number(m[3]), simplest: gcd(Number(m[2]), Number(m[3])) === 1, bad: (Number(m[2]) * d) % Number(m[3]) !== 0 };
  return null;
};

describe('y6-longdiv (#1255)', () => {
  it('is a Year 6 calc topic whose builds stay out of Ninja Duel', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year6', 'maths', 'calc', 2]);
  });

  it('oracle d1: q × d = n exactly, with a short-division divisor, four distinct options', () => {
    for (const c of draw(1, 1000)) {
      const { n, d } = sum(c.prompt);
      expect([11, 12, 15, 20, 25]).toContain(d);
      expect(n).toBeGreaterThanOrEqual(100); expect(n).toBeLessThanOrEqual(9999);
      expect(num(c.answer) * d).toBe(n);
      expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('oracle d2: q × d + r = n, 0 < r < d, at most 6 slots, the division stays on the card', () => {
    for (const c of draw(2, 1000)) {
      const { n, d } = sum(c.prompt);
      const m = c.answer.match(/^(\d+) r (\d+)$/)!;
      const r = Number(m[2]);
      expect(Number(m[1]) * d + r).toBe(n);
      expect(r).toBeGreaterThan(0); expect(r).toBeLessThan(d);
      expect(d).toBeGreaterThanOrEqual(11); expect(n).toBeGreaterThanOrEqual(100); expect(n).toBeLessThanOrEqual(9999);
      expect(c.sequence!.length).toBeLessThanOrEqual(6);
      expect(c.sequence!.join('')).toBe(c.answer.replace(/\D/g, ''));
      expect(c.build!.template).toMatch(/^_+ r _+$/);
    }
  });

  it('d3 draws the mixed number and the rounded story each 40–60 % of the time', () => {
    const cards = draw(3), share = cards.filter(isMixed).length / cards.length;
    expect(share).toBeGreaterThanOrEqual(0.4); expect(share).toBeLessThanOrEqual(0.6);
  });

  it('d3 mixed number: simplest form asked, exactly one option equals n/d and is in lowest terms', () => {
    const cards = draw(3, 600).filter(isMixed);
    expect(cards.length).toBeGreaterThan(100);
    for (const c of cards) {
      const { n, d } = sum(c.prompt);
      expect(c.prompt).toContain('in its simplest form');
      const exact = c.options.filter(o => { const v = valueOver(o, d); return v !== null && !v.bad && v.w * d + v.n === n && v.simplest; });
      expect(exact, c.prompt).toEqual([c.answer]);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4);
    }
  });

  it('d3 story: the answer rounds up for "needed" and down for "full", and the other rounding is an option', () => {
    const cards = draw(3, 600).filter(c => !isMixed(c));
    expect(cards.length).toBeGreaterThan(100);
    let up = 0, down = 0;
    for (const c of cards) {
      const m = c.prompt.match(/^([\d,]+) .*?of (\d+)/)!;
      const n = num(m[1]), d = Number(m[2]);
      const lo = Math.floor(n / d), r = n % d;
      expect(r).toBeGreaterThan(0);
      const rounds = /needed\?$/.test(c.prompt) ? 'up' : 'down';
      if (rounds === 'up') up++; else down++;
      expect(num(c.answer)).toBe(rounds === 'up' ? lo + 1 : lo);
      expect(c.options).toContain(String(rounds === 'up' ? lo : lo + 1));
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4);
    }
    expect(up).toBeGreaterThan(30); expect(down).toBeGreaterThan(30);
  });

  it('every card has a safe say, no ASCII hyphen or float artefact, and a prompt that fits', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(c.say, c.prompt).toBeTruthy(); expect(sayIsSafe(c.say!), c.say).toBe(true);
      expect(c.prompt.length).toBeLessThanOrEqual(90);
      for (const o of c.options) { expect(o).not.toMatch(/-|NaN|\d\.\d{3,}/); }
    }
  });

  it('#1058 leak limit: no answer stands out by its last or leading digit more than 30 % of the time', () => {
    for (const d of [1, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
