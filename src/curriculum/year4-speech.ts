// y4-speech (#1167): the marks around direct speech — the comma after a reporting clause, the end mark inside the inverted
// commas (English Appendix 2, Year 4). Every card is one gapped sentence; the child slices the mark that belongs in the gap.
import type { Generator } from './types';
import { pick, wordQ } from './util';

/** One bank row: who speaks, the reporting verb, the spoken words without their end mark, and the end mark they take. */
export type SpeechRow = readonly [who: string, verb: string, words: string, end: '.' | '?' | '!'];

export const STATEMENTS: readonly SpeechRow[] = [
  ['Tom', 'said', "I'm hungry", '.'], ['Mum', 'said', 'Dinner is ready', '.'], ['Gran', 'said', 'We are going to the zoo', '.'],
  ['Dad', 'replied', 'It is time for bed', '.'], ['Ben', 'said', 'I like your hat', '.'], ['Mia', 'replied', 'I have lost my shoe', '.'],
];
export const QUESTIONS: readonly SpeechRow[] = [
  ['Mum', 'asked', 'Are you ready', '?'], ['Tom', 'asked', 'Where is my coat', '?'], ['The teacher', 'asked', 'Who has the book', '?'],
  ['Gran', 'asked', 'Can I help you', '?'], ['Sam', 'asked', 'What is for tea', '?'], ['Mia', 'asked', 'Do you like pizza', '?'],
];
/** d1 only: an exclamation may end in `!` or `.`, so it never sits at an end-of-speech gap. */
export const EXCLAMATIONS: readonly SpeechRow[] = [
  ['The conductor', 'shouted', 'Sit down', '!'], ['Dad', 'shouted', 'Look out', '!'], ['Mia', 'cried', 'Watch out', '!'],
  ['The coach', 'shouted', 'Run faster', '!'], ['Tom', 'cried', 'That was brilliant', '!'],
];

const MARKS = [',', '.', '!', '?'];
const say = (text: string) => text.replace(/[“”]/g, '').replace('_', ' blank ').replace(/\s+/g, ' ').trim();

/** d1: gap after a reporting clause that comes first → `,` · d2: gap at the end of the speech → its end mark · d3: adds the clause second. */
export const y4Speech: Generator = (d, rng) => {
  const form = d === 1 ? 0 : d === 2 ? 1 : pick(rng, [0, 1, 2, 2]);
  const make = (text: string, answer: string, marks: string[], hint: string) => wordQ(rng, 'Which mark goes in the gap?', answer,
    marks.filter(m => m !== answer), { visual: { type: 'sentence', text }, say: say(text), hint, hintIsData: false });
  if (form === 0) {
    const [who, verb, words, end] = pick(rng, d === 1 ? [...STATEMENTS, ...QUESTIONS, ...EXCLAMATIONS] : [...STATEMENTS, ...QUESTIONS]);
    return make(`${who} ${verb}_ “${words}${end}”`, ',', d === 1 ? MARKS : [',', '.', '?'], 'What follows the words that tell us who is speaking?');
  }
  const [who, verb, words, end] = pick(rng, [...STATEMENTS, ...QUESTIONS]);
  const marks = [',', '.', '?'];
  if (form === 1) return make(`${who} ${verb}, “${words}_”`, end, marks, 'What ends the words that are spoken?');
  return make(`“${words}_” ${verb} ${who}.`, end === '?' ? '?' : ',', marks, 'The speech is followed by who said it.');
};
