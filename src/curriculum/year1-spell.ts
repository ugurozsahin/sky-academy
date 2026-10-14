// Year 1 spelling-rule cards (#990, #991): the word is spoken, the child slices the right spelling of two
// curated non-word decoys. Split out of year1.ts, which is at the file-length ceiling.
import type { Generator } from './types';
import { pick, wordQ } from './util';

export const spellChoiceQ = (rng: () => number, word: string, decoys: string[]) =>
  wordQ(rng, 'Find the right spelling', word, decoys, { say: `Which is the right spelling of ${word}?`, listen: word, peek: true, hint: 'Slice the right spelling', hintIsData: false });
/**
 * Year 1 spelling rules, second half (#991): ai/oi inside a word but ay/oy at the end, -y endings, k (not c)
 * before e/i/y, ph and wh (English Appendix 1, Year 1). Same card as `y1SpellRules`; every decoy is a non-word
 * that breaks exactly its entry's rule, and none is a real word or a real word's spelling-twin (*wen*, *rein*).
 */
export type SpellRule2Family = 'ai' | 'ay' | 'oi' | 'oy' | 'y' | 'k' | 'ph' | 'wh';
export const Y1_SPELL_RULES2: [string, SpellRule2Family, [string, string]][] = [
  ['rain', 'ai', ['rayn', 'raen']], ['wait', 'ai', ['wayt', 'waet']], ['train', 'ai', ['trayn', 'traen']], ['snail', 'ai', ['snayl', 'snael']], ['tail', 'ai', ['tayl', 'teyl']],
  ['day', 'ay', ['dai', 'daye']], ['play', 'ay', ['plai', 'pley']], ['say', 'ay', ['sey', 'sai']], ['stay', 'ay', ['stai', 'stey']], ['tray', 'ay', ['trai', 'trae']],
  ['oil', 'oi', ['oyl', 'oel']], ['boil', 'oi', ['boyl', 'boel']], ['coin', 'oi', ['coyn', 'coen']], ['join', 'oi', ['joyn', 'joen']], ['point', 'oi', ['poynt', 'poent']],
  ['boy', 'oy', ['boi', 'boye']], ['toy', 'oy', ['toi', 'toye']], ['joy', 'oy', ['joi', 'joye']], ['enjoy', 'oy', ['enjoi', 'enjoye']], ['annoy', 'oy', ['annoi', 'annoye']],
  ['very', 'y', ['veree', 'veri']], ['happy', 'y', ['happee', 'happi']], ['funny', 'y', ['funnee', 'funni']], ['party', 'y', ['partee', 'parti']], ['family', 'y', ['familee', 'familie']],
  ['kit', 'k', ['cit', 'qit']], ['king', 'k', ['cing', 'qing']], ['keep', 'k', ['ceep', 'qeep']], ['kind', 'k', ['cind', 'qind']], ['skin', 'k', ['scin', 'sqin']],
  ['dolphin', 'ph', ['dolfin', 'dolfen']], ['alphabet', 'ph', ['alfabet', 'alfabit']], ['elephant', 'ph', ['elefant', 'elefent']], ['phone', 'ph', ['fone', 'foan']], ['photo', 'ph', ['foto', 'fotoe']],
  ['when', 'wh', ['wenn', 'wehn']], ['where', 'wh', ['wehre', 'waire']], ['which', 'wh', ['wihch', 'wich']], ['wheel', 'wh', ['weel', 'wehel']], ['whale', 'wh', ['wayl', 'waehl']],
];
export const y1SpellRules2: Generator = (d, rng) => {
  const families: SpellRule2Family[] = d === 1 ? ['ai', 'ay', 'oi', 'oy'] : d === 2 ? ['ai', 'ay', 'oi', 'oy', 'y', 'k'] : ['ai', 'ay', 'oi', 'oy', 'y', 'k', 'ph', 'wh'];
  const [w, , decoys] = pick(rng, Y1_SPELL_RULES2.filter(e => families.includes(e[1])));
  return spellChoiceQ(rng, w, decoys);
};
