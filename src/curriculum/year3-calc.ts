// Year 3 calculation strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-column
// import: y3-check
// import: y3-missing
// import: y3-story-as
// import: y3-tables
// import: y3-tables-3
// import: y3-tables-4
// import: y3-tables-8
// import: y3-multiply
// import: y3-story
import type { Topic } from './types';
import { y3Mental } from './year3-mental';
import { y3Column } from './year3-column';
import { y3Check } from './year3-check';
import { y3Missing } from './year3-missing';
import { y3StoryAs } from './year3-story-as';

export const Y3_CALC: Topic[] = [
  { id: 'y3-mental', title: 'Mental Adding and Subtracting', icon: '➕', subject: 'maths', year: 'year3', nc: 'Y3 A&S: 3-digit number and 1s, 10s, 100s mentally (3M7)', gen: y3Mental },
  { id: 'y3-column', title: 'Column Adding and Subtracting', icon: '✏️', subject: 'maths', year: 'year3', nc: 'Y3 A&S: columnar addition and subtraction to 3 digits (3M8)', sequenceFrom: 1, gen: y3Column },
  { id: 'y3-check', title: 'Estimate and Check', icon: '✅', subject: 'maths', year: 'year3', nc: 'Y3 A&S: estimate, and check with inverse operations (3M9)', gen: y3Check },
  { id: 'y3-missing', title: 'Missing Numbers to 1,000', icon: '❓', subject: 'maths', year: 'year3', nc: 'Y3 A&S: missing number problems (3M10)', gen: y3Missing },
  { id: 'y3-story-as', title: 'Adding and Subtracting Problems', icon: '📚', subject: 'maths', year: 'year3', nc: 'Y3 A&S: one- and two-step problems within 1,000 (3M10)', gen: y3StoryAs },
  // slot: y3-tables
  // slot: y3-tables-3
  // slot: y3-tables-4
  // slot: y3-tables-8
  // slot: y3-multiply
  // slot: y3-story
];
