// Year 6 grammar strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-synonyms
// import: y6-passive
// import: y6-subjunctive
// import: y6-cohesion
// import: y6-clauses
import { y6Hyphen } from './year6-hyphen';
import { y6Lists } from './year6-lists';
// import: y6-subjectobject
// import: y6-consistency
import type { Topic } from './types';
import { y6Formal } from './year6-formal';
import { y6Passive } from './year6-passive';

export const Y6_GRAMMAR: Topic[] = [
  { id: 'y6-formal', title: 'Formal or Informal', icon: '📝', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: formal and informal vocabulary and structures (Appendix 2)', gen: y6Formal },

  // slot: y6-synonyms

  { id: 'y6-passive', title: 'Active and Passive', icon: '🔁', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: active and passive (Appendix 2)', gen: y6Passive },

  // slot: y6-subjunctive

  // slot: y6-cohesion

  // slot: y6-clauses

  { id: 'y6-lists', title: 'Lists and Bullet Points', icon: '📋', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: colon before a list, semi-colons in lists, bullet points (Appendix 2)', gen: y6Lists },

  { id: 'y6-hyphen', title: 'Hyphens', icon: '➖', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)', gen: y6Hyphen },

  // slot: y6-subjectobject

  // slot: y6-consistency
];
