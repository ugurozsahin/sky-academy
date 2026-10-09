// Year 5 spelling strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import { y5Wordlist } from './year5-wordlist';
// import: y5-cious
// import: y5-ant
// import: y5-able
// import: y5-fer
// import: y5-silent
import type { Topic } from './types';

export const Y5_SPELLING: Topic[] = [
  { id: 'y5-wordlist', title: 'Year 5–6 Word List (1–50)', icon: '📝', subject: 'writing', year: 'year5', nc: 'Y5–6 statutory word list, words 1–50', sequenceFrom: 1, strand: 'spelling', gen: y5Wordlist },

  // slot: y5-cious

  // slot: y5-ant

  // slot: y5-able

  // slot: y5-fer

  // slot: y5-silent
];
