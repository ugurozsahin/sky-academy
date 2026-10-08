// Year 5 calculation strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import { y5Mental } from './year5-mental';
import { y5Story } from './year5-story';
import { y5Factors } from './year5-factors';
import { y5Primes } from './year5-primes';
import { y5LongMult } from './year5-longmult';
import { y5MentalMd } from './year5-mentalmd';
import { y5ShortDiv } from './year5-shortdiv';
// import: y5-x10
import { y5Squares } from './year5-squares';
// import: y5-equals
// import: y5-story-md
// import: y5-truefalse
import type { Topic } from './types';
import { y5Column } from './year5-column';

export const Y5_CALC: Topic[] = [
  { id: 'y5-column', title: 'Column Adding and Subtracting', icon: '➕', subject: 'maths', year: 'year5', nc: 'Y5 A&S: more than 4 digits, columnar; round to check (5M7, 5M9)', sequenceFrom: 3, gen: y5Column },

  { id: 'y5-mental', title: 'Mental Adding and Subtracting', icon: '💭', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 A&S: mental, increasingly large numbers (5M8)', gen: y5Mental },

  { id: 'y5-story', title: 'Adding and Subtracting Problems', icon: '📰', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 A&S: multi-step problems in context (5M10)', gen: y5Story },

  { id: 'y5-factors', title: 'Factors and Multiples', icon: '✖️', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: multiples, factor pairs, common factors (5M11)', sequenceFrom: 2, gen: y5Factors },

  { id: 'y5-primes', title: 'Prime Numbers', icon: '🔑', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: primes to 100, prime factors, composite; recall primes to 19 (5M12–13)', sequenceFrom: 2, gen: y5Primes },

  { id: 'y5-longmult', title: 'Long Multiplication', icon: '✖️', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: up to 4 digits × 1 or 2 digits, formal methods (5M14)', sequenceFrom: 3, gen: y5LongMult },

  { id: 'y5-mentalmd', title: 'Mental Multiplying and Dividing', icon: '💡', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: mental × and ÷ from known facts (5M15)', gen: y5MentalMd },

  { id: 'y5-shortdiv', title: 'Short Division', icon: '➗', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: short division up to 4 digits ÷ 1 digit; remainders in context (5M16)', sequenceFrom: 2, gen: y5ShortDiv },

  // slot: y5-x10

  { id: 'y5-squares', title: 'Square and Cube Numbers', icon: '🟦', subject: 'maths', year: 'year5', strand: 'calc', nc: 'Y5 M&D: square and cube numbers, ² and ³ (5M18–19)', gen: y5Squares },

  // slot: y5-equals

  // slot: y5-story-md

  // slot: y5-truefalse
];
