// The arithmetic paper form (#1232): ordering, coverage, oracle agreement and label hygiene.
import { describe, it, expect } from 'vitest';
import { ARITH_ITEMS, arithmeticForm } from '../../src/game/arithmetic-form';
import { seededRng } from '../../src/game/rng';
import { ks2Solve, sameValue } from './helpers/ks2-oracle';

/** The oracle reads "x = ?"; it has no `²`/`³`, so those are spelled out as products first. */
function toOracle(prompt: string): string {
  return prompt.replace(/(\d+)²/g, '$1 × $1').replace(/(\d+)³/g, '$1 × $1 × $1') + ' ?';
}
const digits = (s: string) => (s.match(/\d/g) ?? []).length;

describe('arithmeticForm (#1232)', () => {
  it('returns `count` items in non-decreasing rank, ordered as the paper orders them', () => {
    for (let seed = 1; seed <= 500; seed++) {
      for (const count of [5, 10, 16, 20]) {
        const form = arithmeticForm(seededRng(seed), 'year6', count);
        expect(form).toHaveLength(count);
        for (let i = 1; i < form.length; i++) expect(form[i].rank).toBeGreaterThanOrEqual(form[i - 1].rank);
      }
    }
  });

  it('never repeats a code while unused codes remain', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const codes = arithmeticForm(seededRng(seed), 'year6', 15).map(i => i.code.replace(/^6F5[ab]$/, '6F5'));
      expect(new Set(codes).size).toBe(15);
    }
  });

  it('agrees with the KS2 oracle over 2,000 seeds', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      for (const item of arithmeticForm(seededRng(seed), 'year6', 16)) {
        const value = ks2Solve(toOracle(item.prompt));
        expect(value, `${item.code}: ${item.prompt} (seed ${seed}) unreadable`).not.toBeNull();
        expect(sameValue(item.answer, value!), `${item.code}: ${item.prompt} ${item.answer} (seed ${seed})`).toBe(true);
      }
    }
  });

  it('covers all 16 makers and both 6F5 tags over 200 Year 6 forms of 10', () => {
    const seen = new Set<string>(), makers = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) for (const i of arithmeticForm(seededRng(seed), 'year6', 10)) { seen.add(i.code); makers.add(i.rank); }
    expect(makers.size).toBe(16);
    expect(ARITH_ITEMS).toHaveLength(16);
    expect(seen.has('6F5a')).toBe(true);
    expect(seen.has('6F5b')).toBe(true);
    expect(seen.has('6F5')).toBe(false);
  });

  it('keeps Year 5 forms to codes up to Year 5', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const i of arithmeticForm(seededRng(seed), 'year5', 12)) expect(i.code).not.toMatch(/^6/);
    }
  });

  it('marks long multiplication and long division as 2 marks, everything else 1', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const i of arithmeticForm(seededRng(seed), 'year6', 16)) expect(i.marks).toBe(['6C7a', '6C7b'].includes(i.code) ? 2 : 1);
    }
  });

  it('prints clean labels: " =" ending, U+2212 for minus, no float artefacts, answers within 6 digits', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      for (const i of arithmeticForm(seededRng(seed), 'year6', 16)) {
        expect(i.prompt.endsWith(' =')).toBe(true);
        for (const s of [i.prompt, i.answer]) {
          expect(s).not.toMatch(/-/);
          expect(s).not.toMatch(/\d\.\d{4,}|NaN|Infinity|e\+/);
        }
        expect(digits(i.answer)).toBeLessThanOrEqual(6);
        expect(i.answer).not.toMatch(/^\s*$/);
      }
    }
  });
});
