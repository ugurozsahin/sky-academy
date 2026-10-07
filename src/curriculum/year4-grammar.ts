// Year 4 grammar strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y4-plural-poss
import { y4Standard } from './year4-standard';
// import: y4-nounphrase
// import: y4-adverbials
import { y4Speech } from './year4-speech';
// import: y4-pronouns
// import: y4-determiners
import type { Topic } from './types';

export const Y4_GRAMMAR: Topic[] = [
  // slot: y4-plural-poss
  { id: 'y4-standard', title: 'Standard English', icon: '📖', subject: 'writing', year: 'year4', nc: 'Y4 Grammar: Standard English verb forms', strand: 'grammar', gen: y4Standard },
  // slot: y4-nounphrase
  // slot: y4-adverbials
  { id: 'y4-speech', title: 'Direct Speech', icon: '💬', subject: 'writing', year: 'year4', nc: 'Y4 Grammar: punctuating direct speech', strand: 'grammar', gen: y4Speech },
  // slot: y4-pronouns
  // slot: y4-determiners
];
