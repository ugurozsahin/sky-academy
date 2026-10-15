// y4-origins (#1162): English Appendix 1, Years 3–4 — words whose spelling kept their origin: /k/ spelt ch (Greek),
// /ʃ/ spelt ch (French), -gue/-que (French), /s/ spelt sc (Latin), /eɪ/ spelt ei, eigh or ey. The child hears the
// word, sees it in a sentence with the family's letters gapped and slices them. The decoys are the spelling by sound.
//
// Left out on purpose, so a new bank row has to argue the same case (the test pins every assembled spelling):
//   vein, weigh, grey — a decoy spelling is a real homophone (vain, way, gray);
//   cheque, plague    — their ck / que decoys spell the real words "check" and "plaque";
//   echo              — its `c` decoy spells "eco", which dictionaries list;
//   unique            — its g and gue decoys hold the AVOID entry "nig", leaving two bubbles; boutique stands in;
//   reins             — one of the homophones y4-homophones teaches.
import type { Generator } from './types';
import { AVOID, pick, shuffle, wordQ } from './util';
import { REAL_LOOKALIKES } from './spelling-rules';

/** One bank row: letters before the gap, the answer, letters after it, and a sentence with `pre___post` in it. */
export type OriginsRow = readonly [pre: string, answer: string, post: string, sentence: string];

export const CH_K_BANK: readonly OriginsRow[] = [
  ['', 'ch', 'emist', 'The ___emist mixed two liquids.'],
  ['', 'ch', 'orus', 'The children sang in the ___orus.'],
  ['', 'ch', 'aracter', 'The hero is the main ___aracter in the book.'],
  ['s', 'ch', 'eme', 'We made a plan, a clever s___eme.'],
  ['s', 'ch', 'ool', 'We walk to s___ool every day.'],
  ['stoma', 'ch', '', 'I have a pain in my stoma___.'],
];
export const CH_SH_BANK: readonly OriginsRow[] = [
  ['', 'ch', 'ef', 'The ___ef cooked a big dinner.'],
  ['ma', 'ch', 'ine', 'The ma___ine washed the clothes.'],
  ['bro', 'ch', 'ure', 'Dad read the holiday bro___ure.'],
  ['para', 'ch', 'ute', 'She jumped out with a para___ute.'],
  ['mousta', 'ch', 'e', 'Grandad has a grey mousta___e.'],
];
export const GUE_QUE_BANK: readonly OriginsRow[] = [
  ['lea', 'gue', '', 'Our team is top of the lea___.'],
  ['ton', 'gue', '', 'A frog catches flies with its ton___.'],
  ['anti', 'que', '', 'The old clock is an anti___.'],
  ['bouti', 'que', '', 'Mum bought a dress in the bouti___.'],
];
export const SC_BANK: readonly OriginsRow[] = [
  ['', 'sc', 'ience', 'We did an experiment in ___ience.'],
  ['', 'sc', 'ene', 'The play had a funny ___ene.'],
  ['di', 'sc', 'ipline', 'A good team has di___ipline.'],
  ['fa', 'sc', 'inate', 'Magic tricks fa___inate me.'],
  ['cre', 'sc', 'ent', 'The moon was a thin cre___ent.'],
  ['', 'sc', 'issors', 'Cut the card with ___issors.'],
];
export const EI_BANK: readonly OriginsRow[] = [
  ['', 'eigh', 't', 'My brother is ___t years old.'],
  ['n', 'eigh', 'bour', 'Our n___bour waved from the fence.'],
  ['th', 'ey', '', 'Look at the toys th___ made.'],
  ['ob', 'ey', '', 'Dogs learn to ob___ their owners.'],
  ['w', 'eigh', 't', 'A feather has hardly any w___t.'],
  ['fr', 'eigh', 't', 'The fr___t train was very long.'],
];

type Family = { bank: readonly OriginsRow[]; pool: readonly string[] };
const CH_K: Family = { bank: CH_K_BANK, pool: ['ch', 'k', 'c'] };
const CH_SH: Family = { bank: CH_SH_BANK, pool: ['ch', 'sh', 's'] };
const GUE_QUE: Family = { bank: GUE_QUE_BANK, pool: ['gue', 'que', 'g', 'ck'] };
const SC: Family = { bank: SC_BANK, pool: ['sc', 's', 'c'] };
const EI: Family = { bank: EI_BANK, pool: ['ei', 'eigh', 'ey', 'ay'] };
export const FAMILIES: readonly Family[] = [CH_K, CH_SH, GUE_QUE, SC, EI];
/** The spelling-by-sound decoy every card of a family offers. */
export const PHONETIC: readonly string[] = ['k', 'sh', 'ck', 's', 'ay'];

/** Real words a decoy would spell (tong, check, plaque, eco, way …): such a decoy is dropped for that word. */
export const ORIGINS_REAL: ReadonlySet<string> = new Set([...REAL_LOOKALIKES, 'tong', 'check', 'plaque', 'eco', 'way']);

/** A decoy is dropped for a word when it spells a real word, or when the spelling holds an `AVOID` entry (unigue → nig). */
export const dropDecoy = (w: string): boolean => ORIGINS_REAL.has(w) || [...AVOID].some(a => w.includes(a));

/** d1: the two ch families · d2: adds sc and -gue/-que · d3: adds ei/eigh/ey. */
export const y4Origins: Generator = (d, rng) => {
  const fams = d === 1 ? [CH_K, CH_SH] : d === 2 ? [CH_K, CH_SH, SC, GUE_QUE] : FAMILIES;
  const fam = pick(rng, fams);
  const [pre, answer, post, sentence] = pick(rng, fam.bank);
  const decoys = fam.pool.filter(l => l !== answer && !dropDecoy(pre + l + post));
  return wordQ(rng, 'Which letters are missing?', answer, shuffle(rng, decoys), {
    visual: { type: 'sentence', text: sentence },
    say: `${pre}${answer}${post}. ${sentence.replace('___', answer)}`,
    hint: 'Slice the missing letters', hintIsData: false,
  });
};
