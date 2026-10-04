// The Year 2 topic registry (#889). Split out of year2.ts, which was at its #714 ratchet cap with no room
// for a new row: every new Year 2 topic adds an import and a registry line here, never in year2.ts.
// Import direction: this file imports from year2.ts and, later, from new year2-*.ts modules. Those modules
// may import from year2.ts; year2.ts never imports them back.
import type { Topic } from './types';
import {
  y2PlaceValue, y2Compare, y2Skip, y2Add, y2Sub, y2Three, y2Inverse, y2Tables, y2Fractions,
  y2Money, y2Time, y2Words, y2Order, y2Line, y2Shapes, y2Symmetry, y2Patterns, y2Position, y2Length,
  y2Mass, y2Capacity, y2Temp, y2Duration, y2Balance, y2Stats, y2Spelling, y2Contractions, y2Suffix,
  y2SuffixRoot, y2Homophones, y2SentenceType, y2Tense, y2Punct, y2Sentence, y2Trace,
} from './year2';
import { y2Related } from './year2-related';
import { y2OddEven } from './year2-oddeven';
import { y2Equiv } from './year2-equiv';
import { y2WordClass } from './year2-wordclass';
import { y2StoryAdd } from './year2-story-add';
import { y2AnyOrder } from './year2-anyorder';
import { y2StoryMoney } from './year2-story-money';
import { y2CoinCombo } from './year2-coincombo';
import { y2StoryTimes } from './year2-story-times';
import { y2Objects3d } from './year2-objects3d';
import { y2SpellKn } from './year2-spell-kn';
import { tableDrill } from './tables';

