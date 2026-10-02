// y3-conjunctions (#1108): Year 3 time, place and cause words (English Appendix 2, Year 3, Sentence p.3).
// Bank A is a gap card: exactly one of the bubbles makes sense. Every decoy is hand-picked from the Appendix 2 words
// plus although/if and is wrong in that sentence (the #1007 decoy test: put it in the gap — if it still reads
// sensibly it is not a decoy). Synonyms of the answer (then/next, when/while…) are simply not listed (#666).
// Bank B names the word class of before/after/since from what follows it: a clause is a conjunction, a noun
// phrase a preposition, nothing an adverb.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type WordClass = 'conjunction' | 'adverb' | 'preposition';
export type GapRow = [sentence: string, answer: string, decoys: [string, string, string], cls: WordClass];
export type ClassRow = [sentence: string, word: string, cls: WordClass];

export const GAP_BANK: GapRow[] = [
  // conjunctions: because, so, when, before, after, while
  ['We wore coats ___ it was cold.', 'because', ['during', 'then', 'in'], 'conjunction'],
  ['I was late ___ the bus broke down.', 'because', ['next', 'soon', 'in'], 'conjunction'],
  ['It was cold, ___ we wore coats.', 'so', ['because', 'during', 'in'], 'conjunction'],
  ['The ice melted, ___ we could not skate.', 'so', ['because', 'during', 'in'], 'conjunction'],
  ['I wave ___ I see my friend at the gate.', 'when', ['soon', 'during', 'in'], 'conjunction'],
  ['The bell rings ___ it is time for playtime.', 'when', ['although', 'soon', 'in'], 'conjunction'],
  ['Put on your boots ___ you go out in the rain.', 'before', ['during', 'soon', 'in'], 'conjunction'],
  ['Mum switched the oven on ___ she put the pie in.', 'before', ['during', 'soon', 'in'], 'conjunction'],
  ['We washed up ___ we had eaten our dinner.', 'after', ['during', 'in', 'soon'], 'conjunction'],
  ['He fell asleep ___ he had read the story.', 'after', ['during', 'in', 'soon'], 'conjunction'],
  ['Dad cooked ___ we laid the table.', 'while', ['soon', 'during', 'in'], 'conjunction'],
  ['The baby slept ___ we tiptoed past.', 'while', ['next', 'in', 'soon'], 'conjunction'],
  // adverbs: then, next, soon, therefore
  ['First we mixed it, and ___ we baked it.', 'then', ['because', 'during', 'if'], 'adverb'],
  ['I got in the bath and ___ I washed my hair.', 'then', ['although', 'during', 'because'], 'adverb'],
  ['We packed our bags, and ___ we got on the coach.', 'next', ['because', 'during', 'if'], 'adverb'],
  ['She drew a circle and ___ she coloured it in.', 'next', ['although', 'in', 'because'], 'adverb'],
  ['The rain stopped and ___ the sun came out.', 'soon', ['because', 'during', 'if'], 'adverb'],
  ['Wait here, I will be back ___.', 'soon', ['therefore', 'during', 'because'], 'adverb'],
  ['It was raining; ___ we stayed indoors.', 'therefore', ['because', 'although', 'during'], 'adverb'],
  ['The shop was shut; ___ we went home.', 'therefore', ['because', 'if', 'in'], 'adverb'],
  // prepositions: before, after, during, in, because of
  ['We washed our hands ___ lunch.', 'before', ['while', 'because', 'therefore'], 'preposition'],
  ['Please put your coat on ___ playtime.', 'before', ['although', 'while', 'if'], 'preposition'],
  ['We went to the park ___ school.', 'after', ['while', 'because', 'although'], 'preposition'],
  ['There was a rainbow ___ the storm.', 'after', ['because', 'if', 'so'], 'preposition'],
  ['We were very quiet ___ the film.', 'during', ['because', 'so', 'if'], 'preposition'],
  ['Nobody spoke ___ the assembly.', 'during', ['although', 'then', 'because'], 'preposition'],
  ['The ducks swam ___ the pond.', 'in', ['because', 'while', 'so'], 'preposition'],
  ['My shoes are ___ the cupboard.', 'in', ['therefore', 'although', 'if'], 'preposition'],
  ['We stayed home ___ the rain.', 'because of', ['because', 'so', 'while'], 'preposition'],
  ['The match was off ___ the snow.', 'because of', ['because', 'if', 'so'], 'preposition'],
];

/** before, after and since can each be all three classes; what comes after the word decides which. */
export const CLASS_BANK: ClassRow[] = [
  ['We ate before the film started.', 'before', 'conjunction'], ['Wash your hands before you eat.', 'before', 'conjunction'],
  ['We ate before the film.', 'before', 'preposition'], ['Wash your hands before lunch.', 'before', 'preposition'],
  ['I have seen that film before.', 'before', 'adverb'],
  ['We swam after the sun came out.', 'after', 'conjunction'], ['Go home after you have finished.', 'after', 'conjunction'],
  ['We swam after lunch.', 'after', 'preposition'], ['Go home after the match.', 'after', 'preposition'],
  ['We arrived soon after.', 'after', 'adverb'],
  ['I have felt ill since I ate the fish.', 'since', 'conjunction'], ['We have lived here since I was born.', 'since', 'conjunction'],
  ['I have felt ill since breakfast.', 'since', 'preposition'], ['We have lived here since Monday.', 'since', 'preposition'],
  ['Ali left in May. We have not met since.', 'since', 'adverb'],
];

const CLASSES: WordClass[] = ['conjunction', 'preposition', 'adverb'];
const CONJ_ROWS = GAP_BANK.filter(r => r[3] === 'conjunction');

const gap = (rng: Rng, rows: GapRow[], nDecoys: number): Question => {
  const [s, answer, decoys] = pick(rng, rows);
  return wordQ(rng, s, answer, shuffle(rng, decoys).slice(0, nDecoys), {
    visual: { type: 'sentence', text: s }, say: s.replace('___', 'blank'), hint: 'Which word makes sense?', hintIsData: false,
  });
};

const wordClass = (rng: Rng): Question => {
  const [s, word, cls] = pick(rng, CLASS_BANK);
  return wordQ(rng, `What is ${word} in this sentence?`, cls, CLASSES.filter(c => c !== cls), {
    visual: { type: 'sentence', text: s }, say: `${s} What is ${word} in this sentence?`, hint: 'Look at what comes after it', hintIsData: false,
  });
};

export const y3Conjunctions: Generator = (d: Difficulty, rng) =>
  d === 1 ? gap(rng, CONJ_ROWS, 2) : d === 2 || rng() < 0.5 ? gap(rng, GAP_BANK, 3) : wordClass(rng);
