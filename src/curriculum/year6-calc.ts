// Year 6 calculation strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-longmult
// import: y6-longdiv
// import: y6-mental
// import: y6-factors
// import: y6-order-ops
// import: y6-story
import { y6LongDiv } from './year6-longdiv';
import { y6Mental } from './year6-mental';
import type { Topic } from './types';

export const Y6_CALC: Topic[] = [
  // slot: y6-longmult

  // slot: y6-longdiv
  { id: 'y6-longdiv', title: 'Long and Short Division', icon: '➗', subject: 'maths', year: 'year6', strand: 'calc', nc: 'Y6 M&D: long and short division, interpreting remainders (6M6–7)', sequenceFrom: 2, gen: y6LongDiv },

  // slot: y6-mental
  { id: 'y6-mental', title: 'Mental calculation', icon: '🧮', subject: 'maths', year: 'year6', nc: 'Y6 ASMD: mental, mixed operations, large numbers', gen: y6Mental },

  // slot: y6-factors

  // slot: y6-order-ops

  // slot: y6-story
];
