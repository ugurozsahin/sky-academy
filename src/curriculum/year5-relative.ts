// y5-relative (#1224): relative clauses (English Appendix 2, Year 5). d1 slice the relative pronoun in a sentence · d2 choose the
// pronoun for a gap · d3 the word just before an omitted pronoun. A gap card never offers `that` (it is right beside who, which and
// when in a clause without commas) and never offers a decoy that is also right for the gap.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

export const PRONOUNS: readonly string[] = ['who', 'which', 'where', 'when', 'whose', 'that'];

/** Gap cards: the sentence with `___` where the pronoun goes, and the pronoun. `which` only ever follows a comma. */
export type GapRow = readonly [template: string, answer: string];
export const GAP_BANK: readonly GapRow[] = [
  ['The girl ___ won the race was proud.', 'who'], ['My friend, ___ lives next door, has a puppy.', 'who'], ['The man ___ mended our roof was very kind.', 'who'],
  ['Mrs Khan, ___ teaches Year 5, loves art.', 'who'], ['The children ___ sang in the hall were brilliant.', 'who'], ['The boy ___ found my coat gave it back.', 'who'],
  ['My bike, ___ is red, has a flat tyre.', 'which'], ['The cake, ___ Mum baked, was delicious.', 'which'], ['Our school, ___ is very old, has a clock tower.', 'which'],
  ['The river, ___ flows past the farm, was calm.', 'which'], ['Her coat, ___ was too big, hung on the peg.', 'which'], ['The film, ___ we watched on Friday, was funny.', 'which'],
  ['The boy ___ dog barked loudly ran away.', 'whose'], ['The girl ___ bag was blue waved at me.', 'whose'], ['Tom, ___ sister plays chess, won a prize.', 'whose'],
  ['The farmer ___ sheep escaped was worried.', 'whose'], ['The teacher ___ voice is quiet sits at the front.', 'whose'], ['The woman ___ car broke down called for help.', 'whose'],
  ['The park ___ we play football is closed.', 'where'], ['This is the town ___ my gran was born.', 'where'], ['The beach ___ we built a castle was sandy.', 'where'],
  ['The shop ___ Dad buys bread is on the corner.', 'where'], ['The field ___ the sheep graze is very wet.', 'where'], ['The room ___ we keep our books is tidy.', 'where'],
  ['I remember the day ___ we got our puppy.', 'when'], ['Summer is the time ___ the garden is full of bees.', 'when'], ['Night is the time ___ the owls hunt.', 'when'],
  ['Monday was the day ___ the new teacher came.', 'when'], ['We love the evenings ___ the sky turns pink.', 'when'], ['It was the morning ___ the snow fell.', 'when'],
];

/** The only decoys a gap may take, per answer: each is wrong in that gap, and never `that`. `when` never meets `where` ("the day where we met"). */
export const DECOYS: Readonly<Record<string, readonly string[]>> = {
  who: ['where', 'when', 'whose'], which: ['who', 'where', 'when'], whose: ['who', 'where', 'when'], where: ['who', 'whose', 'when'], when: ['who', 'whose'],
};

/** d1 only: sentences whose pronoun is `that`, which has no gap card. */
export const THAT_BANK: readonly string[] = [
  'The book that I borrowed was long.', 'The dog that barked all night is asleep.', 'The jumper that Gran knitted is warm.', 'The bike that Dad mended works well.',
  'The song that we sang was lovely.',
];

/** d3: the words before and after the omitted pronoun; the answer is the last word of the first part. */
export type OmitRow = readonly [before: string, after: string];
export const OMIT_BANK: readonly OmitRow[] = [
  ['The film', 'we watched was scary.'], ['The book', 'I borrowed was long.'], ['The cake', 'Mum baked was delicious.'], ['The jumper', 'Gran knitted is warm.'],
  ['The dog', 'we met was friendly.'], ['The song', 'we sang was lovely.'], ['The picture', 'Mia painted won a prize.'], ['The pie', 'Dad made smelt lovely.'],
  ['The game', 'we played was fun.'], ['The boy', 'I sat beside was kind.'], ['The story', 'the teacher read was exciting.'], ['The bag', 'she lost was red.'],
];

const bare = (w: string) => w.replace(/[^A-Za-z]/g, '');
/** Content words of a sentence for bubbles: three or more letters, not `the`, not a pronoun, in sentence order. */
function words(sentence: string, skip: readonly string[]): string[] {
  return sentence.split(' ').map(bare).filter(w => w.length >= 3 && w.toLowerCase() !== 'the' && !PRONOUNS.includes(w.toLowerCase()) && !skip.includes(w));
}

function spot(rng: () => number): Question {
  const sentences = [...GAP_BANK.map(([t, a]) => t.replace('___', a)), ...THAT_BANK];
  const s = pick(rng, sentences);
  const answer = s.split(' ').map(bare).find(w => PRONOUNS.includes(w))!;
  return wordQ(rng, 'Slice the relative pronoun', answer, shuffle(rng, [...new Set(words(s, []))]).slice(0, 3), {
    visual: { type: 'sentence', text: s }, say: `${s} Slice the relative pronoun.`, wide: true,
    hint: 'It joins the extra information to the noun.', hintIsData: false,
  });
}

function choose(rng: () => number): Question {
  const [template, answer] = pick(rng, GAP_BANK);
  return wordQ(rng, 'Which relative pronoun fits the gap?', answer, shuffle(rng, DECOYS[answer]).slice(0, 2), {
    visual: { type: 'sentence', text: template }, say: `${template.replace('___', 'blank')} Which relative pronoun fits the gap?`, wide: true,
    hint: 'who is a person, whose is belonging, where is a place, when is a time, which is a thing after a comma.', hintIsData: false,
  });
}

function omitted(rng: () => number): Question {
  const [before, after] = pick(rng, OMIT_BANK);
  const answer = before.split(' ').pop()!;
  const text = `${before} ___ ${after}`;
  const prompt = 'Which word comes before the missing pronoun?';
  return wordQ(rng, prompt, answer, shuffle(rng, [...new Set(words(`${before} ${after}`, [answer]))]).slice(0, 3), {
    visual: { type: 'sentence', text }, say: `${text.replace('___', 'blank')} ${prompt}`, wide: true,
    hint: 'The missing word would go straight after the noun it tells us about.', hintIsData: false,
  });
}

/** d1: spot the pronoun in a full sentence · d2: choose it for a gap · d3: the word before an omitted pronoun. */
export const y5Relative: Generator = (d, rng) => (d === 1 ? spot(rng) : d === 2 ? choose(rng) : omitted(rng));
