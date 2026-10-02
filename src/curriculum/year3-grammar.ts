// Year 3 grammar strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-wordfamily
// import: y3-conjunctions
// import: y3-perfect
// import: y3-speech
import type { Topic } from './types';
import { y3An } from './year3-an';
import { y3Conjunctions } from './year3-conjunctions';

export const Y3_GRAMMAR: Topic[] = [
  { id: 'y3-an', title: 'A or An', icon: '🅰️', subject: 'writing', year: 'year3', nc: 'Y3 English grammar: a or an according to whether the next word begins with a consonant or a vowel (Appendix 2)', gen: y3An },
  // slot: y3-wordfamily
  { id: 'y3-conjunctions', title: 'Time, Place and Cause', icon: '🔗', subject: 'writing', year: 'year3', nc: 'Y3 Grammar: conjunctions, adverbs and prepositions to express time, place and cause', gen: y3Conjunctions },
  // slot: y3-perfect
  // slot: y3-speech
];
