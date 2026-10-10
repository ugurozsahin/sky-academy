// Year 6 calculation strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-longdiv
// import: y6-mental
// import: y6-factors
// import: y6-order-ops
// import: y6-story
import type { Topic } from './types';
import { y6LongMult } from './year6-longmult';

export const Y6_CALC: Topic[] = [
  { id: 'y6-longmult', title: 'Long multiplication', icon: '✖️', subject: 'maths', year: 'year6', strand: 'calc', nc: 'Y6 MD: long multiplication, up to 4 digits × 2 digits (6M5)', sequenceFrom: 3, gen: y6LongMult },

  // slot: y6-longdiv

  // slot: y6-mental

  // slot: y6-factors

  // slot: y6-order-ops

  // slot: y6-story
];
