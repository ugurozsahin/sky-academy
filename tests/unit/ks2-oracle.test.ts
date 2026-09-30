import { describe, it, expect } from 'vitest';
import { equal, type Frac } from '../../src/curriculum/fractions';
import { ks2Solve, sameValue, arithmeticCheck } from './helpers/ks2-oracle';
import { TOPICS } from '../../src/curriculum';
import { isKs2 } from '../../src/curriculum/key-stage';
import type { Question } from '../../src/curriculum';

const f = (n: number, d = 1): Frac => ({ n, d });

// [prompt, expected value] — decimals, fractions, mixed numbers, brackets, percentages, "of" and one-step
// letter equations, including the STA 2025 arithmetic paper's own four items (#1045's evidence section).
const KNOWN: [string, Frac][] = [
  ['5 + 3 = ?', f(8)],
  ['12 − 5 = ?', f(7)],
  ['1,004,235 − 52,346 = ?', f(951889)],
  ['0.1 + 0.2 = ?', f(3, 10)],
  ['3/4 + 1/8 = ?', f(7, 8)],
  ['2 3/4 − 1 1/2 = ?', f(5, 4)],
  ['−3 + 5 = ?', f(2)],
  ['? × 6 = 4.2', f(7, 10)],
  ['12 − ? = 5', f(7)],
  ['15% of 360 = ?', f(54)],
  ['3n = 18', f(6)],
  ['n + 7 = 12', f(5)],
  ['n ÷ 4 = 6', f(24)],
  ['(5 + 3) − 12 ÷ 4 = ?', f(5)],
  ['5% of 860 = ?', f(43)],
  ['3 × 8.9 = ?', f(267, 10)],
  ['2,000 ÷ 4 = ?', f(500)],
  ['1/4 of 12 = ?', f(3)],
  ['3/4 of 20 = ?', f(15)],
  ['n − 4 = 9', f(13)],
  ['8 − n = 3', f(5)],
  ['n × 5 = 35', f(7)],
  ['? + 2.5 = 10', f(15, 2)],
  ['100 − ? = 45', f(55)],
  ['2/5 of 30 = ?', f(12)],
  ['50% of 18 = ?', f(9)],
  ['10% of 250 = ?', f(25)],
  ['1/2 + 1/2 = ?', f(1)],
  ['3/8 − 1/8 = ?', f(1, 4)],
  ['1 1/2 + 2 1/4 = ?', f(15, 4)],
  ['0.75 + 0.25 = ?', f(1)],
  ['9.99 + 0.01 = ?', f(10)],
  ['1,000,000 − 1 = ?', f(999999)],
  ['−10 + 4 = ?', f(-6)],
  ['20 ÷ 4 × 3 = ?', f(15)],
  ['2 + 3 × 4 = ?', f(14)],
  ['(2 + 3) × 4 = ?', f(20)],
  ['4n = 2.4', f(3, 5)],
  ['n ÷ 2 = 0.5', f(1)],
  ['60% of 45 = ?', f(27)],
  ['7/10 of 200 = ?', f(140)],
  ['? − 6 = −2', f(4)],
  // the same letter, used consistently on both sides of the `=`, is not "two unknowns" (#1423 review)
  ['n + 3 = 2n − 1', f(4)],
];

// A prompt this oracle deliberately does not answer: a word problem, an instruction rather than an
// equation, an unsupported symbol, a malformed number, division by zero, or a non-linear equation
// (two unknown factors, dividing by an expression that still carries the unknown, or two distinct
// unknown letters, since "at most one unknown" is a claim about the whole equation).
const NULLS = [
  'What is half of 10?',
  'Round 34,567 to the nearest 1,000',
  '3/0 + 1 = ?',
  '1,004,2,35 − 1 = ?',
  '5 @ 3 = ?',
  'n × n = 9',
  '36 ÷ n = 4',
  // #1423 review: divLin's refusal ORs "divisor still carries the unknown" with "divisor is 0" — the case
  // above has both true at once, so it cannot tell the two reasons apart. Here the divisor (n + 1) is never
  // 0-valued as a constant (its `const` is 1), so only the unknown-coefficient half can be catching this.
  '36 ÷ (n + 1) = 4',
  '10 ÷ 0 = ?',
  // #1423 review: every KNOWN bracket case is well-formed, so an unbalanced one never exercised the
  // rparen check at all.
  '(5 + 3 = ?',
  'n + m = 10',
  '? + n = 10',
  '5 + = 8',
  '',
];

