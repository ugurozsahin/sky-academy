// y4-homophones (#1171): Year 3–4 homophones and near-homophones, part 2 — sets 12–22 of English Appendix 1 p.15,
// in printed order (part 1 is y3-homophones, #1112). A sentence has one gap and the whole set is on the bubbles, so the
// child chooses between spellings of one sound. Each sentence is hand-keyed so every other member of its set is wrong
// there (the #666 check): missed is only a verb and mist only a noun, whose is a question word and who's is who is/has.
import type { Difficulty, Generator } from './types';
import { pick, wordQ } from './util';

export const Y34_HOMOPHONE_SETS_2: ReadonlyArray<readonly string[]> = [
  ['mail', 'male'], ['main', 'mane'], ['meat', 'meet'], ['medal', 'meddle'], ['missed', 'mist'], ['peace', 'piece'],
  ['plain', 'plane'], ['rain', 'rein', 'reign'], ['scene', 'seen'], ['weather', 'whether'], ['whose', "who's"],
];

/** [sentence with ___, index into the sets, answer]. A sentence-initial gap takes the capitalised form. */
export type Hom2Row = [sentence: string, set: number, answer: string];
export const HOMOPHONE_BANK_2: Hom2Row[] = [
  ['The postman brought the ___.', 0, 'mail'], ['I sent a letter in the ___.', 0, 'mail'],
  ['A ___ lion has a big mane.', 0, 'male'], ['The ___ peacock has bright feathers.', 0, 'male'],
  ['The ___ road goes into town.', 1, 'main'], ['The ___ door is painted red.', 1, 'main'],
  ['The lion shook his thick ___.', 1, 'mane'], ['The horse has a long ___.', 1, 'mane'],
  ['We had ___ and potatoes for tea.', 2, 'meat'], ['A vegetarian does not eat ___.', 2, 'meat'],
  ['Let us ___ at the gate.', 2, 'meet'], ['I will ___ you after school.', 2, 'meet'],
  ['She won a gold ___ in the race.', 3, 'medal'], ['The winner wore a shiny ___.', 3, 'medal'],
  ['Please do not ___ in my game.', 3, 'meddle'], ['It is rude to ___ in other people\'s plans.', 3, 'meddle'],
  ['I ___ the bus this morning.', 4, 'missed'], ['Tom ___ the ball and it rolled away.', 4, 'missed'],
  ['A thin ___ covered the hill.', 4, 'mist'], ['The ___ rose from the lake.', 4, 'mist'],
  ['We want ___ and quiet in the library.', 5, 'peace'], ['The dove is a sign of ___.', 5, 'peace'],
  ['I ate a ___ of cake.', 5, 'piece'], ['Please give me one ___ of paper.', 5, 'piece'],
  ['The wall is ___ white.', 6, 'plain'], ['I like ___ toast with no jam.', 6, 'plain'],
  ['The ___ flew high above the clouds.', 6, 'plane'], ['We got on the ___ to Spain.', 6, 'plane'],
  ['The ___ fell all day long.', 7, 'rain'], ['Take a coat in case of ___.', 7, 'rain'],
  ['The rider pulled the ___ to stop the horse.', 7, 'rein'], ['She held the ___ in her hand.', 7, 'rein'],
  ['The king\'s ___ lasted forty years.', 7, 'reign'], ['The queen began her ___ long ago.', 7, 'reign'],
  ['The first ___ of the play was funny.', 8, 'scene'], ['The police went to the ___ of the crime.', 8, 'scene'],
  ['Have you ___ my red hat?', 8, 'seen'], ['I have never ___ a whale.', 8, 'seen'],
  ['The ___ is hot and sunny today.', 9, 'weather'], ['Check the ___ before we go out.', 9, 'weather'],
  ['I do not know ___ it will rain.', 9, 'whether'], ['Ask Mum ___ we can go.', 9, 'whether'],
  ['___ coat is this?', 10, 'Whose'], ['Do you know ___ bag that is?', 10, 'whose'],
  ['___ coming to the party?', 10, "Who's"], ['Ask Jo, ___ the fastest runner.', 10, "who's"],
];

/** d1 the six concrete two-word sets; d2 adds rain/rein/reign; d3 adds weather/whether, whose/who's, medal/meddle, missed/mist. */
const D1_SETS = [0, 1, 2, 5, 6, 8];
const SETS_BY_DIFF: Record<Difficulty, number[]> = { 1: D1_SETS, 2: [...D1_SETS, 7], 3: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

export const y4Homophones: Generator = (d, rng) => {
  const sets = SETS_BY_DIFF[d];
  const [sent, si, ans] = pick(rng, HOMOPHONE_BANK_2.filter(r => sets.includes(r[1])));
  const up = sent.startsWith('___');
  const others = Y34_HOMOPHONE_SETS_2[si].filter(w => w !== ans.toLowerCase()).map(w => (up ? cap(w) : w));
  return wordQ(rng, sent, ans, others, { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Which spelling fits the sentence?', hintIsData: false });
};
