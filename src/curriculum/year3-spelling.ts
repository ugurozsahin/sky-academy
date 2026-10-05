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
import { y3Prefix } from './year3-prefix';
import { y3Suffix } from './year3-suffix';
import { y3Homophones } from './year3-homophones';

export const Y3_SPELLING: Topic[] = [
  { id: 'y3-wordlist', title: 'Year 3–4 Word List', icon: '📝', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: words often misspelt, Appendix 1 words 1–50', sequenceFrom: 1, gen: y3Wordlist },
  { id: 'y3-prefix', title: 'More Prefixes', icon: '🔤', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: further prefixes dis–, mis–, re–, sub–, inter–, super–, anti–, auto–', sequenceFrom: 3, gen: y3Prefix },
  { id: 'y3-suffix', title: 'Suffixes -ly and -ation', icon: '🔤', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: the suffixes -ly (and its exceptions) and -ation', gen: y3Suffix },
  // slot: y3-double
  // slot: y3-sounds
  { id: 'y3-homophones', title: 'Homophones, Part 1', icon: '👂', subject: 'writing', year: 'year3', nc: 'Y3–4 Spelling: further homophones and near-homophones, accept/except to knot/not', gen: y3Homophones },
  // slot: y3-dictionary
  // slot: y3-dictation
];
