import { describe, it, expect } from 'vitest';
import { dec, fmt } from '../../src/curriculum/ks2num';
import { isKs2 } from '../../src/curriculum/key-stage';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { labelProblems } from './helpers/number-labels';

// Deterministic RNG (mulberry32), the same construction curriculum.test.ts and ks2num.test.ts use.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const ri = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

/**
 * Topics whose labels are years, exempted from comma grouping (#1047, #1101, #1181). Neither topic exists
 * yet — this list is what those tickets add to, not something this ticket reads from the registry, since a
 * year format is a property of the topic's own domain (a calendar year, a Roman-numeral year) rather than
 * something derivable from `Topic` itself.
 */
const YEAR_LABEL_TOPICS = ['y3-calendar', 'y5-roman'];

describe('KS2 number-label rail (#1047): no float artefact, no ASCII minus, commas from four digits', () => {
  it('fmt() passes the rail over 1e5 random values, and its year form never adds a comma', () => {
    const r = rng(1047);
    for (let i = 0; i < 100_000; i++) {
      const kind = i % 3;
      const d = kind === 0 ? dec(ri(r, 0, 10_000_000), 0)
        : kind === 1 ? dec(-ri(r, 1, 1000), 0)
          : dec(ri(r, -1_000_000, 1_000_000), ri(r, 1, 3));
      const label = fmt(d);
      expect(labelProblems(label), `fmt(${JSON.stringify(d)}) = "${label}"`).toEqual([]);
    }
    for (const y of [1000, 1999, 2026, 2099]) {
      const label = fmt(dec(y, 0), { year: true });
      expect(label, label).not.toContain(',');
      expect(labelProblems(label, { years: true }), label).toEqual([]);
    }
  });

  it('fmt() rejects a year given decimal places, a negative value, or fixedDp', () => {
    expect(() => fmt(dec(1999, 0), { year: true, fixedDp: 2 })).toThrow(/mutually exclusive/);
    expect(() => fmt(dec(19995, 1), { year: true })).toThrow(/fractional/);
    expect(() => fmt(dec(-1999, 0), { year: true })).toThrow(/negative/);
  });

  it('the years exemption holds its upper boundary: 2100 still fails even with years: true', () => {
    expect(labelProblems('2100', { years: true })).not.toEqual([]);
    expect(labelProblems('3000', { years: true })).not.toEqual([]);
  });

  it('two independent problems in one string both get reported', () => {
    expect(labelProblems('-12345')).toHaveLength(2); // the "-1" minus sign, and "12345" ungrouped
    expect(labelProblems('-3 and 12345', { years: true })).toHaveLength(2);
  });

  it('a comma does not excuse the digits either side of it', () => {
    // "12,3456" — a comma that lands nowhere near a three-digit boundary is still a bad grouping, not a
    // free pass for the run of four after it: a check that only skips digits *preceded* by a comma would
    // miss this entirely.
    expect(labelProblems('12,3456')).toHaveLength(1);
    expect(labelProblems('1,004,235')).toEqual([]); // real three-digit groups throughout: still fine
  });

  it('an ASCII minus right after a comma, with no space, is still caught', () => {
    expect(labelProblems('1,-2')).toHaveLength(1);
    expect(labelProblems('(3,-4)')).toHaveLength(1);
  });

  it('every isKs2 registry topic\'s prompt, answer and options pass the rail', () => {
    const ks2Topics = TOPICS.filter(t => isKs2(t.year));
    for (const t of ks2Topics) {
      const years = YEAR_LABEL_TOPICS.includes(t.id);
      const r = rng(2000 + t.id.length);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < 150; i++) {
          const q = t.gen(d, r);
          for (const label of [q.prompt, q.answer, ...q.options]) {
            expect(labelProblems(label, { years }), `${t.id} d${d}: "${label}"`).toEqual([]);
          }
        }
      }
    }
    // Not a vacuous pass by accident: nothing in `TOPICS` is `isKs2` yet (Year 3+ ships behind #1050,
    // still `blocked`), so this loop runs zero times today and the rail is proven only against `fmt()`
    // above. It starts checking real topics the moment the first one lands, with no test to write then.
    expect(ks2Topics.length, 'update this comment once a KS2 topic exists to check').toBe(0);
  });

  it.each([
    ['0.30000000000000004', false, 1],
    ['-3', false, 1],
    ['1000', false, 1],
    ['10 000', false, 1],
    ['−3', false, 0],
    ['1,000', false, 0],
    ['3.75', false, 0],
    ['£1,234.56', false, 0],
    ['12.5%', false, 0],
    ['twenty-four', false, 0],
    ['-ly', false, 0],
    ['(−3, 4)', false, 0],
  ] as const)('%s (years:%s) has %i problem(s)', (text, years, count) => {
    expect(labelProblems(text, { years })).toHaveLength(count);
  });

  it('"1999" fails with no years option and passes with years: true', () => {
    expect(labelProblems('1999')).not.toEqual([]);
    expect(labelProblems('1999', { years: true })).toEqual([]);
  });
});
