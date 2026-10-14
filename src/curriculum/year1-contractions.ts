import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** Contractions with ONE expansion (no he's/she's/it's/I'd/we'd). Own Year 1 bank: `y2-contractions` is the spelling direction (#993). */
const Y1_CONTRACTIONS: [string, string, string][] = [
  ["I'm", 'I am', "I'm happy today."], ["I'll", 'I will', "I'll get my coat."], ["we'll", 'we will', "We'll play outside."], ["you'll", 'you will', "You'll like this book."],
  ["he'll", 'he will', "He'll come to tea."], ["she'll", 'she will', "She'll bring a cake."], ["they'll", 'they will', "They'll walk to school."],
];
/** Decoys, nearest trap first: same pronoun with the other verb (only I am <-> I will), same verb with another pronoun, then the rest. */
function y1ContractionDecoys(answer: string, n: number, rng: () => number): string[] {
  const all = Y1_CONTRACTIONS.map(c => c[1]).filter(x => x !== answer);
  const [pro, verb] = answer.split(' ');
  const swap = pro === 'I' ? [verb === 'am' ? 'I will' : 'I am'] : [];
  const sameVerb = shuffle(rng, all.filter(x => x.endsWith(' ' + verb) && !swap.includes(x)));
  const rest = shuffle(rng, all.filter(x => !swap.includes(x) && !sameVerb.includes(x)));
  return [...swap, ...sameVerb, ...rest].slice(0, n);
}
export const y1Contractions: Generator = (d, rng) => {
  const [c, full, sent] = pick(rng, d === 1 ? Y1_CONTRACTIONS.slice(0, 3) : Y1_CONTRACTIONS);
  const ds = y1ContractionDecoys(full, d === 1 ? 2 : 3, rng);
  return wordQ(rng, 'Read the word with the apostrophe. Which two words does it stand for?', full, ds, { say: 'Read the word with the apostrophe. Which two words does it stand for?', visual: d === 3 ? { type: 'sentence', text: sent } : { type: 'word', text: d === 1 && c === "we'll" && rng() < 0.5 ? "We'll" : c }, hint: 'The apostrophe shows missing letters', hintIsData: false });
};
