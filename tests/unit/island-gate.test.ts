// #1032/#1040: which `YEARS` rows the map may show. The EYFS/KS1 minimum and the KS2 topic-count gate moved
// here from `curriculum.test.ts` so this is the one file a KS2 shell PR's test changes touch, alongside the
// one line in `helpers/expected-shown.ts` it flips.
import { describe, it, expect } from 'vitest';
import { YEARS, isKs2, shownYears, topicsFor, type YearId } from '../../src/curriculum';
import { EXPECTED_SHOWN } from './helpers/expected-shown';
import { agreesWithExpectedShown } from './helpers/island-gate-check';

describe('island gate (#1032, #1040)', () => {
  it('every YEARS row has at least one topic; EYFS/KS1 keeps its 6 maths / 3 writing minimum (moved from curriculum.test.ts)', () => {
    for (const y of YEARS) {
      expect(topicsFor(y.id).length, y.id).toBeGreaterThan(0);
      if (!isKs2(y.id)) {
        expect(topicsFor(y.id, 'maths').length, y.id).toBeGreaterThanOrEqual(6);
        expect(topicsFor(y.id, 'writing').length, y.id).toBeGreaterThanOrEqual(3);
      }
    }
  });

  for (const y of YEARS) {
    const expected = EXPECTED_SHOWN[y.id];
    it(`${y.title} shown: ${expected ? 'yes' : 'no'}`, () => {
      const counts = { id: y.id, maths: topicsFor(y.id, 'maths').length, writing: topicsFor(y.id, 'writing').length };
      expect(agreesWithExpectedShown([counts], EXPECTED_SHOWN), `${y.id}: EXPECTED_SHOWN disagrees with meetsShowGate()`).toBe(true);
      expect(shownYears().some(s => s.id === y.id), y.id).toBe(expected);
    });
  }

  // Fixtures, per the issue's acceptance criteria — a fourth `YearId` cast the same way `memory.test.ts`'s
  // `'year3' as YearId` already stands in for a KS2 year no real `YearId` member exists for yet.
  it('a hidden KS2 year with one topic agrees with a `false` row', () => {
    const id = 'year3' as YearId;
    expect(agreesWithExpectedShown([{ id, maths: 1, writing: 0 }], { [id]: false })).toBe(true);
  });
  it('a KS2 year at 12 maths / 6 writing disagrees with a `false` row', () => {
    const id = 'year3' as YearId;
    expect(agreesWithExpectedShown([{ id, maths: 12, writing: 6 }], { [id]: false })).toBe(false);
  });
  it('a KS2 year at 11 maths / 6 writing (one short) disagrees with a `true` row', () => {
    const id = 'year3' as YearId;
    expect(agreesWithExpectedShown([{ id, maths: 11, writing: 6 }], { [id]: true })).toBe(false);
  });
});
