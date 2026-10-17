// Year 6 grammar strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-passive
import { y6Hyphen } from './year6-hyphen';
import { y6SubjectObject } from './year6-subjectobject';
import { y6Lists } from './year6-lists';
import type { Topic } from './types';
import { y6Formal } from './year6-formal';
import { y6Synonyms } from './year6-synonyms';
import { y6Passive } from './year6-passive';
import { y6Subjunctive } from './year6-subjunctive';
import { y6Clauses } from './year6-clauses';
import { y6Consistency } from './year6-consistency';
import { y6Cohesion } from './year6-cohesion';

export const Y6_GRAMMAR: Topic[] = [
  { id: 'y6-formal', title: 'Formal or Informal', icon: '📝', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: formal and informal vocabulary and structures (Appendix 2)', gen: y6Formal },

  { id: 'y6-synonyms', title: 'Synonyms and Antonyms', icon: '↔️', subject: 'writing', year: 'year6', nc: 'Y6 Vocabulary: synonyms and antonyms (Appendix 2)', gen: y6Synonyms },

  { id: 'y6-passive', title: 'Active and Passive', icon: '🔁', subject: 'writing', year: 'year6', nc: 'Y6 Grammar: active and passive (Appendix 2)', gen: y6Passive },

  { id: 'y6-subjunctive', title: 'The Subjunctive', icon: '💭', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Grammar: subjunctive forms in formal writing (Appendix 2)', gen: y6Subjunctive },

  { id: 'y6-cohesion', title: 'Linking Paragraphs', icon: '🔗', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Cohesion: linking adverbials and ellipsis (Appendix 2)', gen: y6Cohesion },

  { id: 'y6-clauses', title: 'Semicolons, Colons, Dashes', icon: '✏️', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: semi-colon, colon and dash between independent clauses (Appendix 2)', gen: y6Clauses },

  { id: 'y6-lists', title: 'Lists and Bullet Points', icon: '📋', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: colon before a list, semi-colons in lists, bullet points (Appendix 2)', gen: y6Lists },

  { id: 'y6-hyphen', title: 'Hyphens', icon: '➖', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)', gen: y6Hyphen },

  { id: 'y6-subjectobject', title: 'Subject and Object', icon: '🎯', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y6 Grammar terms: subject and object (Appendix 2)', gen: y6SubjectObject },

  { id: 'y6-consistency', title: 'Tense and Agreement', icon: '⚖️', subject: 'writing', year: 'year6', strand: 'grammar', nc: 'Y5/6 Writing: consistent tense and subject–verb agreement', gen: y6Consistency },
];
