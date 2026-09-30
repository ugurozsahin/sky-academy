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
  // #1423 review round 1: divLin's refusal ORs "divisor still carries the unknown" with "divisor is 0" —
  // the case above has both true at once, so it cannot tell the two reasons apart; round 1's own attempted
  // fix, '36 ÷ (n + 1) = 4', still had a *constant* (coef-0) dividend, so a divLin that wrongly let it
  // through produced a coef-0 result that ks2Solve's own top-level "no unknown at all" check then caught
  // instead — passing for a reason that has nothing to do with divLin. Round 2 found that. This case's
  // dividend (`n`) itself carries the unknown, so a divLin that wrongly lets the division through yields a
  // nonzero coefficient that reaches ks2Solve's final line and returns a fabricated wrong answer (3) rather
  // than tripping any other check — confirmed by mutating divLin to drop the unknown-coefficient half and
  // watching this exact case go from `null` to `{n:3,d:1}`.
  'n ÷ (n + 1) = 3',
  '10 ÷ 0 = ?',
  // #1423 review: every KNOWN bracket case is well-formed, so an unbalanced one is worth a null case on
  // its own merits. Round 2 found that this specific case does not actually isolate parseFactor's own
  // rparen check from readSide's separate leftover-token check (`c.i === toks.length`): an unclosed '('
  // always leaves the cursor short of the token count by the missing ')', so the leftover check catches
  // it regardless of whether the rparen check itself still runs — confirmed by mutating the rparen check
  // away and watching the leftover check still return `null` here. Kept as a null case in its own right;
  // not a regression test for the rparen check specifically, which this suite does not isolate.
  '(5 + 3 = ?',
  'n + m = 10',
  '? + n = 10',
  // #1423 review round 3: the two cases above only ever put the letter after the `?`/other letter, so they
  // only ever trip tokenize's letter-branch guard — the `?`-branch guard (fires when `?` follows an
  // already-seen letter) had no case of its own. Confirmed by mutation: removing the `?`-branch guard
  // leaves the suite green without this case, and turns this exact prompt into a fabricated `{n:5,d:1}`.
  'n + ? = 10',
  '5 + = 8',
  // #1423 review round 3: ks2Solve's own "no unknown at all, or it cancelled out" refusal (`isZero(coefDiff)`)
  // had no case of either kind. Confirmed by mutation: removing that line leaves the suite green for both
  // sub-cases below, and — worse than a wrong value — makes `reciprocal` divide by the zero `coefDiff`,
  // which throws inside `simplify` rather than returning anything at all.
  '5 + 3 = 8',       // no `?`/letter anywhere
  'n + 3 = n + 5',   // a genuine cancellation: the same coefficient on both sides
  // Self-audit after round 3, looking for the same two shapes (an ORed refusal condition; a "throws
  // instead of returning null" risk) at every other return-null site in the file, since three different
  // reviewers have each found one of these the review before did not. Both confirmed by the same mutation
  // method: readNumber's mixed-number branch checks a zero denominator on its own line, separate from the
  // plain-fraction branch '3/0 + 1 = ?' above already covers — removing the mixed-number check leaves the
  // suite green and throws `RangeError: simplify: denominator is 0` (the same class as the coefDiff finding
  // above) instead of returning anything.
  '2 3/0 + 1 = ?',
  // ks2Solve's `if (!lhs || !rhs) return null;` is an OR of two reasons, the same shape divLin's own OR
  // had in rounds 1-2 — every other null case here happens to put the malformed half on the lhs, so only
  // that half was ever exercised. This one isolates the rhs half instead (lhs parses fine on its own):
  // removing the `!rhs` half leaves the suite green here and throws `TypeError: Cannot read properties of
  // null (reading 'coef')` at `sub(lhs.coef, rhs.coef)` instead of returning anything.
  '5 = @',
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
