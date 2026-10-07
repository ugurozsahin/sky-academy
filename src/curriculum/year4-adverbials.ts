// y4-adverbials (#1166): fronted adverbials and the comma after them (English Appendix 2, Year 4). d1 and d2 show the
// sentence with lettered gaps and the child slices the letter where the comma belongs; d3 mixes in a second form where
// the child picks the adverbial that fits a gap. The gap letters are shuffled, so the answer letter is not fixed.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** [adverbial, the rest of the sentence as it reads after the comma, index in that rest of the first verb word]. */
export type AdvRow = readonly [adverbial: string, rest: string, verbAt: number];

/** d1: one-word adverbials. */
export const WORD_ADV: readonly AdvRow[] = [
  ['Suddenly', 'the door opened.', 2], ['Carefully', 'the cat crept past the dog.', 2], ['Yesterday', 'we went to the park.', 1],
  ['Tomorrow', 'I will visit my nan.', 1], ['Quietly', 'the mouse ran away.', 2], ['Eventually', 'the rain stopped.', 2],
  ['Finally', 'we reached the top.', 1], ['Sadly', 'the old tree fell down.', 3], ['Today', 'we planted some seeds.', 1],
  ['Slowly', 'the snail crossed the path.', 2], ['Luckily', 'Mia found her lost keys.', 1], ['Nervously', 'the boy knocked on the door.', 2],
  ['Silently', 'the owl glided over the field.', 2], ['Later', 'we ate our picnic.', 1], ['Sometimes', 'Dad cooks tea for us.', 1],
  ['Soon', 'the bus will come.', 2], ['Meanwhile', 'the farmer fed his hens.', 2], ['Tonight', 'the stars shine brightly.', 2],
  ['Happily', 'the pups played in the mud.', 2], ['Gently', 'Ben stroked the pony.', 1],
];

/** d2 and d3: phrase adverbials of two to four words. */
export const PHRASE_ADV: readonly AdvRow[] = [
  ['Later that day', 'I heard the bad news.', 1], ['Without a sound', 'the fox crept away.', 2], ['After lunch', 'we played in the garden.', 1],
  ['In the morning', 'the birds began to sing.', 2], ['At the weekend', 'we visited the farm.', 1], ['Before school', 'Tom fed the rabbit.', 1],
  ['In the dark forest', 'the owls hooted.', 2], ['On Monday', 'our class went swimming.', 2], ['After the storm', 'the sky turned blue.', 2],
  ['Under the bed', 'I found my sock.', 1], ['During the night', 'snow covered the hills.', 1], ['Across the river', 'a heron stood still.', 2],
  ['With a big smile', 'Mia opened her gift.', 1], ['At noon', 'the bell rang loudly.', 2], ['In the summer', 'we swim in the lake.', 1],
  ['Near the gate', 'a robin sang.', 2], ['Early one morning', 'the baker lit his oven.', 2], ['Every night', 'Dad reads us a story.', 1],
  ['At the seaside', 'we built a sandcastle.', 1],
];

/** d3 second form: [rest of the sentence, the adverbial that fits, a noun-phrase decoy, an irregular past-tense verb decoy]. All ≤ 10 characters. */
export type FitRow = readonly [rest: string, adverbial: string, nounPhrase: string, verb: string];
export const FIT_BANK: readonly FitRow[] = [
  ['we ate our picnic.', 'At noon', 'The picnic', 'Ate'], ['the birds began to sing.', 'At dawn', 'A big tree', 'Sang'],
  ['we read a long book.', 'At school', 'My pencil', 'Drew'], ['I saw a red fox.', 'Last night', 'A red kite', 'Ran'],
  ['the snow fell softly.', 'Overnight', 'The snow', 'Fell'], ['Dad made some toast.', 'At seven', 'Some jam', 'Took'],
  ['the class went on a trip.', 'On Friday', 'My teacher', 'Rang'], ['we flew our kites.', 'In spring', 'Two kites', 'Flew'],
  ['the frog jumped in.', 'Suddenly', 'The pond', 'Swam'], ['Gran told us a story.', 'At bedtime', 'Her book', 'Sang'],
  ['the sun came out.', 'By noon', 'A cloud', 'Grew'], ['we cleaned our room.', 'On Sunday', 'Our toys', 'Hid'],
  ['the bus arrived.', 'At last', 'The driver', 'Ran'], ['I wore my new boots.', 'In winter', 'My boots', 'Took'],
];

const LETTERS = ['A', 'B', 'C', 'D'];

/** The sentence with `(X)` at each gap (`gaps` are boundaries: gap i sits after word i), letters shuffled in reading order. */
export function render(words: readonly string[], gaps: readonly number[], letters: readonly string[]): string {
  const sorted = [...gaps].sort((a, b) => a - b);
  return words.map((w, i) => sorted.includes(i) ? `${w} (${letters[gaps.indexOf(i)]})` : w).join(' ');
}

/** Where the comma goes: the answer gap, plus the named misconceptions (inside the adverbial, before the verb), plus random fill. */
function whereComma(d: 1 | 2 | 3, rng: () => number): Question {
  const [adv, rest, verbAt] = pick(rng, d === 1 ? WORD_ADV : PHRASE_ADV);
  const words = `${adv} ${rest}`.split(' '), k = adv.split(' ').length;
  const answerAt = k - 1, beforeVerb = k + verbAt - 1;
  const gaps = [answerAt, beforeVerb];
  if (d >= 2) gaps.push(0);
  const wanted = d === 1 ? 3 : d === 2 ? 3 : 4;
  const spare = shuffle(rng, words.slice(0, -1).map((_, i) => i).filter(i => !gaps.includes(i)));
  while (gaps.length < wanted) gaps.push(spare.pop()!);
  const labels = shuffle(rng, LETTERS.slice(0, wanted));
  const answer = labels[gaps.indexOf(answerAt)];
  const prompt = 'Where does the comma go?';
  return wordQ(rng, prompt, answer, labels.filter(l => l !== answer), {
    visual: { type: 'sentence', text: render(words, gaps, labels) }, say: `${words.join(' ')} ${prompt}`,
    hint: 'The comma goes straight after the words that start the sentence.', hintIsData: false,
  });
}

/** d3: pick the adverbial that fits the gap; the decoys are a noun phrase and a verb, which cannot start a sentence like that. */
function fits(rng: () => number): Question {
  const [rest, adv, noun, verb] = pick(rng, FIT_BANK);
  const text = `___, ${rest}`;
  return wordQ(rng, 'Which fits the gap?', adv, [noun, verb], {
    visual: { type: 'sentence', text }, say: text.replace('___', 'blank'), wide: true,
    hint: 'Which words tell us when or where?', hintIsData: false,
  });
}

/** d1: one-word adverbial, 3 gaps · d2: phrases, 3 gaps, one inside the adverbial · d3: phrases with 4 gaps, or pick the adverbial. */
export const y4Adverbials: Generator = (d, rng) => (d === 3 && rng() < 0.5 ? fits(rng) : whereComma(d, rng));
