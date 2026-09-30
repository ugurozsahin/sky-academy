// Exported so the same rule runs over the real registry and over a fixture array (#1040) — a mocked module
// graph is not needed just to prove EXPECTED_SHOWN agrees with `meetsShowGate()`. Calls the real gate and the
// real KS2 test, never restates either.
import { isKs2, meetsShowGate } from '../../../src/curriculum';
import type { YearId } from '../../../src/curriculum';

export interface YearCounts { id: YearId; maths: number; writing: number }

/** True iff every row's `expected[row.id]` matches what `meetsShowGate()` says for its counts. An EYFS/KS1
 *  row is always shown, whatever its counts, the same way `shownYears()` treats it. */
export function agreesWithExpectedShown(years: YearCounts[], expected: Partial<Record<YearId, boolean>>): boolean {
  return years.every(y => {
    const ks2 = isKs2(y.id);
    const shown = !ks2 || meetsShowGate(ks2, y.maths, y.writing);
    return expected[y.id] === shown;
  });
}
