// Year 6 algebra strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-formulae
import { y6Formulae } from './year6-formulae';
// import: y6-sequences
// import: y6-algebra
import { y6Algebra } from './year6-algebra-missing';
// import: y6-twounknowns
import type { Topic } from './types';

export const Y6_ALGEBRA: Topic[] = [
  // slot: y6-formulae
  { id: 'y6-formulae', title: 'Using formulae', icon: '🔤', subject: 'maths', year: 'year6', strand: 'algebra', nc: 'Y6 Alg: simple formulae', gen: y6Formulae },

  // slot: y6-sequences

  // slot: y6-algebra
  { id: 'y6-algebra', title: 'Missing numbers with letters', icon: '🔤', subject: 'maths', year: 'year6', strand: 'algebra', nc: 'Y6 Alg: missing numbers algebraically', gen: y6Algebra },

  // slot: y6-twounknowns
];
