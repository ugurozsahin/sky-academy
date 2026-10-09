// y5-cious (#1218): the Year 5–6 endings /ʃəs/ (-cious, -tious) and /ʃəl/ (-cial, -tial), English Appendix 1 p.18.
// The word stays on the card with its ending gapped; the bubbles hold only the ending (13 px floor, `bubbles.ts`).
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, shuffle, wordQ } from './util';

/** `[stem, ending, allowed decoy endings, sentence with the word's ending gapped, root clue]`. */
export type CiousRow = readonly [stem: string, ending: string, decoys: readonly string[], sentence: string, clue?: string];

/**
 * Real words met while curating: stem + ending is a word, so no card may offer it as a wrong spelling.
 * **Not** `AVOID` — that set means "crude" (`tests/unit/curriculum.test.ts`).
 */
export const REAL_LOOKALIKES: ReadonlySet<string> = new Set(['officious', 'specious']);

const CT = ['cious', 'tious', 'xious'];
/** d1: -cious/-tious words with a root the child can read (vice → vicious; caution → cautious). */
const CLUED: CiousRow[] = [
  ['vi', 'cious', CT, 'The dog gave a vi___ growl.', 'vice'],
  ['gra', 'cious', CT, 'The queen was gra___ to her guests.', 'grace'],
  ['spa', 'cious', CT, 'We have a spa___ garden.', 'space'],
  ['mali', 'cious', CT, 'It was a mali___ lie.', 'malice'],
  ['ambi', 'tious', CT, 'My sister is ambi___ and works hard.', 'ambition'],
  ['cau', 'tious', CT, 'Be cau___ on the icy path.', 'caution'],
  ['ficti', 'tious', CT, 'Dragons are ficti___ creatures.', 'fiction'],
  ['infec', 'tious', CT, 'A cold is infec___ so wash your hands.', 'infection'],
  ['nutri', 'tious', CT, 'Fruit is nutri___ and good for you.', 'nutrition'],
];
/** d2: -cial/-tial words — -cial after a vowel letter, -tial after a consonant letter. */
const SOUND_L: CiousRow[] = [
  ['offi', 'cial', ['tial', 'tious', 'xious'], 'The offi___ opening is at noon.'],
  ['spe', 'cial', ['tial', 'tious', 'xious'], 'Today is a spe___ day.'],
  ['artifi', 'cial', ['tial', 'tious', 'xious'], 'The flowers are artifi___, not real.'],
  ['par', 'tial', ['cial', 'cious', 'tious'], 'The sun was in par___ eclipse.'],
  ['confiden', 'tial', ['cial', 'cious', 'tious'], 'The letter is confiden___, so keep it safe.'],
  ['essen', 'tial', ['cial', 'cious', 'tious'], 'Water is essen___ for plants.'],
];
/** d3 adds the rest of the p.18 words and the exceptions (anxious, initial, financial, commercial, provincial). */
const REST: CiousRow[] = [
  ['pre', 'cious', CT, 'The ring is very pre___ to her.'],
  ['cons', 'cious', CT, 'He was cons___ after the fall.'],
  ['deli', 'cious', CT, 'The soup was deli___.'],
  ['suspi', 'cious', CT, 'The cat was suspi___ of the dog.'],
  ['an', 'xious', CT, 'I felt an___ before the test.'],
  ['ini', 'tial', ['cial', 'cious', 'tious'], 'Write your ini___ in the box.'],
  ['finan', 'cial', ['tial', 'tious', 'xious'], 'The bank gives finan___ advice.'],
  ['commer', 'cial', ['tial', 'tious', 'xious'], 'We saw a commer___ on the television.'],
  ['provin', 'cial', ['tial', 'tious', 'xious'], 'The provin___ town is far from the capital.'],
];

/** The decoy lists above may name the answer's own ending (`CT` is shared); the bank drops it from each. */
export const CIOUS_BANK: CiousRow[] = [...CLUED, ...SOUND_L, ...REST].map(([s, e, ds, ...r]) => [s, e, ds.filter(d => d !== e), ...r]);
const WORDS: Record<Difficulty, CiousRow[]> = { 1: CIOUS_BANK.slice(0, CLUED.length), 2: CIOUS_BANK.slice(CLUED.length, CLUED.length + SOUND_L.length), 3: CIOUS_BANK };

export const ciousQ = (rng: Rng, row: CiousRow, bubbles: number, showClue: boolean): Question => {
  const [stem, ending, decoys, sentence, clue] = row;
  const word = stem + ending;
  // Two-bubble cards stay inside the ending's own pair (-cious/-tious or -cial/-tial); only d3 mixes in the rest.
  const pair = decoys.filter(d => bubbles > 2 || d !== 'xious' && d.slice(-3) === ending.slice(-3));
  return wordQ(rng, showClue && clue ? `Clue: ${clue}. Which ending?` : 'Which ending is right?', ending, shuffle(rng, pair).slice(0, bubbles - 1), {
    visual: { type: 'sentence', text: sentence },
    say: `${sentence.replace('___', ending)} Which ending spells ${word}?`,
    hint: 'Slice the right ending', hintIsData: false,
  });
};

export const y5Cious: Generator = (difficulty, rng) =>
  ciousQ(rng, pick(rng, WORDS[difficulty]), difficulty >= 3 ? 3 : 2, difficulty === 1);
