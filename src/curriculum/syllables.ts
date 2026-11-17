// "How many beats?" (#974): count the syllables in a spoken word. One generator, registered for Reception
// (1–2 beat words) and Year 1 (1–3). Hand-keyed bank — there is no syllable algorithm, so the oracle is the table.
// Words whose count varies by accent (flower, fire, strawberry) are left out. Every glyph is Emoji 12.0 or lower.
import type { Difficulty, Question, Rng } from './types';
import { numQ, pick } from './util';

export type BeatWord = readonly [word: string, beats: number, emoji: string];

export const BEAT_WORDS: readonly BeatWord[] = [
  ['cat', 1, '🐱'], ['dog', 1, '🐶'], ['sun', 1, '☀️'], ['fish', 1, '🐟'], ['tree', 1, '🌳'], ['ball', 1, '⚽'],
  ['cake', 1, '🎂'], ['star', 1, '⭐'], ['bee', 1, '🐝'], ['frog', 1, '🐸'],
  ['rabbit', 2, '🐰'], ['pencil', 2, '✏️'], ['monkey', 2, '🐒'], ['tiger', 2, '🐯'], ['apple', 2, '🍎'],
  ['spider', 2, '🕷️'], ['candle', 2, '🕯️'], ['rocket', 2, '🚀'], ['turtle', 2, '🐢'], ['penguin', 2, '🐧'],
  ['elephant', 3, '🐘'], ['banana', 3, '🍌'], ['octopus', 3, '🐙'], ['tomato', 3, '🍅'], ['butterfly', 3, '🦋'],
  ['umbrella', 3, '☂️'], ['dinosaur', 3, '🦕'], ['kangaroo', 3, '🦘'], ['potato', 3, '🥔'], ['crocodile', 3, '🐊'],
];

/** #2318: where each word breaks when clapped, for the `why` line. Words of one beat are not split. */
export const BEAT_SPLIT: Record<string, string> = {
  rabbit: 'rab-bit', pencil: 'pen-cil', monkey: 'mon-key', tiger: 'ti-ger', apple: 'ap-ple', spider: 'spi-der',
  candle: 'can-dle', rocket: 'rock-et', turtle: 'tur-tle', penguin: 'pen-guin', elephant: 'el-e-phant',
  banana: 'ba-na-na', octopus: 'oc-to-pus', tomato: 'to-ma-to', butterfly: 'but-ter-fly', umbrella: 'um-brel-la',
  dinosaur: 'di-no-saur', kangaroo: 'kan-ga-roo', potato: 'po-ta-to', crocodile: 'croc-o-dile',
};

/** Highest option shown at each difficulty, and the longest word drawn, per year (`maxBeats` 2 = Reception). */
const optionCeiling = (maxBeats: number, d: Difficulty) => (maxBeats === 2 ? (d === 1 ? 2 : 3) : d === 3 ? 4 : 3);
const wordCeiling = (maxBeats: number, d: Difficulty) => (maxBeats === 2 || d === 1 ? 2 : 3);

export function syllableQ(rng: Rng, d: Difficulty, maxBeats: 2 | 3): Question {
  const [word, beats, emoji] = pick(rng, BEAT_WORDS.filter(w => w[1] <= wordCeiling(maxBeats, d)));
  // The word is in the prompt on purpose: `repeatKey` ignores a `word` visual, so a constant prompt would make
  // the session refuse every card sharing the previous answer (#390).
  const top = optionCeiling(maxBeats, d);
  const distractors = Array.from({ length: top }, (_, i) => i + 1).filter(n => n !== beats);
  return numQ(rng, `How many beats in ${word}?`, beats, {
    min: 1, max: top, n: top - 1, distractors,
    say: `${word}. How many beats in ${word}?`,
    visual: { type: 'word', text: word, emoji },
    why: beats === 1 ? `${word} is one beat: clap once.` : `${BEAT_SPLIT[word]}: clap ${beats} times.`,
  });
}
