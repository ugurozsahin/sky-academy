// Year 4 spelling strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y4-prefix-not
// import: y4-ous
// import: y4-shun
// import: y4-origins
// import: y4-proofread
// import: y4-homophones
import type { Topic } from './types';
import { y4Wordlist } from './wordlist-y4';
import { y4SureTure } from './year4-sure-ture';

export const Y4_SPELLING: Topic[] = [
  { id: 'y4-wordlist', title: 'Year 3–4 Word List (51–100)', icon: '📝', subject: 'writing', year: 'year4', nc: 'Y3–4 statutory word list, words 51–100', sequenceFrom: 1, strand: 'spelling', gen: y4Wordlist },
  // slot: y4-prefix-not
  { id: 'y4-sure-ture', title: 'Endings -sure -ture -sion', icon: '🔤', subject: 'writing', year: 'year4', nc: 'Y3–4 Spelling: -sure, -ture, -sion (/ʒən/)', strand: 'spelling', gen: y4SureTure },
  // slot: y4-ous
  // slot: y4-shun
  // slot: y4-origins
  // slot: y4-proofread
  // slot: y4-homophones
];
