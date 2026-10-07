// y4-prefix-not (#1158): English Appendix 1, Years 3–4, "More prefixes" — in- meaning "not" becomes il- before l,
// im- before m or p, ir- before r. Hand-curated: every root's "not" form follows the rule, and no root whose opposite
// takes un- or dis- is here. d1–d2 pick the prefix; d3 picks the whole word, every decoy an invented non-word.
// Not here: `patient` is a d1–d2 root only (`inpatient` is a real word), and roots whose "not" word is over nine
// letters (`impossible`, `incomplete`, `irresponsible`…) are d1–d2 only, since a whole word must fit a bubble.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type PrefixNotRow = [root: string, prefix: 'in' | 'il' | 'im' | 'ir'];

export const PREFIX_NOT_ROOTS: PrefixNotRow[] = [
  ['active', 'in'], ['correct', 'in'], ['visible', 'in'], ['complete', 'in'], ['direct', 'in'], ['formal', 'in'], ['edible', 'in'], ['secure', 'in'],
  ['legal', 'il'], ['legible', 'il'], ['logical', 'il'],
  ['possible', 'im'], ['patient', 'im'], ['perfect', 'im'], ['polite', 'im'], ['mature', 'im'], ['mortal', 'im'], ['pure', 'im'], ['mobile', 'im'],
  ['regular', 'ir'], ['relevant', 'ir'], ['responsible', 'ir'], ['replaceable', 'ir'],
];

const PREFIXES = ['in', 'il', 'im', 'ir'] as const;
/** A "not" word with a real-word look-alike among its decoys is left out of d3. */
const NO_WHOLE_WORD = new Set(['patient']);
const D3_MAX_LETTERS = 9;
const d3Roots = PREFIX_NOT_ROOTS.filter(([r, p]) => !NO_WHOLE_WORD.has(r) && (p + r).length <= D3_MAX_LETTERS);

const prefixCard = (rng: Rng, [root, prefix]: PrefixNotRow, bubbles: number): Question => {
  const others = PREFIXES.filter(p => p !== prefix);
  // The misconception is always "in-" before l, m, p or r, so a card on an il/im/ir root always offers `in`.
  const ds = prefix === 'in' ? shuffle(rng, others) : ['in', ...shuffle(rng, others.filter(p => p !== 'in'))];
  const q = wordQ(rng, `Which prefix makes the opposite of ${root}?`, prefix, ds.slice(0, bubbles - 1),
    { hint: `Look at the first letter of ${root}`, hintIsData: false });
  q.say = `Which prefix makes the opposite of ${root}?`;
  q.visual = { type: 'word', text: root };
  return q;
};

const d1 = (rng: Rng) => prefixCard(rng, pick(rng, PREFIX_NOT_ROOTS.filter(r => r[1] === 'in' || r[1] === 'im')), 3);
const d2 = (rng: Rng) => prefixCard(rng, pick(rng, PREFIX_NOT_ROOTS), 4);

const d3 = (rng: Rng): Question => {
  const [root, prefix] = pick(rng, d3Roots);
  const q = wordQ(rng, `Which spelling means not ${root}?`, prefix + root, PREFIXES.filter(p => p !== prefix).map(p => p + root),
    { hint: `Look at the first letter of ${root}`, hintIsData: false, wide: true });
  q.say = `Which spelling means not ${root}?`;
  return q;
};

export const y4PrefixNot: Generator = (d: Difficulty, rng) => (d === 1 ? d1 : d === 2 ? d2 : d3)(rng);
