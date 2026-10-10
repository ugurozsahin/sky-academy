import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { parseNum } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';
import { arithmeticCheck } from './helpers/ks2-oracle';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-mental')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1256 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => parseNum(s)!.v;
const MAX = 10_000_000;

/** Independent recomputation from the prompt's own operands. */
function parse(q: Question) {
  const m = /^([\d,]+) ([×÷+−]) ([\d,]+)(?: ([+−]) ([\d,]+))? = \?$/.exec(q.prompt)!;
  expect(m, q.prompt).toBeTruthy();
  const a = num(m[1]), b = num(m[3]);
  const first = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
  const answer = m[4] ? (m[4] === '+' ? first + num(m[5]) : first - num(m[5])) : first;
  return { a, b, op: m[2], first, answer, second: m[4] };
}

describe('y6-mental (#1256)', () => {
  it('is registered for Year 6 maths in the calc strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'calc' }); });

  it('oracle: every answer equals the prompt arithmetic (and the shared KS2 oracle), 300 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(num(q.answer), q.prompt).toBe(parse(q).answer);
      expect(arithmeticCheck(true, q.prompt, q.answer), q.prompt).not.toBe(false);
    }
  });

  it('every card has four distinct options including the answer, whole numbers in 0 to 10,000,000, and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options) { expect(Number.isInteger(num(o)), q.prompt).toBe(true); expect(num(o)).toBeGreaterThanOrEqual(0); expect(num(o)).toBeLessThanOrEqual(MAX); }
      expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1 uses multiples of 10,000 and answers 100,000 to 10,000,000; d2 is a table fact times 10ⁿ, × or its inverse ÷', () => {
    for (const q of draw(1)) { const p = parse(q); expect(['+', '−']).toContain(p.op); expect(p.a % 10_000).toBe(0); expect(p.b % 10_000).toBe(0); expect(p.answer).toBeGreaterThanOrEqual(100_000); expect(p.answer).toBeLessThanOrEqual(MAX); }
    const base = (n: number) => { while (n % 10 === 0) n /= 10; return n; };
    for (const q of draw(2)) {
      const p = parse(q); expect(['×', '÷']).toContain(p.op); expect(p.second).toBeUndefined();
      const [x, y, prod] = p.op === '×' ? [p.a, p.b, p.answer] : [p.answer, p.b, p.a];
      expect(Number.isInteger(p.answer), q.prompt).toBe(true);
      expect(base(x)).toBeGreaterThanOrEqual(1); expect(base(x)).toBeLessThanOrEqual(12);
      expect(base(y)).toBeGreaterThanOrEqual(1); expect(base(y)).toBeLessThanOrEqual(12);
      expect(prod).toBe(x * y); expect(prod).toBeLessThanOrEqual(MAX);
    }
  });

  it('d3 always writes × or ÷ first, then + or −, answers 1 to 10,000,000', () => {
    for (const q of draw(3)) { const p = parse(q); expect(['×', '÷'], q.prompt).toContain(p.op); expect(['+', '−']).toContain(p.second); expect(p.answer).toBeGreaterThanOrEqual(1); expect(p.answer).toBeLessThanOrEqual(MAX); }
  });

  it('slow is set on every d3 card and on no d1 or d2 card', () => {
    for (const q of draw(3)) expect(q.slow, q.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) expect(q.slow, q.prompt).toBeUndefined();
  });

  it('a place-value-shift decoy (×10 or ÷10) is present whenever one is whole and in range', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const a = num(q.answer), shifts = [a * 10, a % 10 === 0 ? a / 10 : -1].filter(v => v >= 1 && v <= MAX);
      if (shifts.length) expect(q.options.map(num).some(v => shifts.includes(v)), `${q.prompt} ${q.options}`).toBe(true);
    }
  });

  it('#1058 leak limit: no digit of the answer is unshared more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
