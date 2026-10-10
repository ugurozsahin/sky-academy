import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { ks2Solve, sameValue } from './helpers/ks2-oracle';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-order-ops')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1258 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const body = (q: Question) => q.prompt.replace(/ = \?$/, '');
const bracketed = (q: Question) => q.prompt.includes('(');
const count = (q: Question) => body(q).match(/\d+/g)!.length;
/** The sum read strictly left to right, as a child who ignores precedence would. */
function leftToRight(text: string): number {
  const t = text.replace(/[()]/g, '').split(' ');
  let v = Number(t[0]);
  for (let i = 1; i < t.length; i += 2) { const n = Number(t[i + 1]); v = t[i] === '+' ? v + n : t[i] === '−' ? v - n : t[i] === '×' ? v * n : v / n; }
  return v;
}
/** The sum with its brackets dropped but precedence kept. */
const noBrackets = (text: string) => ks2Solve(`${text.replace(/[()]/g, '')} = ?`)!;
const val = (f: { n: number; d: number }) => f.n / f.d;

describe('y6-order-ops (#1258)', () => {
  it('is a Year 6 calc topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'calc']);
  });

  it('the NC examples: 2 + 1 × 3 = 5 and (2 + 1) × 3 = 9, plus six more, through the oracle', () => {
    const table: [string, number][] = [['2 + 1 × 3', 5], ['(2 + 1) × 3', 9], ['20 − 3 × 4', 8], ['(20 − 3) × 4', 68], ['12 + 18 ÷ 6', 15], ['30 − 18 ÷ 3', 24], ['5 × (9 − 4)', 25], ['40 − (12 + 8)', 20]];
    for (const [text, want] of table) expect(val(ks2Solve(`${text} = ?`)!), text).toBe(want);
  });

  it('oracle: the answer is the precedence-and-brackets result on every card, 0–1,000, four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const v = ks2Solve(c.prompt)!;
      expect(sameValue(c.answer, v), c.prompt).toBe(true);
      expect(Number.isInteger(val(v)), c.prompt).toBe(true);
      expect(num(c.answer)).toBeGreaterThanOrEqual(0); expect(num(c.answer)).toBeLessThanOrEqual(1000);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) expect(num(o)).toBeGreaterThanOrEqual(0);
    }
  });

  it('a card without brackets offers its left-to-right result, which is not the answer', () => {
    let seen = 0;
    for (const d of [1, 3] as Difficulty[]) for (const c of draw(d).filter(c => !bracketed(c))) {
      seen++;
      const slip = leftToRight(body(c));
      expect(slip, c.prompt).not.toBe(num(c.answer));
      expect(c.options, c.prompt).toContain(String(slip).length > 3 ? slip.toLocaleString('en-GB') : String(slip));
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('a bracketed card offers its brackets-ignored result, which is not the answer', () => {
    let seen = 0;
    for (const d of [2, 3] as Difficulty[]) for (const c of draw(d).filter(bracketed)) {
      seen++;
      const slip = noBrackets(body(c)), s = val(slip);
      expect(s, c.prompt).not.toBe(num(c.answer));
      expect(c.options, c.prompt).toContain(s >= 1000 ? s.toLocaleString('en-GB') : String(s));
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('d1 has three numbers and no brackets, d2 always brackets, d3 has four numbers', () => {
    for (const c of draw(1)) { expect(bracketed(c)).toBe(false); expect(count(c)).toBe(3); }
    for (const c of draw(2)) { expect(bracketed(c)).toBe(true); expect(count(c)).toBe(3); }
    for (const c of draw(3)) expect(count(c)).toBe(4);
  });

  it('d3 draws both bracketed and bracket-free cards', () => {
    const cards = draw(3), share = cards.filter(bracketed).length / cards.length;
    expect(share).toBeGreaterThan(0.3); expect(share).toBeLessThan(0.7);
  });

  it('slow on every d3 card and on no d1 or d2 card', () => {
    for (const c of draw(3, 100)) expect(c.slow).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 100)) expect(c.slow).toBeUndefined();
  });

  it('every ÷ is exact', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) for (const m of body(c).matchAll(/(\d+) ÷ (\d+)/g)) expect(Number(m[1]) % Number(m[2])).toBe(0);
  });

  it('brackets are read aloud, and every say is safe', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(sayIsSafe(c.say!), c.say).toBe(true);
      expect(c.say).not.toMatch(/[()]/);
      if (c.prompt.includes('(')) { expect(c.say).toContain('bracket'); expect(c.say).toContain('close bracket'); }
      expect(c.prompt.length).toBeLessThanOrEqual(40);
    }
    const s = draw(2).find(c => c.prompt.startsWith('('))!;
    expect(s.say).toMatch(/^bracket \d+ plus \d+ close bracket /);
  });

  it('#1058 leak limit: no answer stands out by its last or leading digit more than 30 % of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
