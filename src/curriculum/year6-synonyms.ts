// y6-synonyms (#1278): synonyms and antonyms (English Appendix 2, Year 6: how words are related by meaning). d1 picks the
// synonym of a word, d2 its antonym, d3 does either inside a sentence, the word in capitals, as a thesaurus would be used.
// Every row is its own meaning family, so a decoy borrowed from another row is never a synonym or antonym of the headword.
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** [word, synonym, antonym, sentence with the word once, meaning family]. No headword has two common senses (light, old, fair, hard…). */
export type SynRow = [word: string, synonym: string, antonym: string, sentence: string, family: string];

export const SYN_ANT: SynRow[] = [
  ['big', 'large', 'little', 'The big dog barked.', 'size'],
  ['quick', 'rapid', 'slow', 'The quick runner won the race.', 'speed'],
  ['hot', 'boiling', 'cold', 'The soup was hot.', 'temperature'],
  ['happy', 'cheerful', 'sad', 'The happy child sang.', 'mood'],
  ['strong', 'powerful', 'weak', 'The strong man lifted the box.', 'strength'],
  ['loud', 'noisy', 'quiet', 'The loud band played on.', 'loudness'],
  ['young', 'youthful', 'elderly', 'The young girl smiled.', 'age'],
  ['cheap', 'affordable', 'costly', 'The cheap hat was in the sale.', 'cost'],
  ['easy', 'simple', 'difficult', 'The easy puzzle took a minute.', 'difficulty'],
  ['wet', 'damp', 'dry', 'The wet towel hung outside.', 'wetness'],
  ['brave', 'courageous', 'cowardly', 'The brave knight fought on.', 'bravery'],
  ['far', 'distant', 'near', 'The far hill was misty.', 'distance'],
  ['clean', 'spotless', 'dirty', 'The clean shirt was white.', 'cleanliness'],
  ['empty', 'vacant', 'full', 'The empty box rattled.', 'fullness'],
  ['begin', 'start', 'finish', 'We begin at nine.', 'beginning'],
  ['buy', 'purchase', 'sell', 'I will buy a ticket.', 'trade'],
  ['arrive', 'reach', 'depart', 'The train will arrive soon.', 'travel'],
  ['safe', 'protected', 'dangerous', 'The safe bridge held firm.', 'safety'],
  ['rough', 'bumpy', 'smooth', 'The rough road shook the bus.', 'texture'],
];

/** One word from each of n other rows: each is from another family, so it relates to the headword in neither way. */
function fromOthers(rng: Parameters<Generator>[1], row: SynRow, n: number): string[] {
  return shuffle(rng, SYN_ANT.filter(r => r !== row)).slice(0, n).map(r => pick(rng, [r[0], r[1], r[2]]));
}

export const y6Synonyms: Generator = (d: Difficulty, rng) => {
  const row = pick(rng, SYN_ANT);
  const [word, syn, ant, sentence] = row;
  if (d === 1) {
    return wordQ(rng, `Which word is a synonym of ${word}?`, syn, [ant, ...fromOthers(rng, row, 1)], {
      say: `Which word is a synonym of ${word}?`, hint: 'A synonym means the same', hintIsData: false,
    });
  }
  if (d === 2) {
    return wordQ(rng, `Which word is an antonym of ${word}?`, ant, [syn, ...fromOthers(rng, row, 2)], {
      say: `Which word is an antonym of ${word}?`, hint: 'An antonym means the opposite', hintIsData: false,
    });
  }
  const same = rng() < 0.5;
  const upper = word.toUpperCase();
  const text = sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), upper);
  const stem = same ? `Which word means the same as ${upper} here?` : `Which word means the opposite of ${upper} here?`;
  return wordQ(rng, stem, same ? syn : ant, [same ? ant : syn, ...fromOthers(rng, row, 2)], {
    visual: { type: 'sentence', text }, say: `${sentence} ${same ? `Which word means the same as ${word} here?` : `Which word means the opposite of ${word} here?`}`,
    hint: same ? 'Pick the word that means the same' : 'Pick the word that means the opposite', hintIsData: false,
  });
};
