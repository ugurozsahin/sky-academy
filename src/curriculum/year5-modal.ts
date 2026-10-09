// y5-modal (#1225): degrees of possibility with modal verbs and adverbs (English Appendix 2, Year 5). d1 slice the modal verb · d2 slice
// the adverb of possibility · d3 certain or possible? No gap cards: "It ___ rain" takes might, may, could and should (the #666 trap).
// Every sentence holds exactly one word from MODALS or ADVERBS; d3 sentences use only the two-class words, never must/should/surely/probably.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

export const MODALS: readonly string[] = ['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would'];
export const ADVERBS: readonly string[] = ['perhaps', 'possibly', 'maybe', 'surely', 'probably', 'definitely', 'certainly'];
export const CERTAIN: readonly string[] = ['will', 'definitely', 'certainly'];
export const POSSIBLE: readonly string[] = ['might', 'may', 'could', 'perhaps', 'possibly', 'maybe'];

/** d1: one modal verb each, spread over all nine. */
export const MODAL_BANK: readonly string[] = [
  'We might go swimming tomorrow.', 'You must wear a helmet.', 'The cat could jump over the wall.', 'Mum said I may stay up late.',
  'I will finish my painting soon.', 'You should brush your teeth.', 'Our team can win the match.', 'We shall sing at the concert.',
  'It would be fun to camp outside.', 'The storm might reach us tonight.', 'Dad will cook pasta for tea.', 'The bridge could fall down.',
  'Children must hold the rail.', 'She can swim very fast.', 'We should tidy the classroom.', 'You may sit on the carpet.',
  'The dragon would roar at night.', 'I shall write to my gran.',
];

/** d2: one possibility adverb each, spread over all seven. */
export const ADVERB_BANK: readonly string[] = [
  'Perhaps the bus is late today.', 'The post is probably at the door.', 'Maybe we bake a cake.', 'It is possibly the best book here.',
  'The rain definitely stopped by noon.', 'Surely the shop is open now.', 'She is certainly very clever.', 'Perhaps Tom lost his coat.',
  'We probably won the race.', 'Maybe the owl is in the barn.', 'The train is possibly on time.', 'He is definitely the tallest boy.',
  'Surely the answer is eleven.', 'The sun certainly shone today.',
];

/** d3: one two-class marker each. */
export const CERTAIN_BANK: readonly string[] = [
  'The sun will rise in the morning.', 'We definitely visit Gran on Sunday.', 'The film will end at six.', 'It is certainly a very hot day.',
  'Dad will pick us up at four.', 'She is definitely the winner.', 'The bus will stop at the school.', 'Winter certainly brings snow.',
];
export const POSSIBLE_BANK: readonly string[] = [
  'It might rain later today.', 'We may visit the farm.', 'The ice could melt by noon.', 'Perhaps the shop is shut.',
  'He is possibly asleep upstairs.', 'Maybe we go to the park.', 'Tom might forget his bag.', 'The wind may blow all night.',
];

export const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? [];

/** The bank sentence's single marker word, as written. */
const markerIn = (s: string, list: readonly string[]): string => s.match(/[A-Za-z]+/g)!.find(w => list.includes(w.toLowerCase()))!;

/** Slice-the-word card: four words of the sentence, the marker plus three others of two or more letters. */
function spot(rng: () => number, bank: readonly string[], list: readonly string[], prompt: string, hint: string): Question {
  const s = pick(rng, bank);
  const answer = markerIn(s, list);
  const others = [...new Set(s.match(/[A-Za-z]+/g)!)].filter(w => w !== answer && w.length >= 2 && w.toLowerCase() !== 'the');
  return wordQ(rng, prompt, answer, shuffle(rng, others).slice(0, 3), {
    visual: { type: 'sentence', text: s }, say: `${s} ${prompt}.`, hint, hintIsData: false,
  });
}

function sure(rng: () => number): Question {
  const certain = rng() < 0.5;
  const s = pick(rng, certain ? CERTAIN_BANK : POSSIBLE_BANK);
  return wordQ(rng, 'Which is it, certain or possible?', certain ? 'certain' : 'possible', [certain ? 'possible' : 'certain'], {
    visual: { type: 'sentence', text: s }, say: `${s} How sure is the writer? Certain, or only possible?`,
    hint: 'will is certain; might and perhaps only say it could happen.', hintIsData: false,
  });
}

/** d1: the modal verb · d2: the adverb of possibility · d3: certain or possible. */
export const y5Modal: Generator = (d, rng) =>
  d === 1 ? spot(rng, MODAL_BANK, MODALS, 'Slice the modal verb', 'A modal verb sits before another verb, like might go.')
    : d === 2 ? spot(rng, ADVERB_BANK, ADVERBS, 'Slice the adverb of possibility', 'It says how likely something is, like perhaps.')
      : sure(rng);
