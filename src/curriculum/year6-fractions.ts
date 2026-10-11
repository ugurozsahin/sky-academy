// Year 6 fractions strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-simplify
// import: y6-fracadd
// import: y6-fdp
// import: y6-decimals
// import: y6-decdiv
import { y6Simplify } from './year6-simplify';
import { y6FracMult } from './year6-fracmult';
import { y6FracDiv } from './year6-fracdiv';
import { y6DecMult } from './year6-decmult';
import type { Topic } from './types';

export const Y6_FRACTIONS: Topic[] = [
  // slot: y6-simplify
  { id: 'y6-simplify', title: 'Simplify and compare fractions', icon: '✂️', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: simplify, common denominators, compare >1', gen: y6Simplify },

  // slot: y6-fracadd

  { id: 'y6-fracmult', title: 'Multiplying fractions', icon: '✖️', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: multiply proper fractions, simplest form', gen: y6FracMult },

  { id: 'y6-fracdiv', title: 'Dividing fractions', icon: '➗', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: proper fraction ÷ whole number', gen: y6FracDiv },

  // slot: y6-fdp

  // slot: y6-decimals

  { id: 'y6-decmult', title: 'Multiplying decimals', icon: '💷', subject: 'maths', year: 'year6', strand: 'fractions', nc: 'Y6 F: decimals (≤2 dp) × whole numbers', sequenceFrom: 3, gen: y6DecMult },

  // slot: y6-decdiv
];
