// "Which picture rhymes with cat?" (#972): Reception phonological awareness — spot a rhyme. Parked beside
// `reception.ts` like `reception-initial.ts`, so that file stays under its size budget.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** A rime and the two sounds a half-rhyme would share with it: its vowel sound and its final sound. */
export interface Rime { rime: string; vowel: string; end: string }
/** Hand-keyed, never derived from spelling: `ake` and `ock` share a final /k/, `og`/`ox`/`ock` a short /o/. */
export const R_RHYMES: Rime[] = [
  { rime: 'at', vowel: 'a', end: 't' }, { rime: 'og', vowel: 'o', end: 'g' }, { rime: 'en', vowel: 'e', end: 'n' },
  { rime: 'ake', vowel: 'ay', end: 'k' }, { rime: 'ee', vowel: 'ee', end: 'ee' }, { rime: 'ar', vowel: 'ar', end: 'ar' },
  { rime: 'ox', vowel: 'o', end: 'ks' }, { rime: 'ose', vowel: 'oh', end: 'z' }, { rime: 'ouse', vowel: 'ow', end: 's' },
  { rime: 'ock', vowel: 'o', end: 'k' },
];

/** [word, rime, emoji, Unicode short name]: every word is one syllable and a Reception child can picture it. */
export const R_RHYME_BANK: [string, string, string, string][] = [
  ['cat', 'at', '🐱', 'cat face'], ['hat', 'at', '🎩', 'top hat'], ['bat', 'at', '🦇', 'bat'],
  ['dog', 'og', '🐶', 'dog face'], ['frog', 'og', '🐸', 'frog'],
  ['hen', 'en', '🐔', 'chicken'], ['pen', 'en', '🖊️', 'pen'],
  ['cake', 'ake', '🎂', 'birthday cake'], ['snake', 'ake', '🐍', 'snake'],
  ['bee', 'ee', '🐝', 'honeybee'], ['tree', 'ee', '🌳', 'deciduous tree'],
  ['car', 'ar', '🚗', 'automobile'], ['star', 'ar', '⭐', 'star'],
  ['fox', 'ox', '🦊', 'fox'], ['box', 'ox', '📦', 'package'],
  ['nose', 'ose', '👃', 'nose'], ['rose', 'ose', '🌹', 'rose'],
  ['house', 'ouse', '🏠', 'house'], ['mouse', 'ouse', '🐭', 'mouse face'],
  ['sock', 'ock', '🧦', 'socks'], ['lock', 'ock', '🔒', 'locked'],
];

const key = (rime: string) => R_RHYMES.find(r => r.rime === rime)!;
/** A decoy rime shares neither the target's vowel sound nor its final sound (no half-rhymes). */
const clear = (a: Rime, b: Rime) => a.vowel !== b.vowel && a.end !== b.end;

export const rRhyme: Generator = (d, rng) => {
  const [word, rime] = pick(rng, R_RHYME_BANK);
  const target = key(rime);
  const mates = R_RHYME_BANK.filter(([w, r]) => r === rime && w !== word);
  const [, , right] = pick(rng, mates);
  const used = new Set<string>();
  const decoys: string[] = [];
  for (const [, r, e] of shuffle(rng, R_RHYME_BANK)) {
    if (decoys.length === d || used.has(r) || !clear(target, key(r))) continue;
    used.add(r); decoys.push(e);
  }
  const say = `Which picture rhymes with ${word}?`;
  return wordQ(rng, say, right, decoys, { visual: { type: 'word', text: word }, say, hint: `Say ${word}. Which picture ends with the same sound?`, hintIsData: false });
};
