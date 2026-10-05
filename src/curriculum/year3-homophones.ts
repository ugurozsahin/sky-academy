// y3-homophones (#1112): Year 3–4 homophones and near-homophones, part 1 — the first 11 sets of English Appendix 1
// p.15, in printed order (part 2 is #1171). A sentence has one gap and the whole set is on the bubbles, so the child
// chooses between spellings of one sound. Each sentence is hand-keyed so every other member of its set is wrong
// there (the #666 check); *affect* is only the verb and *effect* only the noun.
import type { Difficulty, Generator } from './types';
import { pick, wordQ } from './util';

export const Y34_HOMOPHONE_SETS_1: ReadonlyArray<readonly string[]> = [
  ['accept', 'except'], ['affect', 'effect'], ['ball', 'bawl'], ['berry', 'bury'], ['brake', 'break'], ['fair', 'fare'],
  ['grate', 'great'], ['groan', 'grown'], ['here', 'hear'], ['heel', 'heal', "he'll"], ['knot', 'not'],
];

/** [sentence with ___, index into the sets, answer]. A sentence-initial gap takes the capitalised form. */
export type HomRow = [sentence: string, set: number, answer: string];
export const HOMOPHONE_BANK: HomRow[] = [
  ['Please ___ this gift from me.', 0, 'accept'], ['I will ___ your invitation.', 0, 'accept'],
  ['Everyone ___ Sam came to the party.', 0, 'except'], ['We ate all the fruit ___ the grapes.', 0, 'except'],
  ['Bad weather can ___ our trip.', 1, 'affect'], ['Did the storm ___ your journey?', 1, 'affect'],
  ['The medicine had a good ___.', 1, 'effect'], ['The sun had a warm ___ on us.', 1, 'effect'],
  ['I kicked the ___ over the fence.', 2, 'ball'], ['Dad threw me the ___.', 2, 'ball'],
  ['The baby began to ___ loudly.', 2, 'bawl'], ['Please do not ___ when you fall.', 2, 'bawl'],
  ['I picked a red ___ from the bush.', 3, 'berry'], ['The bird ate a ___.', 3, 'berry'],
  ['Dogs like to ___ bones.', 3, 'bury'], ['Pirates ___ their treasure.', 3, 'bury'],
  ['Press the ___ to stop the bike.', 4, 'brake'], ['The car needs a new ___.', 4, 'brake'],
  ['Do not ___ the glass.', 4, 'break'], ['I hope this plate will not ___.', 4, 'break'],
  ['It is not ___ to push in.', 5, 'fair'], ['We played a ___ game.', 5, 'fair'],
  ['The bus ___ is two pounds.', 5, 'fare'], ['Dad paid my train ___.', 5, 'fare'],
  ['A ___ white shark swam by.', 6, 'great'], ['That was a ___ film!', 6, 'great'],
  ['Please ___ the cheese for me.', 6, 'grate'], ['We ___ carrots for the salad.', 6, 'grate'],
  ['The tree has ___ very tall.', 7, 'grown'], ['My brother has ___ taller than me.', 7, 'grown'],
  ['The sleepy giant gave a ___.', 7, 'groan'], ['We heard a ___ from the cave.', 7, 'groan'],
  ['___ is my coat.', 8, 'Here'], ['Come and sit ___ by me.', 8, 'here'],
  ['Can you ___ the bird sing?', 8, 'hear'], ['I can ___ a drum.', 8, 'hear'],
  ['A stone hurt my ___.', 9, 'heel'], ['My sock has a hole in the ___.', 9, 'heel'],
  ['The cut will ___ in a week.', 9, 'heal'], ['Plasters help a graze ___.', 9, 'heal'],
  ['I think ___ be here soon.', 9, "he'll"], ['Ask Dan, ___ know the answer.', 9, "he'll"],
  ['There is a ___ in my laces.', 10, 'knot'], ['Dad tied a ___ in the rope.', 10, 'knot'],
  ['I did ___ see the bus.', 10, 'not'], ['It is ___ time for bed yet.', 10, 'not'],
];

/** d1 the eight concrete two-word sets; d2 adds heel/heal/he'll; d3 adds accept/except and affect/effect. */
const D1_SETS = [2, 3, 4, 5, 6, 7, 8, 10];
const SETS_BY_DIFF: Record<Difficulty, number[]> = { 1: D1_SETS, 2: [...D1_SETS, 9], 3: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

export const y3Homophones: Generator = (d, rng) => {
  const sets = SETS_BY_DIFF[d];
  const [sent, si, ans] = pick(rng, HOMOPHONE_BANK.filter(r => sets.includes(r[1])));
  const up = sent.startsWith('___');
  const others = Y34_HOMOPHONE_SETS_1[si].filter(w => w !== ans.toLowerCase()).map(w => (up ? cap(w) : w));
  return wordQ(rng, sent, ans, others, { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Which spelling fits the sentence?', hintIsData: false });
};
