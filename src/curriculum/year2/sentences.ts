// Year 2 sentences: sentence types, tense, punctuation, sentence building. Split out of year2.ts (#1416); index.ts re-exports every name.
import { type Generator } from '../types';
import { ri, pick, wordQ, sentGen, type Sent, PUNCT_SENTS } from '../util';

/**
 * Sentence types (#299 slice 3, NC English Appendix 2 Year 2): `[sentence, type]`.
 *
 * The four forms are taught as a set, so the card shows one sentence and asks which it is. What keeps exactly
 * one answer defensible is the English KS1 convention the bank is built to: a **question** ends with `?`; an
 * **exclamation** is the `What …!` / `How …!` form and nothing else (`Look out!` is a command, however loudly
 * it is said); a **statement** and a **command** both end with a full stop, so those two can only be told
 * apart by reading — which is the point of the topic.
 *
 * That last pair is why no command here ends with `!`: it would be correct English and would still make the
 * card a punctuation-spotting exercise with two defensible answers.
 */
export const SENTENCE_TYPE_NAMES = ['statement', 'question', 'command', 'exclamation'] as const;
export type SentenceType = typeof SENTENCE_TYPE_NAMES[number];
export const SENTENCE_TYPES: ReadonlyArray<readonly [string, SentenceType]> = [
  ['The cat sat on the mat.', 'statement'],
  ['Ninjas train every day.', 'statement'],
  ['My bike is bright red.', 'statement'],
  ['We went to the park.', 'statement'],
  ['The sun is shining today.', 'statement'],
  ['Our school has a new roof.', 'statement'],
  ['Where is my hat?', 'question'],
  ['Can you swim?', 'question'],
  ['What is your name?', 'question'],
  ['Who took the last biscuit?', 'question'],
  ['Are we there yet?', 'question'],
  ['How old is your dog?', 'question'],
  ['Close the door.', 'command'],
  ['Wash your hands.', 'command'],
  ['Put on your coat.', 'command'],
  ['Line up quietly.', 'command'],
  ['Pass me the ball.', 'command'],
  ['Tidy your bedroom.', 'command'],
  ['What a lovely day it is!', 'exclamation'],
  ['How tall that tree is!', 'exclamation'],
  ['What a mess we made!', 'exclamation'],
  ['How quickly she ran!', 'exclamation'],
  ['What big ears you have!', 'exclamation'],
  ['How brave you are!', 'exclamation'],
];
/**
 * d1 is the pair a Year 1 child already meets (a sentence that tells you something, a sentence that asks);
 * d2 adds the command, which shares its full stop with the statement; d3 adds the exclamation.
 *
 * The bubbles are the types unlocked so far, not all four, so d1 is a two-way choice rather than a guess
 * between words the child has not been taught yet.
 */
export const y2SentenceType: Generator = (d, rng) => {
  const allowed = SENTENCE_TYPE_NAMES.slice(0, d === 1 ? 2 : d === 2 ? 3 : 4);
  const [sent, type] = pick(rng, SENTENCE_TYPES.filter(e => allowed.includes(e[1])));
  return wordQ(rng, 'What kind of sentence is this?', type, allowed.filter(n => n !== type), {
    visual: { type: 'sentence', text: sent }, say: `${sent} What kind of sentence is this?`,
    hint: 'Does it tell, ask, order or exclaim?', hintIsData: false,
  });
};
/**
 * Present and past (#299 slice 3, NC English Appendix 2 Year 2): `TENSE_VERBS` is `[base, he/she present,
 * past, -ing]` and `TENSE_FRAMES` is `[frame with one gap, the column that fills it, the tense of the
 * finished sentence]`. Every frame takes every verb, so the two tables multiply out instead of being written
 * card by card.
 *
 * A frame carries its own tense — a time phrase (`Yesterday`) or the auxiliary (`is`/`was`) — which is what
 * makes exactly one of the four forms fit the gap at d3: `Yesterday he walking` and `Yesterday he walks` are
 * both wrong, and a child who writes either is making the mistake this topic is for. The past-progressive
 * frames carry no time phrase at all, so `was` against `is` is the only thing that answers them.
 */
export const TENSE_VERBS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['walk', 'walks', 'walked', 'walking'], ['jump', 'jumps', 'jumped', 'jumping'],
  ['shout', 'shouts', 'shouted', 'shouting'], ['smile', 'smiles', 'smiled', 'smiling'],
  ['clap', 'claps', 'clapped', 'clapping'], ['skip', 'skips', 'skipped', 'skipping'],
  ['dance', 'dances', 'danced', 'dancing'], ['laugh', 'laughs', 'laughed', 'laughing'],
  ['drum', 'drums', 'drummed', 'drumming'], ['hide', 'hides', 'hid', 'hiding'],
  // Irregular pasts: the form a child cannot build with a rule, and the reason a bank beats a suffix.
  ['run', 'runs', 'ran', 'running'], ['sing', 'sings', 'sang', 'singing'],
  ['swim', 'swims', 'swam', 'swimming'], ['sit', 'sits', 'sat', 'sitting'],
  ['sleep', 'sleeps', 'slept', 'sleeping'], ['fly', 'flies', 'flew', 'flying'],
];
/** 1 = he/she present, 2 = past, 3 = the `-ing` form the progressive frames need. */
type TenseCol = 1 | 2 | 3;
export const TENSE_FRAMES: ReadonlyArray<readonly [string, TenseCol, 'present' | 'past']> = [
  ['Every day she ___ in the garden.', 1, 'present'],
  ['Every morning he ___ in the park.', 1, 'present'],
  ['Yesterday he ___ in the garden.', 2, 'past'],
  ['Last week she ___ in the park.', 2, 'past'],
  ['She is ___ in the garden now.', 3, 'present'],
  ['They are ___ in the park.', 3, 'present'],
  ['He was ___ in the garden.', 3, 'past'],
  ['We were ___ in the park.', 3, 'past'],
];
/**
 * d1 and d2 name the tense of a finished sentence — d1 on the simple forms, d2 with the progressive, where
 * the auxiliary rather than the verb ending carries the tense. d3 turns the same sentence round and asks the
 * child to produce the form the gap needs, with all four forms of that one verb on the bubbles.
 */
