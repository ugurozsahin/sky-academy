// Year 5 fractions, decimals and percentages strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-fraccompare
// import: y5-fracadd
import { y5FracMult } from './year5-fracmult';
import { y5DecFrac } from './year5-decfrac';
// import: y5-rounddec
// import: y5-decimals
import { y5Percent } from './year5-percent';
import type { Topic } from './types';
import { y5FracEquiv } from './year5-fracequiv';
import { y5Mixed } from './year5-mixed';

export const Y5_FRACTIONS: Topic[] = [
  // slot: y5-fraccompare

  { id: 'y5-fracequiv', title: 'Equivalent Fractions', icon: '🔁', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: equivalent fractions incl. tenths and hundredths (5M23)', gen: y5FracEquiv },

  { id: 'y5-mixed', title: 'Mixed Numbers', icon: '🔀', subject: 'maths', year: 'year5', nc: 'Y5 Fractions: mixed numbers and improper fractions (5M24)', gen: y5Mixed },

  // slot: y5-fracadd

  { id: 'y5-fracmult', title: 'Fractions Times Whole Numbers', icon: '✖️', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: proper fractions and mixed numbers × whole numbers (5M26)', gen: y5FracMult },

  { id: 'y5-decfrac', title: 'Decimals and Fractions', icon: '🔢', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: decimals as fractions, e.g. 0.71 = 71/100 (5M27)', gen: y5DecFrac },

  // slot: y5-rounddec

  // slot: y5-decimals

  { id: 'y5-percent', title: 'Per Cent', icon: '💯', subject: 'maths', year: 'year5', strand: 'fractions', nc: 'Y5 Fractions: per cent; FDP equivalents of 1/2, 1/4, 1/5, 2/5, 4/5, tenths, twenty-fifths (5M32–33)', gen: y5Percent },
];
