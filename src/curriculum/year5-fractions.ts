// Year 5 fractions, decimals and percentages strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-fracequiv
// import: y5-mixed
// import: y5-fracadd
// import: y5-fracmult
// import: y5-decfrac
// import: y5-rounddec
// import: y5-decimals
// import: y5-percent
import type { Topic } from './types';
import { y5FracCompare } from './year5-fraccompare';

export const Y5_FRACTIONS: Topic[] = [
  { id: 'y5-fraccompare', title: 'Compare Fractions', icon: '📶', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: compare and order, related denominators (5M22)', sequenceFrom: 3, gen: y5FracCompare },

  // slot: y5-fracequiv

  // slot: y5-mixed

  // slot: y5-fracadd

  // slot: y5-fracmult

  // slot: y5-decfrac

  // slot: y5-rounddec

  // slot: y5-decimals

  // slot: y5-percent
];
