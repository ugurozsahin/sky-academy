// Year 4 fractions strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
import { y4FracEquiv } from './year4-fracequiv';
import { y4Hundredths } from './year4-hundredths';
import { y4FracOf } from './year4-fracof';
// import: y4-fracadd
// import: y4-decimals
import { y4Div10 } from './year4-div10';
// import: y4-comparedec
// import: y4-money
import type { Topic } from './types';

export const Y4_FRACTIONS: Topic[] = [
  { id: 'y4-fracequiv', title: 'Equivalent Fractions', icon: '⚖️', subject: 'maths', year: 'year4', nc: 'Y4 Fractions: families of equivalent fractions, using diagrams', sequenceFrom: 2, gen: y4FracEquiv },
  { id: 'y4-hundredths', title: 'Hundredths', icon: '💯', subject: 'maths', year: 'year4', nc: 'Y4 Fractions: count in hundredths; tenths ÷ 10', gen: y4Hundredths },
  { id: 'y4-fracof', title: 'Fractions of Amounts', icon: '➗', subject: 'maths', year: 'year4', nc: 'Y4 Fractions: fractions of quantities, including non-unit fractions', gen: y4FracOf },
  // slot: y4-fracadd
  // slot: y4-decimals
  { id: 'y4-div10', title: 'Divide by 10 & 100', icon: '➗', subject: 'maths', year: 'year4', nc: 'Y4 Fractions: ÷ 10 and ÷ 100; ones, tenths and hundredths', gen: y4Div10 },
  // slot: y4-comparedec
  // slot: y4-money
];
