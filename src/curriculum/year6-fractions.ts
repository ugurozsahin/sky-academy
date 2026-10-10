// Year 6 fractions strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-simplify
// import: y6-fracadd
// import: y6-fracdiv
// import: y6-fdp
// import: y6-decimals
// import: y6-decmult
// import: y6-decdiv
import { y6Simplify } from './year6-simplify';
import { y6FracMult } from './year6-fracmult';
import { y6Fdp } from './year6-fdp';
import type { Topic } from './types';

export const Y6_FRACTIONS: Topic[] = [
  // slot: y6-simplify
  { id: 'y6-simplify', title: 'Simplify and compare fractions', icon: '✂️', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: simplify, common denominators, compare >1', gen: y6Simplify },

  // slot: y6-fracadd

  { id: 'y6-fracmult', title: 'Multiplying fractions', icon: '✖️', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: multiply proper fractions, simplest form', gen: y6FracMult },

  // slot: y6-fracdiv

  { id: 'y6-fdp', title: 'Fractions, decimals and percentages', icon: '💯', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: fraction as division; FDP equivalences', gen: y6Fdp },

  // slot: y6-decimals

  // slot: y6-decmult

  // slot: y6-decdiv
];
