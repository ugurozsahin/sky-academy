import { describe, it, expect } from 'vitest';
import { parseNumericAnswer } from './helpers/numeric-answer';

describe('parseNumericAnswer', () => {
  it('parses the forms Sky Ninja Academy writes a numeric answer in', () => {
    const cases: [string, number | null][] = [
      ['3', 3],
      ['−3', -3],   // U+2212, the sign KS2 labels use
      ['-3', -3],   // ASCII hyphen
      ['1,000', 1000],
      ['1,000,000', 1000000],
      ['3.75', 3.75],
      ['−3.75', -3.75],
      ['0', 0],
      ['1,00', null],    // not grouped in threes
      ['12,5', null],    // not grouped in threes
      ['3/4', null],     // a fraction
      ['£2', null],      // money
      ['12 r 3', null],  // a remainder
      ['', null],
      ['seven', null],
    ];
    for (const [s, want] of cases) expect(parseNumericAnswer(s), s).toBe(want);
  });

  it('a year floor of minAnswer -50 accepts −3 and rejects −51', () => {
    const minAnswer = -50;
    expect(parseNumericAnswer('−3')!).toBeGreaterThanOrEqual(minAnswer);
    expect(parseNumericAnswer('−51')!).toBeLessThan(minAnswer);
  });

  it('a year with no minAnswer floors at 0, so it rejects −3', () => {
    const minAnswer = undefined as number | undefined;
    expect(parseNumericAnswer('−3')!).toBeLessThan(minAnswer ?? 0);
  });

  it('"1,000" is checked against maxAnswer: fails at 130, passes at 2,000', () => {
    const n = parseNumericAnswer('1,000')!;
    expect(n).toBeGreaterThan(130);
    expect(n).toBeLessThanOrEqual(2000);
  });
});
