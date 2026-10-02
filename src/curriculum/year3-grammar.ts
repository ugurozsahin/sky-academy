// Year 3 grammar strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-wordfamily
// import: y3-conjunctions
// import: y3-perfect
// import: y3-speech
import type { Topic } from './types';
import { y3An } from './year3-an';
import { y3Speech } from './year3-speech';

export const Y3_GRAMMAR: Topic[] = [
  { id: 'y3-an', title: 'A or An', icon: '🅰️', subject: 'writing', year: 'year3', nc: 'Y3 English grammar: a or an according to whether the next word begins with a consonant or a vowel (Appendix 2)', gen: y3An },
  // slot: y3-wordfamily
  // slot: y3-conjunctions
  // slot: y3-perfect
  { id: 'y3-speech', title: 'Inverted Commas', icon: '💬', subject: 'writing', year: 'year3', nc: 'Y3 English punctuation: introduction to inverted commas to punctuate direct speech (Appendix 2)', gen: y3Speech },
];
