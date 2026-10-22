// Which `YEARS` rows the map is expected to show right now (#1032, #1040, #2195). `GATE_SHOWN` is hand-maintained
// and kept in its own file so a crossing PR edits exactly this one line: a KS2 shell (#1050+) adds its year here as
// `false` when it ships hidden, and the topic PR that takes it to 12 maths and 6 writing topics flips it to `true`.
// `island-gate.test.ts` checks every entry against the real gate (`meetsShowGate`) rather than trusting it.
// `EXPECTED_SHOWN` derives from the catalogue file: a year set to `true` or `false` there takes that value, and a
// year on `"auto"` takes its `GATE_SHOWN` line.
import type { YearId } from '../../../src/curriculum';
import { RUNTIME } from '../../../src/config/resolve';

export const GATE_SHOWN: Record<YearId, boolean> = {
  reception: true,
  year1: true,
  year2: true,
  year3: true,
  year4: true,
  year5: true,
  year6: true,
};

export const EXPECTED_SHOWN = Object.fromEntries((Object.keys(GATE_SHOWN) as YearId[]).map(y => {
  const v = RUNTIME.years[y].visible;
  return [y, v === 'auto' ? GATE_SHOWN[y] : v];
})) as Record<YearId, boolean>;
