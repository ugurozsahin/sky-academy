// Year 5 calculation strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import { y5Mental } from './year5-mental';
// import: y5-story
import { y5Factors } from './year5-factors';
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
import { y5Column } from './year5-column';

export const Y5_CALC: Topic[] = [
  { id: 'y5-column', title: 'Column Adding and Subtracting', icon: '➕', subject: 'maths', year: 'year5', nc: 'Y5 A&S: more than 4 digits, columnar; round to check (5M7, 5M9)', sequenceFrom: 3, gen: y5Column },

  { id: 'y5-mental', title: 'Mental Adding and Subtracting', icon: '💭', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 A&S: mental, increasingly large numbers (5M8)', gen: y5Mental },

  // slot: y5-story

  { id: 'y5-factors', title: 'Factors and Multiples', icon: '✖️', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: multiples, factor pairs, common factors (5M11)', sequenceFrom: 2, gen: y5Factors },

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
