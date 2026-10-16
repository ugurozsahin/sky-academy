// y5-verbprefix (#1223): verb prefixes dis-, de-, mis-, over- and re- (English Appendix 2, Year 5). The child reads a
// meaning (d1) or a sentence (d2, d3) and slices the prefix that makes the verb. One root can take several prefixes as
// real words (reheat/overheat), so every root's five spellings are classified once in VERDICTS and a card only ever
// offers a spelling marked `nonword`; a `rival` (a real word) is never a bubble.
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, shuffle, wordQ } from './util';

export const PREFIXES = ['dis', 'de', 'mis', 'over', 're'] as const;
export type Prefix = typeof PREFIXES[number];

/** Per root, one letter for each of dis, de, mis, over, re (in that order): A = the answer, R = a rival real word, N = a non-word. */
export const VERDICTS: Readonly<Record<string, string>> = {
  frost: 'NANNN', rail: 'NANNR', flate: 'NANNR', fuse: 'NANRR', hydrate: 'NANRR',
  like: 'ANRNN', infect: 'ANNRR', qualify: 'ANNRR',
  judge: 'NNARR', understand: 'NNANN', pronounce: 'NNARR',
  sleep: 'NNNAN', flow: 'NRNAR', cook: 'NNRAR', eat: 'NNNAN', react: 'NNNAN',
  cycle: 'NRNNA', build: 'NNRRA', fill: 'NNRRA', wind: 'NNNRA',
};

/** `[root, prefix, meaning, sentence]`: the sentence gaps the prefix as `___`, and the inflected verb follows it (`___slept`). */
export type VerbPrefixRow = readonly [root: string, prefix: Prefix, meaning: string, sentence: string];

export const VERBPREFIX_BANK: readonly VerbPrefixRow[] = [
  ['frost', 'de', 'take the ice off', 'Dad will ___frost the car windscreen.'],
  ['rail', 'de', 'come off the track', 'The toy train will ___rail if the track is bent.'],
  ['flate', 'de', 'let the air out of', 'Mum had to ___flate the bike tyre.'],
  ['fuse', 'de', 'make a bomb safe', 'The hero had to ___fuse the bomb.'],
  ['hydrate', 'de', 'lose too much water', 'Plants ___hydrate in the hot sun.'],
  ['like', 'dis', 'not like', 'I ___like cold, wet days.'],
  ['infect', 'dis', 'clean so that germs are killed', 'Nurses ___infect their hands with gel.'],
  ['qualify', 'dis', 'not allow to take part', 'The referee will ___qualify any player who cheats.'],
  ['judge', 'mis', 'judge wrongly', 'I ___judged the distance and fell in the puddle.'],
  ['understand', 'mis', 'get the meaning wrong', 'Sam ___understood the rules and lost a point.'],
  ['pronounce', 'mis', 'say a word wrongly', 'Zoe ___pronounced the long word.'],
  ['sleep', 'over', 'sleep for too long', 'I ___slept and missed the bus.'],
  ['flow', 'over', 'flow over the top', 'The bath will ___flow if you leave the tap on.'],
  ['cook', 'over', 'cook for too long', 'Do not ___cook the pasta or it goes soft.'],
  ['eat', 'over', 'eat too much', 'We should not ___eat sweets.'],
  ['react', 'over', 'show too big a feeling', 'Do not ___react to a tiny spider.'],
  ['cycle', 're', 'use again', 'We ___cycle our old bottles at school.'],
  ['build', 're', 'build again', 'Max had to ___build his tower after it fell.'],
  ['fill', 're', 'fill again', 'Please ___fill my cup with milk.'],
  ['wind', 're', 'wind back to the start', 'Please ___wind the tape to the start.'],
];

const verdict = (root: string, p: Prefix) => VERDICTS[root][PREFIXES.indexOf(p)];
/** The prefixes whose spelling with this root is a non-word: the only ones a card may offer as a decoy. */
export const nonwords = (root: string): Prefix[] => PREFIXES.filter(p => verdict(root, p) === 'N');
/** The whole verb (`oversleep`), and the sentence with the prefix put back (`I overslept and missed the bus.`). */
export const vpVerb = ([root, prefix]: VerbPrefixRow) => prefix + root;
export const vpSentence = ([, prefix, , sentence]: VerbPrefixRow) => sentence.replace('___', prefix);

const ROWS: Record<Difficulty, readonly VerbPrefixRow[]> = {
  1: VERBPREFIX_BANK, 2: VERBPREFIX_BANK, 3: VERBPREFIX_BANK.filter(r => nonwords(r[0]).length >= 3),
};

export const verbPrefixQ = (rng: Rng, row: VerbPrefixRow, difficulty: Difficulty): Question => {
  const [root, prefix, meaning, sentence] = row;
  const ds = shuffle(rng, nonwords(root)).slice(0, difficulty === 3 ? 3 : 2);
  const gapped = difficulty === 1
    ? { prompt: `${meaning} = ___${root}`, say: `Blank-${root} means ${meaning}.` }
    : { prompt: 'Which prefix fits the gap?', say: sentence.replace('___', 'blank-'), visual: { type: 'sentence' as const, text: sentence } };
  return wordQ(rng, gapped.prompt, prefix, ds, { ...gapped, hint: 'Slice the prefix', hintIsData: false });
};

export const y5VerbPrefix: Generator = (difficulty, rng) => verbPrefixQ(rng, pick(rng, ROWS[difficulty]), difficulty);
