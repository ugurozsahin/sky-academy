// Year 3 spelling strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-wordlist
// import: y3-prefix
// import: y3-suffix
// import: y3-double
// import: y3-sounds
// import: y3-homophones
// import: y3-dictionary
// import: y3-dictation
import type { Topic } from './types';
import { y3Wordlist } from './wordlist-y3';
import { y3Suffix } from './year3-suffix';

export const Y3_SPELLING: Topic[] = [
  { id: 'y3-wordlist', title: 'Year 3–4 Word List', icon: '📝', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: words often misspelt, Appendix 1 words 1–50', sequenceFrom: 1, gen: y3Wordlist },
  // slot: y3-prefix
  { id: 'y3-suffix', title: 'Suffixes -ly and -ation', icon: '🔤', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: the suffixes -ly (and its exceptions) and -ation', gen: y3Suffix },
  // slot: y3-double
  // slot: y3-sounds
  // slot: y3-homophones
  // slot: y3-dictionary
  // slot: y3-dictation
];
