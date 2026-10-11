// y6-formal (#1277): formal or informal? (English Appendix 2, Year 6: vocabulary and structures typical of informal
// speech against those suited to formal speech and writing). d1 names the formal word for an informal phrase, d2 picks
// the one formal word to fill a sentence, d3 picks which of two sentences suits a formal letter. The subjunctive half
// of the same line is #1280's, and no card ever calls the informal choice wrong: the stem names the purpose.
import type { Difficulty, Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** [informal phrase, formal word, sentence with one "_" that takes the formal word and the informal phrase alike]. */
export type FormalRow = [informal: string, formal: string, sentence: string];

export const FORMAL_WORDS: FormalRow[] = [
  ['find out', 'discover', 'We hope to _ the truth.'],
  ['ask for', 'request', 'You may _ extra paper.'],
  ['go in', 'enter', 'Please _ the hall quietly.'],
  ['help', 'assist', 'Please _ the new pupils.'],
  ['need', 'require', 'Plants _ light and water.'],
  ['tell', 'inform', 'Please _ the office if you are late.'],
  ['give back', 'return', 'You must _ the book on Friday.'],
  ['put off', 'postpone', 'We have to _ the match.'],
  ['buy', 'purchase', 'You can _ tickets at the door.'],
  ['try', 'attempt', 'Please do not _ to climb the fence.'],
  ['start', 'commence', 'The show will _ at noon.'],
  ['about', 'approximately', 'The walk takes _ an hour.'],
];

/** Formal words close enough in meaning that one could pass for the other's informal phrase: never on one card. */
const CLASH: [string, string][] = [['request', 'require']];
const clash = (a: string, b: string): boolean => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

/** [formal sentence, informal sentence] on the same content. The informal one carries a question tag, a contraction or an informal phrase. */
export const REGISTER_PAIRS: [string, string][] = [
  ['The trip has been cancelled.', "The trip's off, isn't it?"],
  ['We must discover the cause.', "We've got to find out the cause."],
  ['You may request more time.', "You can ask for more time, can't you?"],
  ['Please enter the room quietly.', 'Please go in the room quietly.'],
  ['The lesson will commence at nine.', "The lesson will start at nine, won't it?"],
  ['Please inform the teacher.', 'Just tell the teacher, will you?'],
  ['I do not understand the question.', "I don't get the question."],
  ['The match was postponed.', "They put off the match, didn't they?"],
  ['We purchased the tickets online.', "We bought the tickets online, didn't we?"],
  ['Visitors must return the keys.', 'Visitors must give back the keys.'],
  ['It is approximately a mile to the farm.', "It's about a mile to the farm."],
  ['Pupils require a pencil.', "Pupils need a pencil, don't they?"],
];

/** A label this long cannot be read on a bubble (R-LBL, #1046): the card names the words as A, B, C and the bubbles are the letters. */
const LONG = 10;
const LETTERS = ['A', 'B', 'C', 'D'];

/** The card as pick-one words, or as lettered choices when any word is too long to read on a bubble. */
function wordsCard(rng: Parameters<Generator>[1], prompt: string, lead: string, say: string, hint: string, answer: string, wrong: string[]): Question {
  const q = wordQ(rng, prompt, answer, wrong, { visual: lead ? { type: 'sentence', text: lead } : undefined, say, hint, hintIsData: false });
  if (q.options.every(o => o.length <= LONG)) return q;
  const list = q.options.map((o, i) => `${LETTERS[i]}: ${o}`).join('\n');
  const lettered = wordQ(rng, prompt, LETTERS[q.options.indexOf(answer)], LETTERS.slice(0, q.options.length).filter(l => l !== LETTERS[q.options.indexOf(answer)]), {
    visual: { type: 'sentence', text: lead ? `${lead}\n${list}` : list }, say, hint, hintIsData: false,
  });
  return { ...lettered, options: LETTERS.slice(0, q.options.length), wide: false };
}

/** Bank formal words from three different rows, none close in meaning to the row's own or to each other. */
function otherFormals(rng: Parameters<Generator>[1], row: FormalRow, n: number): string[] {
  const out: string[] = [row[1]];
  for (const r of shuffle(rng, FORMAL_WORDS.filter(x => x !== row))) if (out.length <= n && !out.some(w => clash(w, r[1]))) out.push(r[1]);
  return out.slice(1);
}

export const y6Formal: Generator = (d: Difficulty, rng) => {
  if (d === 3) {
    const [formal, informal] = pick(rng, REGISTER_PAIRS);
    const formalFirst = rng() < 0.5;
    const [a, b] = formalFirst ? [formal, informal] : [informal, formal];
    return wordQ(rng, 'Which sentence suits a formal letter?', formalFirst ? 'A' : 'B', [formalFirst ? 'B' : 'A'], {
      visual: { type: 'sentence', text: `A: ${a}\nB: ${b}` }, say: `Which sentence suits a formal letter? A: ${a} B: ${b}`, hint: 'Pick the one for a formal letter', hintIsData: false,
    });
  }
  const row = pick(rng, FORMAL_WORDS);
  const [informal, formal, sentence] = row;
  if (d === 1) {
    return wordsCard(rng, `Formal word for "${informal}"?`, '', `What is the formal word for ${informal}?`, 'Slice the formal word', formal, otherFormals(rng, row, 2));
  }
  const others = shuffle(rng, FORMAL_WORDS.filter(x => x !== row)).slice(0, 2).map(x => x[0]);
  const text = `${sentence.replace('_', '___')}\n(${informal})`;
  return wordsCard(rng, 'Slice the formal word', text, `${sentence.replace('_', 'blank')} The informal word is ${informal}. Slice the formal word.`, 'Slice the formal word', formal, [informal, ...others]);
};
