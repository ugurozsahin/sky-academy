// y3-double (#1105): English Appendix 1 (p.11) — in a word of more than one syllable the last consonant doubles before a
// vowel suffix only when the last syllable is stressed (forgetting, but gardening). Hand-curated bank; each answer is
// computed from the stress mark, never stored. No root ends in -l (British English doubles travelled whatever the stress).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, wordQ } from './util';

export type DoubleRow = [root: string, suffix: 'ing' | 'ed', stressedLast: boolean];

export const DOUBLE_BANK: DoubleRow[] = [
  ['forget', 'ing', true], ['begin', 'ing', true], ['prefer', 'ed', true], ['admit', 'ed', true], ['regret', 'ed', true],
  ['permit', 'ed', true], ['upset', 'ing', true], ['forbid', 'ing', true], ['omit', 'ed', true], ['commit', 'ed', true],
  ['garden', 'ing', false], ['limit', 'ed', false], ['visit', 'ing', false], ['open', 'ing', false], ['happen', 'ed', false],
  ['gather', 'ed', false], ['target', 'ed', false], ['offer', 'ed', false], ['enter', 'ed', false], ['orbit', 'ed', false],
];

/** The spelling the rule computes. */
export const doubled = (root: string, suffix: string) => root + root.slice(-1) + suffix;
export const plain = (root: string, suffix: string) => root + suffix;
export const rightSpelling = ([root, suffix, stressed]: DoubleRow) => (stressed ? doubled : plain)(root, suffix);

const spellingCard = (rng: Rng, row: DoubleRow): Question => {
  const [root, suffix, stressed] = row;
  const wrong = (stressed ? plain : doubled)(root, suffix);
  return wordQ(rng, `${root} + ${suffix} = ?`, rightSpelling(row), [wrong],
    { say: `Add ${suffix} to ${root}. Which spelling is right?`, hint: 'Double the last letter only if the last part is said strongly', hintIsData: false });
};

const yesNoCard = (rng: Rng, row: DoubleRow): Question => {
  const [root, suffix, stressed] = row;
  return wordQ(rng, `${root} + ${suffix}: double the last letter?`, stressed ? 'yes' : 'no', [stressed ? 'no' : 'yes'],
    { say: `Add ${suffix} to ${root}. Do you double the last letter?`, hint: 'Say the word: is the last part the strong one?', hintIsData: false });
};

export const y3Double: Generator = (d: Difficulty, rng) => {
  const row = pick(rng, d === 1 ? DOUBLE_BANK.filter(r => r[2]) : DOUBLE_BANK);
  return d === 3 && rng() < 0.5 ? yesNoCard(rng, row) : spellingCard(rng, row);
};
