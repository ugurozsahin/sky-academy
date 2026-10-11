// Year 6 grammar strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-passive
// import: y6-subjunctive
// import: y6-cohesion
// import: y6-lists
import { y6Hyphen } from './year6-hyphen';
// import: y6-subjectobject
import type { Topic } from './types';
import { y6Formal } from './year6-formal';
import { y6Synonyms } from './year6-synonyms';
import { y6Passive } from './year6-passive';
import { y6Clauses } from './year6-clauses';
import { y6Consistency } from './year6-consistency';

export const Y6_GRAMMAR: Topic[] = [
  { id: 'y6-formal', title: 'Formal or Informal', icon: '📝', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: formal and informal vocabulary and structures (Appendix 2)', gen: y6Formal },

  { id: 'y6-synonyms', title: 'Synonyms and Antonyms', icon: '↔️', subject: 'writing', year: 'year6', nc: 'Y6 Vocabulary: synonyms and antonyms (Appendix 2)', gen: y6Synonyms },

  { id: 'y6-passive', title: 'Active and Passive', icon: '🔁', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: active and passive (Appendix 2)', gen: y6Passive },

  // slot: y6-subjunctive

  // slot: y6-cohesion

  { id: 'y6-clauses', title: 'Semicolons, Colons, Dashes', icon: '✏️', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: semi-colon, colon and dash between independent clauses (Appendix 2)', gen: y6Clauses },

  // slot: y6-lists

  { id: 'y6-hyphen', title: 'Hyphens', icon: '➖', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)', gen: y6Hyphen },

  // slot: y6-subjectobject

  { id: 'y6-consistency', title: 'Tense and Agreement', icon: '⚖️', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y5/6 Writing: consistent tense and subject–verb agreement', gen: y6Consistency },
];
