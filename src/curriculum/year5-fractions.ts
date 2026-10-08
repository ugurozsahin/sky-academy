// Year 5 fractions, decimals and percentages strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-fraccompare
// import: y5-mixed
// import: y5-fracadd
// import: y5-fracmult
// import: y5-decfrac
// import: y5-rounddec
// import: y5-decimals
// import: y5-percent
import type { Topic } from './types';
import { y5FracEquiv } from './year5-fracequiv';

export const Y5_FRACTIONS: Topic[] = [
  // slot: y5-fraccompare

  { id: 'y5-fracequiv', title: 'Equivalent Fractions', icon: '🔁', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: equivalent fractions incl. tenths and hundredths (5M23)', gen: y5FracEquiv },

  // slot: y5-mixed

  // slot: y5-fracadd

  // slot: y5-fracmult

  // slot: y5-decfrac

  // slot: y5-rounddec

  // slot: y5-decimals

  // slot: y5-percent
];
