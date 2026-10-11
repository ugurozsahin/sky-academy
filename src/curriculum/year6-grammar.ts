// Year 6 grammar strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-formal
// import: y6-synonyms
// import: y6-passive
// import: y6-subjunctive
// import: y6-cohesion
// import: y6-clauses
// import: y6-lists
import { y6Hyphen } from './year6-hyphen';
// import: y6-subjectobject
// import: y6-consistency
import type { Topic } from './types';

export const Y6_GRAMMAR: Topic[] = [
  // slot: y6-formal

  // slot: y6-synonyms

  // slot: y6-passive

  // slot: y6-subjunctive

  // slot: y6-cohesion

  // slot: y6-clauses

  // slot: y6-lists

  { id: 'y6-hyphen', title: 'Hyphens', icon: '➖', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)', gen: y6Hyphen },

  // slot: y6-subjectobject

  // slot: y6-consistency
];