export const y2Tense: Generator = (d, rng) => {
  const [frame, col, tense] = pick(rng, d === 1 ? TENSE_FRAMES.filter(f => f[1] !== 3) : TENSE_FRAMES);
  const v = pick(rng, TENSE_VERBS);
  if (d === 3) return wordQ(rng, frame, v[col], v.filter(w => w !== v[col]), {
    visual: { type: 'sentence', text: frame }, say: frame.replace('___', 'blank'),
    hint: 'Which form of the word fits?', hintIsData: false,
  });
  const sent = frame.replace('___', v[col]);
  return wordQ(rng, 'Present or past?', tense, [tense === 'past' ? 'present' : 'past'], {
    visual: { type: 'sentence', text: sent }, say: `${sent} Is this sentence in the present or the past?`,
    hint: 'Is it happening now, or has it happened already?', hintIsData: false,
  });
};
export const y2Punct: Generator = (d, rng) => {
  const k = d === 1 ? 0 : ri(rng, 0, 2);
  if (k === 0) { const [s, p] = pick(rng, PUNCT_SENTS); return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Which punctuation mark ends this sentence?` }); }
  if (k === 1) {
    // #296: the gap never sits before "and" — English schools teach the list comma without one there.
    const L: [string, string][] = [['I like apples_ pears and plums.', ','], ['We saw lions, tigers_ bears and monkeys.', ','], ['Red, blue_ green and yellow.', ','], ['Bring a hat, coat_ scarf and gloves.', ',']];
    const [s, p] = pick(rng, L);
    return wordQ(rng, s, p, ['.', '?', ';'], { visual: { type: 'sentence', text: s }, say: 'Which mark separates the items in the list?', hint: 'Commas in a list', hintIsData: false });
  }
  const A: [string, string][] = [["The dog_s bone.", "'"], ["Sam_s hat is red.", "'"], ["My mum_s car.", "'"], ["The cat_s tail.", "'"]];
  const [s, p] = pick(rng, A);
  return wordQ(rng, s, p, [',', '.', '-'], { visual: { type: 'sentence', text: s }, say: 'Which mark shows something belongs to someone?', hint: 'Possessive apostrophe', hintIsData: false });
};
// Year 2 subordinates with `when`, `if`, `that` and `because`, and co-ordinates with `or`, `and`, `but`. No
// other subordinating conjunction belongs in this bank: d3 used to carry "Although it was cold, we went out",
// and *although* is Year 3 and beyond (#298 slice 5). Its replacement is the `that` sentence — the one Year 2
// subordinator the bank was missing. `tests/unit/curriculum.test.ts` fails if another one gets in.
const Y2_SENTS: Sent[][] = [
  [['The shiny red kite flew high.', '🪁'], ['Please shut the door quietly.', '🚪'], ['A tiny mouse hid under the chair.', '🐭'], ['The brave knight rode away.', '🏇'], ['Our class went to the museum.', '🏛️'], ['Do you like pizza or pasta?', '🍕'], ['The fluffy kitten chased a leaf.', '🐱'], ['Grandad grows tall yellow sunflowers.', '🌻'], ['What a wonderful surprise this is!', '🎁'], ['Wash your hands before lunch.', '🧼']],
  [['Sam was late because he overslept.', '⏰'], ['The old man walked slowly home.', '👴'], ['We stayed inside because it rained.', '🌧️'], ['She smiled when she saw the puppy.', '🐶'], ['The rocket zoomed into dark space.', '🚀'], ['Would you like some sweet honey?', '🍯'], ['He was tired but he kept running.', '🏃'], ['The children built a huge sandcastle.', '🏖️'], ['My sister plays the violin beautifully.', '🎻'], ['Bring an umbrella if it rains.', '☂️']],
  [['If it rains, we will stay inside.', '☂️'], ['You can play when you have finished.', '🎮'], ['The bird sang because it was happy.', '🐦'], ['We can walk or take the bus.', '🚌'], ['The dragon roared and the village shook.', '🐉'], ['I know that the snow is cold.', '🧣'], ['Please tidy your room before dinner.', '🧹'], ['The clever fox found a secret path.', '🦊'], ['Everybody cheered when our team scored.', '⚽'], ['After lunch we painted colourful pictures.', '🎨']],
];
const Y2_DECOYS = ['because', 'when', 'and', 'but', 'quickly', 'happy', 'tiny', 'huge', 'garden', 'school', 'dragon', 'river', 'shiny', 'after', 'before', 'yellow', 'kite', 'mouse'];
export const y2Sentence = sentGen(Y2_SENTS, Y2_DECOYS, [2, 3, 3], 1);
