// Year 4 calculation strand (#1069). One topic so far (y4-tables); each remaining slot below is a future PR's own ticket.
import { y4Column } from './year4-column';
// import: y4-mistake
// import: y4-whichop
import { y4Tables, y4TablesQ } from './year4-tables';
import { y4Story } from './year4-story';
// import: y4-mental
import { y4FactorPairs } from './year4-factorpairs';
// import: y4-shortmult
// import: y4-story-md
import type { Topic } from './types';

export const Y4_CALC: Topic[] = [
  { id: 'y4-column', title: 'Column Add & Subtract', icon: '🗒️', subject: 'maths', year: 'year4', nc: 'Y4 A&S: column addition and subtraction to 4 digits; inverse to check', sequenceFrom: 1, gen: y4Column },
  // slot: y4-mistake
  { id: 'y4-story', title: 'Two-Step Problems', icon: '📝', subject: 'maths', year: 'year4', nc: 'Y4 A&S: two-step problems in contexts, deciding which operations to use', gen: y4Story },
  // slot: y4-whichop
  { id: 'y4-tables', title: 'Times Tables to 12 × 12', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: multiplication and division facts to 12 × 12', gen: y4Tables },
  { id: 'y4-tables-6', title: '6× table', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: 6 times table (4M13)', drill: true, gen: (d, rng) => y4TablesQ(d, rng, 6) },
  { id: 'y4-tables-7', title: '7× table', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: 7 times table (4M13)', drill: true, gen: (d, rng) => y4TablesQ(d, rng, 7) },
  { id: 'y4-tables-9', title: '9× table', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: 9 times table (4M13)', drill: true, gen: (d, rng) => y4TablesQ(d, rng, 9) },
  { id: 'y4-tables-11', title: '11× table', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: 11 times table (4M13)', drill: true, gen: (d, rng) => y4TablesQ(d, rng, 11) },
  { id: 'y4-tables-12', title: '12× table', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: 12 times table (4M13)', drill: true, gen: (d, rng) => y4TablesQ(d, rng, 12) },
  // slot: y4-mental
  { id: 'y4-factorpairs', title: 'Factor Pairs', icon: '🔗', subject: 'maths', year: 'year4', nc: 'Y4 M&D: factor pairs and commutativity in mental calculations (4M15)', gen: y4FactorPairs },
  // slot: y4-shortmult
  // slot: y4-story-md
];
