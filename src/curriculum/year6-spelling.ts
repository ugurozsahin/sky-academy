// Year 6 spelling strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-ough
// import: y6-homophones
import { y6Wordlist } from './wordlist-y6';
// import: y6-spellgap
import { y6Spellgap } from './year6-spellgap';
import type { Topic } from './types';

export const Y6_SPELLING: Topic[] = [
  // slot: y6-ough

  // slot: y6-homophones

  { id: 'y6-wordlist', title: 'Year 5–6 Word List (51–100)', icon: '📝', subject: 'writing', year: 'year6', nc: 'Y5/6 statutory word list, words 51–100 (Appendix 1)', sequenceFrom: 1, strand: 'spelling', gen: y6Wordlist },

  { id: 'y6-spellgap', title: 'Spell the missing word', icon: '✏️', subject: 'writing', year: 'year6', nc: 'E56-25 (App. 1 Y5–6)', sequenceFrom: 1, strand: 'spelling', gen: y6Spellgap },
];
