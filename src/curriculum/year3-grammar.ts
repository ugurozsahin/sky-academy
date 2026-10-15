// Year 3 grammar strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-conjunctions
// import: y3-perfect
// import: y3-speech
import type { Topic } from './types';
import { y3An } from './year3-an';
import { y3WordFamily } from './year3-wordfamily';
import { y3Conjunctions } from './year3-conjunctions';
import { y3Perfect } from './year3-perfect';
import { y3Speech } from './year3-speech';

export const Y3_GRAMMAR: Topic[] = [
  { id: 'y3-an', title: 'A or An', icon: '🅰️', subject: 'writing', year: 'year3', nc: 'Y3 English grammar: a or an according to whether the next word begins with a consonant or a vowel (Appendix 2)', gen: y3An },
  { id: 'y3-wordfamily', title: 'Word Families', icon: '🔤', subject: 'writing', year: 'year3', strand: 'grammar', nc: 'Y3 English grammar: word families based on common words, showing how words are related in form and meaning (Appendix 2)', sequenceFrom: 3, gen: y3WordFamily },
  { id: 'y3-conjunctions', title: 'Time, Place and Cause', icon: '🔗', subject: 'writing', year: 'year3', nc: 'Y3 Grammar: conjunctions, adverbs and prepositions to express time, place and cause', gen: y3Conjunctions },
  { id: 'y3-perfect', title: 'Has Gone or Went', icon: '⏳', subject: 'writing', year: 'year3', nc: 'Y3 English grammar: the present perfect form of verbs in contrast to the past tense (Appendix 2)', gen: y3Perfect },
  { id: 'y3-speech', title: 'Inverted Commas', icon: '💬', subject: 'writing', year: 'year3', nc: 'Y3 English punctuation: introduction to inverted commas to punctuate direct speech (Appendix 2)', gen: y3Speech },
];
