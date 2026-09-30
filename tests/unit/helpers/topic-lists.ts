import type { Topic } from '../../../src/curriculum';
import {
  y2PlaceValue, y2Compare, y2Skip, y2Add, y2Sub, y2Three, y2Inverse, y2Tables, y2Fractions, y2Money, y2Time, y2Words, y2Order, y2Line,
  y2Shapes, y2Symmetry, y2Patterns, y2Position, y2Length, y2Mass, y2Capacity, y2Temp, y2Duration, y2Balance, y2Stats, y2Spelling, y2Contractions,
  y2Suffix, y2SuffixRoot, y2Homophones, y2WordClass, y2SentenceType, y2Tense, y2Punct, y2Sentence, y2Trace,
} from '../../../src/curriculum/year2';
import { y2OddEven } from '../../../src/curriculum/year2-oddeven';

// The per-topic lists a new topic adds itself to (#1411). They live here, not in `curriculum.test.ts`, because that
// file is frozen at its length (#1388) and a list cannot be moved to a new file one line at a time. `add-topic` says
// which list a topic goes in.

/** `YEAR2_TOPICS`'s ids, in order (#889): a move or a reorder of the registry cannot pass silently. */
export const Y2_IDS = [
  'y2-pv', 'y2-compare', 'y2-skip', 'y2-add', 'y2-sub', 'y2-three', 'y2-inverse', 'y2-tables', 'y2-oddeven',
  'y2-fractions', 'y2-money', 'y2-time', 'y2-words', 'y2-order', 'y2-line', 'y2-shapes', 'y2-symmetry',
  'y2-patterns', 'y2-position', 'y2-length', 'y2-mass', 'y2-capacity', 'y2-temp', 'y2-duration', 'y2-balance',
  'y2-stats', 'y2-spelling', 'y2-contractions', 'y2-suffix', 'y2-suffix-root', 'y2-homophones', 'y2-wordclass',
  'y2-sentencetype', 'y2-tense', 'y2-punct', 'y2-sentence', 'y2-trace',
];

/**
 * An independent id → generator listing that must agree with `year2-topics.ts`'s own wiring (#1320): the generic
 * loop cannot tell a `gen:` swapped between two similarly-shaped topics from the right one.
 */
export const Y2_GENS: Record<string, Topic['gen']> = {
  'y2-pv': y2PlaceValue, 'y2-compare': y2Compare, 'y2-skip': y2Skip, 'y2-add': y2Add, 'y2-sub': y2Sub,
  'y2-three': y2Three, 'y2-inverse': y2Inverse, 'y2-tables': y2Tables, 'y2-oddeven': y2OddEven, 'y2-fractions': y2Fractions,
  'y2-money': y2Money, 'y2-time': y2Time, 'y2-words': y2Words, 'y2-order': y2Order, 'y2-line': y2Line,
  'y2-shapes': y2Shapes, 'y2-symmetry': y2Symmetry, 'y2-patterns': y2Patterns, 'y2-position': y2Position, 'y2-length': y2Length,
  'y2-mass': y2Mass, 'y2-capacity': y2Capacity, 'y2-temp': y2Temp, 'y2-duration': y2Duration, 'y2-balance': y2Balance,
  'y2-stats': y2Stats, 'y2-spelling': y2Spelling, 'y2-contractions': y2Contractions, 'y2-suffix': y2Suffix, 'y2-suffix-root': y2SuffixRoot,
  'y2-homophones': y2Homophones, 'y2-wordclass': y2WordClass, 'y2-sentencetype': y2SentenceType, 'y2-tense': y2Tense, 'y2-punct': y2Punct,
  'y2-sentence': y2Sentence, 'y2-trace': y2Trace,
};

/**
 * The (topic, difficulty) cells where grouping by option set can prove nothing, because no option set
 * is ever drawn twice with two different answers — so every group holds one answer and comparing
 * within a group compares a card with itself.
 *
 * **This is structural, not a seed accident**, which is why it is a named list rather than more draws:
 * wherever the distractors are derived from the answer (`nearby`, coin neighbours, near-miss spellings,
 * a shuffled sentence's own words) a given option set can only ever occur with the answer it was built
 * from. More draws move a handful of cells off the list without touching the reason — at 3,000 draws per
 * cell 42 are still blind — so the list is tied to `DRAWS` and to the seed above, and is asserted in both
 * directions below so it cannot quietly rot.
 *
 * It is the honest record of what this rail does **not** defend. `y1-coins` d3 is on it, and `y1-coins`
 * is one of the six topics #369 was filed about: on that difficulty every card is one where `q.wide`
 * alone decides the on-screen width, and restoring the old derivation there leaves this suite green.
 * Closing that needs a check of a different shape, which #482 carries.
 *
 * `r-build` d2's decoys are near-miss spellings of the answer too, the same structural reason `r-build`
 * d3 is already here — d2 only stayed off the list because a smaller `CVC` pool makes an overlap less
 * likely at this seed and `DRAWS`, and #874 shrank it by four words (the wrongly-pictured entries).
 */
export const NO_REPEATED_SET = new Set([
'r-order d1', 'r-order d2', 'r-order d3', 'r-share d2', 'r-share d3',
'r-build d2', 'r-build d3', 'r-sentence d1', 'r-sentence d2', 'r-sentence d3',
'y1-skip d1', 'y1-skip d2', 'y1-skip d3', 'y1-order d1', 'y1-order d2', 'y1-order d3',
'y1-coins d3', 'y1-shapes d3', 'y1-plurals d1', 'y1-punct d1', 'y1-days d3',
'y1-sentence d1', 'y1-sentence d2', 'y1-sentence d3',
'y2-skip d1', 'y2-skip d2', 'y2-skip d3', 'y2-order d1', 'y2-order d2', 'y2-order d3',
'y2-add d3', 'y2-tables d1', 'y2-line d2', 'y2-line d3',
'y2-money d1', 'y2-money d2', 'y2-money d3', 'y2-time d1', 'y2-time d2', 'y2-time d3',
'y2-words d1', 'y2-words d2', 'y2-words d3', 'y2-duration d1', 'y2-duration d3',
'y2-suffix-root d1', 'y2-sentence d1', 'y2-sentence d2', 'y2-sentence d3',
]);
