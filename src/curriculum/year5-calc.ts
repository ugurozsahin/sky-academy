// Year 5 calculation strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-column
import { y5Mental } from './year5-mental';
// import: y5-story
// import: y5-factors
// import: y5-primes
// import: y5-longmult
// import: y5-mentalmd
// import: y5-shortdiv
// import: y5-x10
// import: y5-squares
// import: y5-equals
// import: y5-story-md
// import: y5-truefalse
import type { Topic } from './types';

export const Y5_CALC: Topic[] = [
  // slot: y5-column

  { id: 'y5-mental', title: 'Mental Adding and Subtracting', icon: '💭', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 A&S: mental, increasingly large numbers (5M8)', gen: y5Mental },

  // slot: y5-story

  // slot: y5-factors

  // slot: y5-primes

  // slot: y5-longmult

  // slot: y5-mentalmd

  // slot: y5-shortdiv

  // slot: y5-x10

  // slot: y5-squares

  // slot: y5-equals

  // slot: y5-story-md

  // slot: y5-truefalse
];
