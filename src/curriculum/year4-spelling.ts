// Year 4 spelling strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y4-ous
import { y4Shun } from './year4-shun';
// import: y4-origins
import { y4Proofread } from './year4-proofread';
// import: y4-homophones
import type { Topic } from './types';
import { y4PrefixNot } from './year4-prefix-not';
import { y4Wordlist } from './wordlist-y4';
import { y4SureTure } from './year4-sure-ture';

export const Y4_SPELLING: Topic[] = [
  { id: 'y4-wordlist', title: 'Year 3–4 Word List (51–100)', icon: '📝', subject: 'writing', year: 'year4', nc: 'Y3–4 statutory word list, words 51–100', sequenceFrom: 1, strand: 'spelling', gen: y4Wordlist },
  { id: 'y4-prefix-not', title: 'Prefixes in- il- im- ir-', icon: '🔤', subject: 'writing', year: 'year4', nc: 'Y3–4 Spelling: prefixes in-, il-, im-, ir-', strand: 'spelling', gen: y4PrefixNot },
  { id: 'y4-sure-ture', title: 'Endings -sure -ture -sion', icon: '🔤', subject: 'writing', year: 'year4', nc: 'Y3–4 Spelling: -sure, -ture, -sion (/ʒən/)', strand: 'spelling', gen: y4SureTure },
  // slot: y4-ous
  { id: 'y4-shun', title: 'Endings -tion -sion -ssion -cian', icon: '✂️', subject: 'writing', year: 'year4', nc: 'Y3–4 Spelling: /ʃən/ spelt -tion, -sion, -ssion, -cian', strand: 'spelling', gen: y4Shun },
  // slot: y4-origins
  { id: 'y4-proofread', title: 'Proofreading', icon: '🔎', subject: 'writing', year: 'year4', nc: 'Y3–4 Writing: proofread for spelling', strand: 'spelling', gen: y4Proofread },
  // slot: y4-homophones
];
