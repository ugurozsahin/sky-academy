// Which `YEARS` rows the map is expected to show right now (#1032, #1040). Hand-maintained, and kept in its
// own file so a crossing PR edits exactly this one line: a KS2 shell (#1050+) adds its year here as `false`
// when it ships hidden, and the topic PR that takes it to 12 maths and 6 writing topics flips it to `true`.
// `island-gate.test.ts` checks every entry against the real gate (`meetsShowGate`) rather than trusting it.
import type { YearId } from '../../../src/curriculum';

export const EXPECTED_SHOWN: Record<YearId, boolean> = {
  reception: true,
  year1: true,
  year2: true,
  year3: true,
  year4: true,
};
