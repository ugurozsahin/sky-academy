// Year 5 grammar strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-verbs
// import: y5-verbprefix
// import: y5-relative
import { y5Modal } from './year5-modal';
// import: y5-parenthesis
// import: y5-commas
// import: y5-cohesion
// import: y5-perfect
import { y5Parenthesis } from './year5-parenthesis';
import type { Topic } from './types';

export const Y5_GRAMMAR: Topic[] = [
  // slot: y5-verbs

  // slot: y5-verbprefix

  // slot: y5-relative

  { id: 'y5-modal', title: 'Modal Verbs', icon: '💭', subject: 'writing', year: 'year5', strand: 'grammar', nc: 'Y5 Grammar: degrees of possibility with modal verbs and adverbs', gen: y5Modal },

  { id: 'y5-parenthesis', title: 'Parenthesis: brackets, dashes, commas', icon: '📝', subject: 'writing', year: 'year5', nc: 'Y5–6 punctuation: brackets, dashes or commas to indicate parenthesis', strand: 'grammar', gen: y5Parenthesis },

  // slot: y5-commas

  // slot: y5-cohesion

  // slot: y5-perfect
];
