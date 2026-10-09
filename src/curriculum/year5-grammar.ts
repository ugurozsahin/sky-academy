// Year 5 grammar strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-verbs
// import: y5-verbprefix
import { y5Relative } from './year5-relative';
// import: y5-modal
// import: y5-parenthesis
// import: y5-commas
// import: y5-cohesion
// import: y5-perfect
import type { Topic } from './types';

export const Y5_GRAMMAR: Topic[] = [
  // slot: y5-verbs

  // slot: y5-verbprefix

  { id: 'y5-relative', title: 'Relative Clauses', icon: '🔗', subject: 'writing', year: 'year5', strand: 'grammar', nc: 'Y5 Grammar: relative clauses with who, which, where, when, whose, that or an omitted pronoun', gen: y5Relative },

  // slot: y5-modal

  // slot: y5-parenthesis

  // slot: y5-commas

  // slot: y5-cohesion

  // slot: y5-perfect
];
