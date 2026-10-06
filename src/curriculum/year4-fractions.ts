// Year 4 fractions strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
import { y4FracEquiv } from './year4-fracequiv';
// import: y4-hundredths
// import: y4-fracof
// import: y4-fracadd
// import: y4-decimals
// import: y4-div10
// import: y4-comparedec
// import: y4-money
import type { Topic } from './types';

export const Y4_FRACTIONS: Topic[] = [
  { id: 'y4-fracequiv', title: 'Equivalent Fractions', icon: '⚖️', subject: 'maths', year: 'year4', nc: 'Y4 Fractions: families of equivalent fractions, using diagrams', sequenceFrom: 2, gen: y4FracEquiv },
  // slot: y4-hundredths
  // slot: y4-fracof
  // slot: y4-fracadd
  // slot: y4-decimals
  // slot: y4-div10
  // slot: y4-comparedec
  // slot: y4-money
];
