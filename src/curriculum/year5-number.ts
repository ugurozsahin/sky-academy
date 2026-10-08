// Year 5 number strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-pv
// import: y5-roman
import type { Topic } from './types';
import { y5Negative } from './year5-negative';
import { y5Round } from './year5-round';

export const Y5_NUMBER: Topic[] = [
  // slot: y5-pv

  { id: 'y5-negative', title: 'Negative Numbers', icon: '🌡️', subject: 'maths', year: 'year5', nc: 'Y5 NPV: negative numbers in context, count through 0 (5M3)', gen: y5Negative },
  { id: 'y5-round', title: 'Round to 10, 100, 1,000, 10,000 and 100,000', icon: '🎯', subject: 'maths', year: 'year5', nc: 'Y5 NPV: round to 10, 100, 1,000, 10,000, 100,000', gen: y5Round },
  // slot: y5-roman
];
