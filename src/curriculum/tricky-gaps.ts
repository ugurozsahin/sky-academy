// The tricky letter of a common exception word, and the misspellings a child writes there (#2277).
import { type Rng } from './types';
import { gapLetters, gapDecoys, gapQ } from './util';

/** word → [index of the letter that breaks the rule, the letters a child writes instead, likeliest first]. */
export const TRICKY: Readonly<Record<string, readonly [number, string]>> = {
  // Year 1
  said: [1, 'eoui'], says: [1, 'eio'], were: [1, 'aio'], was: [1, 'oue'], they: [2, 'aio'], love: [1, 'ui'], come: [1, 'uai'],
  some: [1, 'uai'], put: [1, 'oia'], push: [1, 'oea'], pull: [1, 'oie'], full: [1, 'oie'], friend: [2, 'eau'], school: [1, 'khs'],
  house: [2, 'woa'], our: [1, 'oea'], do: [1, 'uea'],
  // Year 2
  door: [2, 'auw'], floor: [3, 'auw'], poor: [2, 'uae'], because: [2, 'kzs'], find: [1, 'yau'], kind: [1, 'yau'], mind: [1, 'yau'],
  behind: [3, 'yau'], child: [2, 'yau'], wild: [1, 'yau'], climb: [4, 'mnp'], most: [1, 'uae'], old: [0, 'au'], cold: [1, 'au'],
  gold: [1, 'au'], hold: [1, 'au'], told: [1, 'au'], every: [2, 'aio'], great: [2, 'aio'], break: [2, 'aio'], pretty: [2, 'iao'],
  beautiful: [2, 'oei'], father: [1, 'oeu'], class: [2, 'oeu'], grass: [2, 'oeu'], pass: [1, 'oeu'], path: [1, 'oeu'], bath: [1, 'oeu'],
  fast: [1, 'oeu'], past: [1, 'oeu'], after: [0, 'oeu'], move: [1, 'uai'], prove: [2, 'uai'], improve: [4, 'uai'],
  sure: [0, 'czj'], sugar: [0, 'czj'], could: [2, 'aio'], should: [3, 'aio'], would: [2, 'aio'], any: [0, 'eio'], many: [1, 'eio'],
  busy: [1, 'iea'], people: [2, 'eau'], water: [1, 'oeu'], again: [3, 'eao'], half: [2, 'rns'], money: [1, 'uai'],
};

/** Rare real words a decoy could spell that `GAP_WORDS`/`AVOID` do not hold. */
export const RARE_REAL: ReadonlySet<string> = new Set(['fend', 'mend', 'weld', 'geld', 'held', 'eld', 'lave', 'pish', 'puss', 'must', 'mast', 'lost', 'lest', 'lust', 'mist', 'list', 'fest', 'pall', 'pell', 'pith', 'gild', 'wold', 'doer', 'pash', 'poss', 'fust', 'hoise']);

/** Five candidate decoys (`gapQ` deals three of them): the plausible misspellings first, then any other letter that spells no real word. */
export function trickyDecoys(word: string): string[] {
  const [idx, wrong] = TRICKY[word];
  const safe = gapDecoys(word, idx, gapLetters(word, idx)).filter(l => !RARE_REAL.has(word.slice(0, idx) + l + word.slice(idx + 1)));
  const plausible = gapDecoys(word, idx, wrong.split('')).filter(l => safe.includes(l));
  const vowel = (l: string) => 'aeiou'.includes(l) === 'aeiou'.includes(word[idx]);   // a vowel gap pads with vowels, not "wbre"
  // Every real-word vowel swap of put/pull is filtered, so a vowel gap tops up with "y" before it falls back to a consonant.
  const vowelGap = 'aeiou'.includes(word[idx]);
  return [...new Set([...plausible, ...safe.filter(vowel), ...(vowelGap ? safe.filter(l => l === 'y') : []), ...safe])].slice(0, 5);
}

/** A missing-letter card whose gap is the word's tricky letter. */
export const trickyGap = (rng: Rng, word: string): ReturnType<typeof gapQ> =>
  gapQ(rng, word, TRICKY[word][0], trickyDecoys(word), undefined, `Which letter is missing from the word ${word}?`);
