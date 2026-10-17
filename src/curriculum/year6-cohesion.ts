// y6-cohesion (#1284): Year 6 linking adverbials (contrast, consequence, example; addition at d1 only) and ellipsis (English Appendix 2).
// d1 name the relation, d2 pick the linker that fits two sentences, d3 half d2 and half "Which words have been left out?".
// The linkers sit on the card (the visual: the prompt alone would wrap past #1051's three lines) and the bubbles are letters: "on the other hand" is longer than "exclamation", so it cannot be a label.
// `addition` is never offered on a passage card ("in addition" fits almost any second sentence, the #666 two-right-answers class).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type Relation = 'contrast' | 'consequence' | 'addition' | 'example';
export const RELATIONS: readonly Relation[] = ['contrast', 'consequence', 'addition', 'example'];
const NAMED: Record<Relation, string> = { contrast: 'a contrast', consequence: 'a consequence', addition: 'an addition', example: 'an example' };

export const LINKERS: Record<Relation, readonly string[]> = {
  contrast: ['on the other hand', 'in contrast', 'however'],
  consequence: ['as a consequence', 'as a result', 'therefore'],
  addition: ['furthermore', 'in addition', 'moreover'],
  example: ['for example', 'for instance'],
};

/** [sentence 1, sentence 2 (follows the gap), relation]. Never `addition`. The topic test proves each relation from word pairs. */
export type LinkRow = readonly [string, string, Exclude<Relation, 'addition'>];
export const LINK_PAIRS: readonly LinkRow[] = [
  ['Cats are quiet.', 'dogs are noisy.', 'contrast'], ['The soup was hot.', 'the ice cream was cold.', 'contrast'],
  ['Ben arrives early.', 'his brother arrives late.', 'contrast'], ['Our garden is tidy.', 'the garage is messy.', 'contrast'],
  ['The lake is shallow.', 'the sea is deep.', 'contrast'], ['Summer days are long.', 'winter days are short.', 'contrast'],
  ['It rained all morning.', 'the match was cancelled.', 'consequence'], ['Mia forgot her alarm.', 'she was late for school.', 'consequence'],
  ['Tom broke his bike chain.', 'he mended it with new links.', 'consequence'], ['The batteries ran flat.', 'the torch went dark.', 'consequence'],
  ['Lena practised every day.', 'she won the prize.', 'consequence'], ['Sam skipped breakfast.', 'he felt hungry by ten.', 'consequence'],
  ['Some fruit grows on trees.', 'apples grow on trees.', 'example'], ['Many birds visit our garden.', 'robins come every winter.', 'example'],
  ['Orchestras use many instruments.', 'the violin is one.', 'example'], ['Some animals live in the sea.', 'dolphins swim in packs.', 'example'],
  ['Lots of vegetables are green.', 'peas are small and green.', 'example'], ['Insects have six legs.', 'ants carry heavy loads.', 'example'],
];

/** [short sentence, the words ellipsis left out, full sentence, [wrong-tense decoy, word from the sentence]]. */
export type EllipsisRow = readonly [string, string, string, readonly [string, string]];
export const ELLIPSES: readonly EllipsisRow[] = [
  ['She did it because she wanted to.', 'do it', 'She did it because she wanted to do it.', ['did it', 'wanted']],
  ['Tom likes apples and Ruby pears.', 'likes', 'Tom likes apples and Ruby likes pears.', ['liked', 'apples']],
  ['I will go if you will.', 'go', 'I will go if you will go.', ['went', 'if']],
  ['Kim wanted to help, so she did.', 'help', 'Kim wanted to help, so she did help.', ['helped', 'wanted']],
  ['Leo ate two apples and Eve three.', 'ate', 'Leo ate two apples and Eve ate three.', ['eats', 'apples']],
  ['Dan can run faster than Joe can.', 'run', 'Dan can run faster than Joe can run.', ['ran', 'faster']],
  ['You can come if you want to.', 'come', 'You can come if you want to come.', ['came', 'want']],
  ['Raj said he would tidy up, and he did.', 'tidy up', 'Raj said he would tidy up, and he did tidy up.', ['tidied up', 'said']],
  ['Ella plays the piano and Sam the violin.', 'plays', 'Ella plays the piano and Sam plays the violin.', ['played', 'piano']],
  ['Ivan was cold but Pia was not.', 'cold', 'Ivan was cold but Pia was not cold.', ['colder', 'was']],
];

const LETTERS = ['A', 'B', 'C', 'D'];
const listed = (linkers: readonly string[]): string => linkers.map((l, i) => `${LETTERS[i]} ${l}`).join('\n');
const HINT = 'Contrast: the opposite. Consequence: because of it. Example: one case of it.';

/** A lettered card: one linker per offered relation, the answer is the letter of the asked relation's linker. */
function linkCard(rng: Rng, asked: Relation, offered: readonly Relation[], lead: string, visual?: string): Question {
  const chosen = shuffle(rng, offered.map(r => ({ r, l: pick(rng, LINKERS[r]) })));
  const letters = LETTERS.slice(0, chosen.length), list = listed(chosen.map(c => c.l));
  const answer = letters[chosen.findIndex(c => c.r === asked)];
  const gapped = visual?.replace('___', 'blank');
  return wordQ(rng, lead, answer, letters.filter(x => x !== answer), {
    visual: { type: 'sentence', text: visual ? `${visual}\n${list}` : list },
    say: `${gapped ? `${gapped} ` : ''}${lead}`, hint: HINT, hintIsData: false,
  });
}

function relationCard(rng: Rng): Question {
  const asked = pick(rng, RELATIONS);
  return linkCard(rng, asked, RELATIONS, `Which linking phrase shows ${NAMED[asked]}?`);
}

function passageCard(rng: Rng): Question {
  const [a, b, rel] = pick(rng, LINK_PAIRS);
  return linkCard(rng, rel, ['contrast', 'consequence', 'example'], 'Which linking phrase fits the gap?', `${a} ___, ${b}`);
}

function ellipsisCard(rng: Rng): Question {
  const [short, missing, , decoys] = pick(rng, ELLIPSES);
  return wordQ(rng, 'Which words have been left out?', missing, [...decoys], {
    visual: { type: 'sentence', text: short }, say: `${short} Which words have been left out?`,
    hint: 'Say the sentence in full: what words come back?', hintIsData: false,
  });
}

export const y6Cohesion: Generator = (d: Difficulty, rng: Rng): Question =>
  d === 1 ? relationCard(rng) : d === 2 || rng() < 0.5 ? passageCard(rng) : ellipsisCard(rng);
