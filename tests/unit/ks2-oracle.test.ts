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
  // #1986 boundary: every product is safe and so is the numerator they sum to (8.845e15 < 2^53 ≈ 9.007e15)
  ['66000001 ÷ 67000003 + 67000003 ÷ 66000001 = ?', f(66000001 ** 2 + 67000003 ** 2, 67000003 * 66000001)],
  ['999999/999998 × 999999/999997 = ?', f(999999 * 999999, 999998 * 999997)],   // #1986: just inside the safe range
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
  // a repeated `?`, used consistently, is one unknown too — isolates line 137's accepting half from its
  // "two different symbols" refusal, which only `'? + n'`-shaped NULLS exercised until now (#1423 round 5)
  ['? + ? = 10', f(5)],
  // #1443: the largest inputs the bounds still accept — six-digit fraction and mixed-number parts, three decimal
  // places — so the caps in `readNumber` refuse the first value past them, not the last one inside.
  ['999999/2 + 1/2 = ?', f(500000)],
  ['999999 1/2 + 1/2 = ?', f(1000000)],
  ['0.001 + 1 = ?', f(1001, 1000)],
  // every part at its cap, so tightening any one of them to five digits fails here and not silently
  ['1/999999 + 1 = ?', f(1000000, 999999)],
  ['999999 999999/999999 + 1 = ?', f(1000001)],
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
  // #1423 review round 4: round 2's "the leftover check backs this up regardless" conclusion only holds
  // for a bracket that's missing its close entirely. Here the bracketed content parses to a complete `Lin`
  // but leaves a stray token ('4') where ')' should be; round 2's mutation (`if (!inner) return null;`)
  // then unconditionally advances past that stray token as if it *were* the consumed ')', which makes the
  // cursor land exactly on the token count by coincidence — defeating the leftover check too. Confirmed by
  // mutation: the suite stays green without this case, and with it removed this exact prompt goes from
  // `null` to a fabricated `{n:8,d:1}` — a malformed prompt has no "real" answer at all.
  '(3 + n 4 = 11',
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
  // #1423 review round 6: mulLin's final `return null` (both factors carry the unknown) had only one case,
  // 'n × n = 9', and its second factor's `const` is 0 — so a mutation dropping the `isZero(b.coef)` check
  // entirely (falling through to treat b as if it were a plain constant) still lands on {coef:0, const:0},
  // which ks2Solve's own "no unknown at all" check then catches for an unrelated reason, masking the gap.
  // This case's second factor (n + 3) has a nonzero const, so the same mutation instead yields a nonzero
  // coefficient (mul(a.coef, b.const) = 3) that reaches ks2Solve's final line and returns a fabricated
  // {n:4,d:3} rather than tripping any other check — confirmed by mutation.
  'n × (n + 3) = 4',
  // #1443: `readNumber` bounds what it accepts to what KS2 prints. A 400-digit denominator used to overflow
  // `Number()` to `Infinity` and come back as a non-null `{ n: NaN, d: NaN }`; sixteen decimal places used to
  // push `10 ** dp` past `MAX_SAFE_INTEGER` so `1 + 10⁻¹⁶` rounded to exactly 1. Both are `null` now. The
  // digit cap is an OR over the parts of the literal, so each part gets a case of its own (a fraction's
  // numerator and denominator; a mixed number's whole part, numerator and denominator), seven digits each.
  '1/' + '9'.repeat(400) + ' = ?',
  '1234567/2 + 1 = ?',
  '1/1234567 + 1 = ?',
  '1234567 1/2 + 1 = ?',
  '1 1234567/2 + 1 = ?',
  '1 1/1234567 + 1 = ?',
  '0.0000000000000001 + 1 = ?',
  '0.0001 + 1 = ?',
  // #1443: `readSide`'s refusals are ORs too. An empty side reads as no tokens at all; a stray `)` after a
  // complete bracketed expression leaves a token over, and `(n + 1) = 5` alone would have answered 4.
  ' = 5',
  '(n + 1)) = 5',
  '',
  // #1986: each literal passes the #1443 caps, but the arithmetic after it outgrows MAX_SAFE_INTEGER
  '10,000,000.123 × 10,000,000.123 = ?',
  // each cross-product is a safe integer but their sum is not (9.11e15 > 2^53): add, sub and the coefficient difference
  // (the shared factor 1000 lets simplify() shrink the rounded numerator back to a safe-looking value, so only the pre-check refuses these)
  '67000001 ÷ 67001000 + 68000003 ÷ 68001000 = ?',
  '67000001 ÷ 67001000 − −68000003 ÷ 68001000 = ?',
  '67000001 ÷ 67001000 × ? = −68000003 ÷ 68001000 × ? + 1',
  '1/999999 + 1/999998 + 1/999997 = ? + 1/999996',
  '999999/999998 × 999999/999997 × 999999/999996 × 999999/999995 = ?',
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
  // #1423 review round 4: this doc comment already promised U+2212 for "a plain or mixed fraction", but
  // fractions.ts's own parseFrac only accepted an ASCII hyphen there — ks2num.ts's fmt() deliberately
  // emits U+2212 for every negative KS2 number, so a negative-fraction KS2 answer formatted the codebase's
  // own way would have been marked wrong by the very oracle built to check it. Fixed in fractions.ts.
  it('reads a U+2212-signed fraction', () => { expect(sameValue('−3/4', f(-3, 4))).toBe(true); });
  it('reads a U+2212-signed mixed number', () => { expect(sameValue('−1 1/2', f(-3, 2))).toBe(true); });
  it('refuses a value whose cross-product outgrows MAX_SAFE_INTEGER (#1986)', () => {
    expect(sameValue('9,999,999.999', f(9999999999, 10 ** 10))).toBe(false);   // dp 3 is fine; n·d ≈ 1e20 is not
  });
  it('refuses a pair that differs but whose cross-products collide past 2^53 (#1986)', () => {
    // 2^53 + 1 reads as 2^53, so unguarded `equal` calls these two equal; only the `checked` guard says false.
    expect(sameValue('9007199254740993', f(9007199254740992))).toBe(false);
  });
  it('refuses an answer with more decimal places than the oracle reads (#1986)', () => {
    expect(sameValue('0.0001', f(1, 10000))).toBe(false);   // only the dp guard refuses this: the products are tiny
  });
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
  it('a KS2 topic now exists (#1050) and the wiring is live', () => {
    // The tripwire this used to be ("no KS2 topic exists yet") has done its job: `y3-count` is the first real
    // KS2 topic, so `curriculum.test.ts`'s generic loop now calls `arithmeticCheck(true, ...)` for real draws.
    expect(TOPICS.some((t) => isKs2(t.year))).toBe(true);
  });
  it('y3-count\'s own prompts are outside ks2Solve\'s linear-equation grammar (null, not a false negative)', () => {
    // `y3-count`'s two card kinds are a sequence run ("12, 16, ?, 24") and an English "N more/less than" phrase
    // — neither is an arithmetic expression, so `arithmeticCheck` falls through to `null` (curriculum.test.ts's
    // own "if (arith !== null)" gate treats that as no opinion, not a failure). The oracle for this topic's own
    // arithmetic is its dedicated `topic-y3-count.test.ts`, per #1050's acceptance criteria — not this shared one.
    expect(arithmeticCheck(true, '12, 16, ?, 24 = ?', '20')).toBeNull();
    expect(arithmeticCheck(true, '10 more than 347 = ?', '357')).toBeNull();
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
