// Year 6 number strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-pv
// import: y6-round
// import: y6-negative
import type { Topic } from './types';
import { y6Round } from './year6-round';
import { y6Pv } from './year6-pv';

export const Y6_NUMBER: Topic[] = [
  // slot: y6-pv
  { id: 'y6-pv', title: 'Place value to 10 million', icon: '🔢', subject: 'maths', year: 'year6', nc: 'Y6 NPV: numbers to 10,000,000', gen: y6Pv },

  // slot: y6-round
  { id: 'y6-round', title: 'Round to a required accuracy', icon: '🎯', subject: 'maths', year: 'year6', nc: 'Y6 NPV: round to a required degree of accuracy', gen: y6Round },

  // slot: y6-negative
];