describe('ks2Solve', () => {
  it.each(KNOWN)('%s', (prompt, expected) => {
    const got = ks2Solve(prompt);
    expect(got, prompt).not.toBeNull();
    expect(equal(got!, expected), `${prompt}: got ${got!.n}/${got!.d}, expected ${expected.n}/${expected.d}`).toBe(true);
  });

  it.each(NULLS)('returns null for %s', (prompt) => {
    expect(ks2Solve(prompt)).toBeNull();
  });

  it('a card whose answer is wrong fails the wired check, not the oracle itself', () => {
    // #1045's own fixture: "(5 + 3) − 12 ÷ 4 = ?" is 5, so a card claiming "2" is wrong.
    const value = ks2Solve('(5 + 3) − 12 ÷ 4 = ?');
    expect(value).not.toBeNull();
    expect(sameValue('2', value!)).toBe(false);
    expect(sameValue('5', value!)).toBe(true);
  });
});

describe('sameValue', () => {
  it('treats "0.5", "1/2" and "2/4" as one value', () => {
    for (const answer of ['0.5', '1/2', '2/4']) expect(sameValue(answer, f(1, 2)), answer).toBe(true);
  });
  it('reads a mixed number', () => { expect(sameValue('1 3/4', f(7, 4))).toBe(true); });
  it('reads a fixed-dp decimal', () => { expect(sameValue('3.50', f(7, 2))).toBe(true); });
  it('reads a comma-grouped whole number', () => { expect(sameValue('1,000', f(1000))).toBe(true); });
  it('reads a U+2212-signed number', () => { expect(sameValue('−7', f(-7))).toBe(true); });
  it('reads a hyphen-signed number', () => { expect(sameValue('-7', f(-7))).toBe(true); });
  it('rejects a value that disagrees', () => { expect(sameValue('6', f(7))).toBe(false); });
  it('is false for text it cannot read at all', () => {
    expect(sameValue('abc', f(1))).toBe(false);
    expect(sameValue('', f(0))).toBe(false);
  });
});

describe('arithmeticCheck (the generic loop\'s one call site, #1045)', () => {
  it('a KS2 card ks2Solve reads is checked against it', () => {
    expect(arithmeticCheck(true, '15% of 360 = ?', '54')).toBe(true);
    expect(arithmeticCheck(true, '15% of 360 = ?', '50')).toBe(false);
  });
  it('a KS2 card ks2Solve does not read falls back to the bare-number check', () => {
    expect(arithmeticCheck(true, '7 + 5 = ?', '12')).toBe(true);
  });
  it('an EYFS/KS1 card never reaches ks2Solve, only the bare-number check', () => {
    expect(arithmeticCheck(false, '0.1 + 0.2 = ?', '0.3')).toBeNull();   // solve() cannot read a decimal
    expect(arithmeticCheck(false, '7 + 5 = ?', '12')).toBe(true);
  });
  it('null when neither oracle recognises the prompt', () => {
    expect(arithmeticCheck(true, 'What is half of 10?', '5')).toBeNull();
  });
});

describe('the wired check (curriculum.test.ts)', () => {
  it('no KS2 topic exists yet — isKs2 never fires today, so the wiring is inert until Y3–Y6 land', () => {
    // #1045 lands ahead of the year registry (isKs2 is #1032's stub in key-stage.ts): this pins that fact so
    // the day a KS2 YearId is added, this test goes red as the signal to look here rather than ship a KS2
    // card whose arithmetic silently went unchecked by the oracle this issue built for it.
    expect(TOPICS.some((t) => isKs2(t.year))).toBe(false);
  });

  it('sameValue agrees with a real KS1 topic\'s own numeric answers, as a sanity check on the plumbing', () => {
    const t = TOPICS.find((x) => x.id === 'y2-add')!;
    let seed = 4090;
    const r = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
    for (let i = 0; i < 20; i++) {
      const q: Question = t.gen(2, r);
      const value = ks2Solve(q.prompt);
      if (value !== null) expect(sameValue(q.answer, value), q.prompt).toBe(true);
    }
  });
});