export const YEAR2_TOPICS: Topic[] = [
  // Year 2 maths
  { id: 'y2-pv', title: 'Tens & Ones', icon: '🔟', subject: 'maths', year: 'year2', nc: 'Y2 NPV: place value', gen: y2PlaceValue },
  { id: 'y2-compare', title: 'Compare < > =', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 NPV: compare to 100', gen: y2Compare },
  { id: 'y2-skip', title: 'Count in 2s, 3s, 5s, 10s', icon: '🦘', subject: 'maths', year: 'year2', nc: 'Y2 NPV: count in steps', gen: y2Skip },
  { id: 'y2-add', title: 'Adding to 100', icon: '➕', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit addition', gen: y2Add },
  { id: 'y2-sub', title: 'Subtracting', icon: '➖', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit subtraction', gen: y2Sub },
  { id: 'y2-related', title: 'Related Facts', icon: '🔗', subject: 'maths', year: 'year2', nc: 'Y2 A&S: derive and use related facts up to 100', gen: y2Related },
  { id: 'y2-three', title: 'Three Numbers', icon: '🎯', subject: 'maths', year: 'year2', nc: 'Y2 A&S: add three 1-digit', gen: y2Three },
  { id: 'y2-inverse', title: 'Missing Number', icon: '❓', subject: 'maths', year: 'year2', nc: 'Y2 A&S: inverse, missing number', gen: y2Inverse },
  { id: 'y2-story-add', title: 'Story Sums', icon: '📖', subject: 'maths', year: 'year2', nc: 'Y2 A&S: solve problems with addition and subtraction in context', gen: y2StoryAdd },
  { id: 'y2-anyorder', title: 'Swap It Round', icon: '🔁', subject: 'maths', year: 'year2', nc: 'Y2 A&S, M&D: addition and multiplication can be done in any order; subtraction and division cannot', gen: y2AnyOrder },
  { id: 'y2-tables', title: '2, 5, 10 Times Tables', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 2, 5, 10 tables ×÷', gen: y2Tables },
  { id: 'y2-tables-2', title: '2× table', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 2 times table', drill: true, gen: tableDrill(2) },
  { id: 'y2-tables-5', title: '5× table', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 5 times table', drill: true, gen: tableDrill(5) },
  { id: 'y2-tables-10', title: '10× table', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 10 times table', drill: true, gen: tableDrill(10) },
  { id: 'y2-story-times', title: 'Story Times', icon: '🍎', subject: 'maths', year: 'year2', nc: 'Y2 M&D: solve problems in contexts using the 2, 5 and 10 tables', gen: y2StoryTimes },
  { id: 'y2-oddeven', title: 'Odd or Even', icon: '🐾', subject: 'maths', year: 'year2', nc: 'Y2 M&D: odd and even', sequenceFrom: 2, gen: y2OddEven },
  { id: 'y2-fractions', title: 'Fractions', icon: '🍕', subject: 'maths', year: 'year2', nc: 'Y2 Fractions: 1/3 1/4 2/4 3/4', gen: y2Fractions },
  { id: 'y2-equiv', title: 'Same Fraction', icon: '🍕', subject: 'maths', year: 'year2', nc: 'Y2 Fractions: equivalence of 2/4 and 1/2', gen: y2Equiv },
  { id: 'y2-money', title: 'Money £ and p', icon: '💷', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: money, change', gen: y2Money },
  { id: 'y2-story-money', title: 'Shop Stories', icon: '🍎', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: money problems in a practical context, including change', gen: y2StoryMoney },
  { id: 'y2-coincombo', title: 'Coin Combinations', icon: '💰', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: find different combinations of coins that equal the same amounts of money', gen: y2CoinCombo },
  { id: 'y2-time', title: 'Telling Time', icon: '🕔', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: time to 5 min', gen: y2Time },
  { id: 'y2-words', title: 'Number Words', icon: '🔤', subject: 'maths', year: 'year2', nc: 'Y2 NPV: numbers to 100 in words', gen: y2Words },
  { id: 'y2-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'year2', nc: 'Y2 NPV: order numbers to 100', sequenceFrom: 1, gen: y2Order },
  { id: 'y2-line', title: 'Number Line', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 NPV: number line, steps', gen: y2Line },
  { id: 'y2-shapes', title: '3-D Shapes', icon: '🎲', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: 3-D shapes — faces, edges, vertices', gen: y2Shapes },
  { id: 'y2-objects3d', title: 'Shapes Around Us', icon: '🥁', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: compare and sort common 3-D shapes and everyday objects', gen: y2Objects3d },
  { id: 'y2-symmetry', title: 'Mirror Lines', icon: '🦋', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: line symmetry in a vertical line', gen: y2Symmetry },
  { id: 'y2-patterns', title: 'What Comes Next?', icon: '🔁', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: order and arrange objects in patterns and sequences', gen: y2Patterns },
  { id: 'y2-position', title: 'Turns & Right Angles', icon: '🧭', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: position, direction, rotation as right angles', gen: y2Position },
  { id: 'y2-length', title: 'Length: cm & m', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: length (cm/m)', gen: y2Length },
  { id: 'y2-mass', title: 'Mass: g & kg', icon: '🏋️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: mass (g/kg)', gen: y2Mass },
  { id: 'y2-capacity', title: 'Capacity: ml & l', icon: '🥤', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: capacity (ml/l)', gen: y2Capacity },
  { id: 'y2-temp', title: 'Temperature', icon: '🌡️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: temperature (°C)', gen: y2Temp },
  { id: 'y2-duration', title: 'Time & Durations', icon: '⏳', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: compare and sequence intervals of time', gen: y2Duration },
  { id: 'y2-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 A&S: equivalence, inverse, tables', gen: y2Balance },
  { id: 'y2-stats', title: 'Charts & Tallies', icon: '📊', subject: 'maths', year: 'year2', nc: 'Y2 Statistics: pictograms, tally charts, block diagrams', gen: y2Stats },
  // Year 2 writing
  { id: 'y2-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year2', nc: 'Y2 common exception words', sequenceFrom: 3, gen: y2Spelling },
  { id: 'y2-contractions', title: "Contractions don't", icon: '✂️', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: contractions', gen: y2Contractions },
  { id: 'y2-suffix', title: 'Endings -ful -ly', icon: '🎀', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes', gen: y2Suffix },
  { id: 'y2-suffix-root', title: 'Changing Endings', icon: '🔁', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes that change the root (drop e, double, y→i)', gen: y2SuffixRoot },
  { id: 'y2-homophones', title: 'Sound-alike Words', icon: '👂', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: homophones', gen: y2Homophones },
  { id: 'y2-spell-kn', title: 'Silent Letters', icon: '🤫', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: /n/ spelt kn and gn, /r/ spelt wr at the start of words', gen: y2SpellKn },
  { id: 'y2-wordclass', title: 'Word Detective', icon: '🔍', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: nouns, verbs, adjectives, adverbs', sequenceFrom: 2, gen: y2WordClass },
  { id: 'y2-sentencetype', title: 'Sentence Types', icon: '💬', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: statements, questions, commands and exclamations', gen: y2SentenceType },
  { id: 'y2-tense', title: 'Then & Now', icon: '⏳', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: present and past tense, including the progressive', gen: y2Tense },
  { id: 'y2-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: commas, apostrophes', gen: y2Punct },
  { id: 'y2-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year2', nc: 'Y2 Writing: word order, conjunctions, noun phrases', sequenceFrom: 1, gen: y2Sentence },
  { id: 'y2-trace', title: 'Trace Words', icon: '✍️', subject: 'writing', year: 'year2', nc: 'Y2 Handwriting', input: 'tracing', gen: y2Trace },
];
