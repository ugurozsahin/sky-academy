// Year 3 grammar strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-an
// import: y3-wordfamily
// import: y3-conjunctions
// import: y3-perfect
// import: y3-speech
import type { Topic } from './types';
import { y3Conjunctions } from './year3-conjunctions';

export const Y3_GRAMMAR: Topic[] = [
  // slot: y3-an
  // slot: y3-wordfamily
  { id: 'y3-conjunctions', title: 'Time, Place and Cause', icon: '🔗', subject: 'writing', year: 'year3', nc: 'Y3 Grammar: conjunctions, adverbs and prepositions to express time, place and cause', gen: y3Conjunctions },
  // slot: y3-perfect
  // slot: y3-speech
];
