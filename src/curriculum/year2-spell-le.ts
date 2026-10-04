// y2-spell-le (#1010): the /l/ or /əl/ ending of English Appendix 1, Year 2 — table, camel, animal, pencil. The child
// hears the word, sees it in a gap sentence and slices the right spelling; each wrong bubble is the same stem with
// another ending, and every one is an invented non-word.
//
// Left out on purpose, because the word has a common homophone and a card saying it would have two right answers:
// pedal/peddle, medal/meddle, metal/mettle, petal/peddle, idle/idol, bridle/bridal. A decoy is never a real word
// either (`REAL_LOOKALIKES`, `GAP_WORDS`, `AVOID`, `HOMOPHONE_SETS`); "apple" is out too, since `appal` is real.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

export const LE_BANK: readonly SpellRuleRow[] = [
  ['table', 'We eat our dinner at the ___.', ['tabel', 'tabal', 'tabil']],
  ['bottle', 'She filled her ___ with water.', ['bottel', 'bottal', 'bottil']],
  ['little', 'A ___ mouse hid under the bed.', ['littel', 'littal', 'littil']],
  ['middle', 'Stand in the ___ of the line.', ['middel', 'middal', 'middil']],
  ['candle', 'Mum lit a ___ on the cake.', ['candel', 'candal', 'candil']],
  ['puzzle', 'It took an hour to finish the ___.', ['puzzel', 'puzzal', 'puzzil']],
];
export const EL_BANK: readonly SpellRuleRow[] = [
  ['camel', 'A ___ has a hump on its back.', ['camle', 'camal', 'camil']],
  ['tunnel', 'The train went into the dark ___.', ['tunnle', 'tunnal', 'tunnil']],
  ['squirrel', 'The ___ buried a nut under the tree.', ['squirrle', 'squirral', 'squirril']],
  ['towel', 'Dry your hands on the ___.', ['towle', 'towal', 'towil']],
  ['travel', 'We ___ to the seaside by train.', ['travle', 'traval', 'travil']],
  ['tinsel', 'The tree was covered in shiny ___.', ['tinsle', 'tinsal', 'tinsil']],
];
export const AL_BANK: readonly SpellRuleRow[] = [
  ['animal', 'A rabbit is a furry ___.', ['animle', 'animel', 'animil']],
  ['hospital', 'The nurse works at the ___.', ['hospitle', 'hospitel', 'hospitil']],
  ['signal', 'The red light is a ___ to stop.', ['signle', 'signel', 'signil']],
  ['final', 'This is the ___ page of the book.', ['finle', 'finel', 'finil']],
];
export const IL_BANK: readonly SpellRuleRow[] = [
  ['pencil', 'I drew a cat with my ___.', ['pencle', 'pencel', 'pencal']],
  ['fossil', 'We found a ___ of a shell in the rock.', ['fossle', 'fossel', 'fossal']],
  ['nostril', 'You breathe in through each ___.', ['nostrle', 'nostrel', 'nostral']],
];

/** d1: -le, 3 bubbles · d2: adds -el, 4 bubbles · d3: adds -al and -il, 4 bubbles. */
export const y2SpellLe: Generator = (d, rng) =>
  spellRuleQ(rng, pick(rng, d === 1 ? LE_BANK : d === 2 ? [...LE_BANK, ...EL_BANK] : [...LE_BANK, ...EL_BANK, ...AL_BANK, ...IL_BANK]), d === 1 ? 3 : 4);
