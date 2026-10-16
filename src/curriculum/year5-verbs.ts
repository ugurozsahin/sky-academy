// y5-verbs (#1222): turning nouns and adjectives into verbs with -ate, -ise or -ify (English Appendix 2, Year 5). d1/d2 show
// the root on the card and the bubbles hold only the suffix; d3 gaps the verb in a sentence with the root not shown.
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, wordQ } from './util';

/** `[root, stem shown, suffix, sentence with {} where the gapped verb goes]`. stem + suffix is the verb. */
export type VerbRow = readonly [root: string, stem: string, suffix: string, sentence: string];

/** d1: the root takes the suffix whole, so the stem is the root. */
const SAME: VerbRow[] = [
  ['real', 'real', 'ise', 'Soon you will {} what it means.'],
  ['final', 'final', 'ise', 'We will {} the plan today.'],
  ['symbol', 'symbol', 'ise', 'A dove can {} peace.'],
  ['fossil', 'fossil', 'ise', 'Over time, bones can {} in rock.'],
  ['custom', 'custom', 'ise', 'You can {} your own robot.'],
  ['critic', 'critic', 'ise', 'It is unkind to {} a friend.'],
  ['humid', 'humid', 'ify', 'A machine will {} the air.'],
  ['just', 'just', 'ify', 'Can you {} your answer?'],
  ['origin', 'origin', 'ate', 'Many stories {} from old tales.'],
];
/** d2: the root loses or changes its ending before the suffix. */
const CHANGED: VerbRow[] = [
  ['simple', 'simpl', 'ify', 'We must {} the rules.'],
  ['beauty', 'beaut', 'ify', 'Flowers will {} the garden.'],
  ['pure', 'pur', 'ify', 'A filter will {} the water.'],
  ['glory', 'glor', 'ify', 'The crowd will {} the winners.'],
  ['memory', 'memor', 'ise', 'Try to {} the poem.'],
  ['apology', 'apolog', 'ise', 'Please {} to your sister.'],
  ['energy', 'energ', 'ise', 'A cold swim will {} you.'],
  ['summary', 'summar', 'ise', 'Can you {} the story?'],
  ['motive', 'motiv', 'ate', 'A prize will {} the team.'],
  ['vaccine', 'vaccin', 'ate', 'The nurse will {} the child.'],
  ['captive', 'captiv', 'ate', 'The magic show will {} the crowd.'],
];

export const VERB_BANK: readonly VerbRow[] = [...SAME, ...CHANGED];
export const VERB_SUFFIXES = ['ate', 'ise', 'ify'] as const;
/** Real words a wrong suffix could spell, so the bank must stay clear of these roots. Hand-read (notate, hyphenise, solidise). */
export const REAL_LOOKALIKES: ReadonlySet<string> = new Set(['notate', 'notify', 'hyphenate', 'hyphenise', 'solidify', 'solidise', 'classify', 'activise']);
const WORDS: Record<Difficulty, readonly VerbRow[]> = { 1: SAME, 2: CHANGED, 3: VERB_BANK };

export const verbOf = ([, stem, suffix]: VerbRow) => stem + suffix;
export const verbGap = ([, stem]: VerbRow) => stem + '___';

export const verbQ = (rng: Rng, row: VerbRow, sentence: boolean): Question => {
  const [root, , suffix, text] = row;
  const gapped = text.replace('{}', verbGap(row));
  return wordQ(rng, sentence ? 'Slice the ending that finishes the verb' : `Slice the ending: ${root} into ${verbGap(row)}`, suffix, VERB_SUFFIXES.filter(s => s !== suffix), {
    ...(sentence ? { visual: { type: 'sentence', text: gapped } } : {}),
    say: sentence ? text.replace('{}', verbOf(row)) : `Make ${root} into a verb.`,
    hint: 'Which ending makes it a verb?', hintIsData: false,
  });
};

export const y5Verbs: Generator = (difficulty, rng) => verbQ(rng, pick(rng, WORDS[difficulty]), difficulty === 3);
