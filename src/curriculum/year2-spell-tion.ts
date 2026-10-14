// y2-spell-tion (#1013): words ending in -tion, from English Appendix 1, Year 2 — station, motion, fiction. The child
// hears the word, sees it in a gap sentence and slices the right ending; every wrong bubble is an invented non-word
// that spells the "shun" sound with -sion, -shin or -shon instead.
//
// Left out on purpose: section, because its decoys start "sec-" and read too close to a crude word, and nation,
// because its -sion decoy "nasion" is a real (anatomical) word. Decoys run in the order -sion, -shin, -shon so d1
// can offer the first two and d2 all three.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

/** Two-syllable words. */
export const SHORT_BANK: readonly SpellRuleRow[] = [
  ['station', 'The train stopped at the ___.', ['stasion', 'stashin', 'stashon']],
  ['lotion', 'Mum put sun ___ on my arms.', ['losion', 'loshin', 'loshon']],
  ['potion', 'The wizard stirred a magic ___.', ['posion', 'poshin', 'poshon']],
  ['motion', 'The ball was in ___ down the hill.', ['mosion', 'moshin', 'moshon']],
  ['action', 'The film was full of ___.', ['acsion', 'akshin', 'akshon']],
];
/** Longer words. */
export const LONG_BANK: readonly SpellRuleRow[] = [
  ['fiction', 'A made-up story is called ___.', ['fiksion', 'fikshin', 'fikshon']],
  ['fraction', 'One half is a ___ of the pizza.', ['fracsion', 'frakshin', 'frakshon']],
  ['mention', 'Please do not ___ it to anyone.', ['mension', 'menshin', 'menshon']],
  ['caption', 'Write a ___ under the picture.', ['capsion', 'capshin', 'capshon']],
];

/** d1: two-syllable words, 3 bubbles · d2: 4 bubbles · d3: adds the longer words, 4 bubbles. */
export const y2SpellTion: Generator = (d, rng) => {
  const row = pick(rng, d < 3 ? SHORT_BANK : [...SHORT_BANK, ...LONG_BANK]);
  return spellRuleQ(rng, d === 1 ? [row[0], row[1], row[2].slice(0, 2)] : row, d === 1 ? 3 : 4);
};
