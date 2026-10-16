// Year 5 grammar: linking adverbials of time, place and number (#1228). Three disjoint hand-curated lists; the card always NAMES the
// kind it wants, because "We packed our bags. ___, we set off." would otherwise take "Then", "Later" and even "Secondly".
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type Kind = 'time' | 'place' | 'number';
export const KINDS: readonly Kind[] = ['time', 'place', 'number'];

export const TIME: readonly string[] = ['later', 'afterwards', 'meanwhile', 'soon', 'eventually', 'after that', 'the next day', 'that evening'];
export const PLACE: readonly string[] = ['nearby', 'outside', 'upstairs', 'in the distance', 'next door', 'behind the shed', 'across the road'];
export const NUMBER: readonly string[] = ['firstly', 'secondly', 'thirdly'];
export const LISTS: Record<Kind, readonly string[]> = { time: TIME, place: PLACE, number: NUMBER };

/** Multi-word adverbials that fit a bubble (R-LBL, #1046): the rest are left out of the bubbles, never shrunk. */
export const BUBBLE_MULTI: readonly string[] = ['after that', 'the next day', 'next door', 'across the road'];
const SINGLE = (l: readonly string[]) => l.filter(w => !w.includes(' '));

/** [first sentence, second sentence]. Every adverbial of every kind reads grammatically before the second sentence. */
export const PASSAGES: readonly (readonly [string, string])[] = [
  ['The storm hit the town.', 'a tree fell.'], ['We packed our bags.', 'a bell rang.'], ['Mum was cooking tea.', 'the lights went out.'],
  ['The class sat down to read.', 'Mr Khan smiled.'], ['Dad parked the car.', 'a dog barked.'], ['The match began.', 'we cheered.'],
  ['Grandad opened the gate.', 'a cat ran past.'], ['The band tuned up.', 'the crowd clapped.'],
];

export const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
export const kindOf = (adv: string): Kind | undefined => KINDS.find(k => LISTS[k].includes(adv));
export const passageText = ([a, b]: readonly [string, string]): string => `${a} ___, ${b}`;

function sortCard(rng: Rng): Question {
  const adv = pick(rng, [...TIME, ...PLACE, ...NUMBER]), kind = kindOf(adv)!;
  return wordQ(rng, `What kind of adverbial is '${cap(adv)}'?`, kind, KINDS.filter(k => k !== kind), {
    visual: { type: 'sentence', text: cap(adv) }, say: `What kind of adverbial is ${adv}? Time, place or number.`,
    hint: 'Does it say when, where or in what order?', hintIsData: false,
  });
}

function chooseCard(rng: Rng, d: Difficulty): Question {
  const choose = (k: Kind) => cap(pick(rng, d === 3 && k !== 'number' ? BUBBLE_MULTI.filter(w => LISTS[k].includes(w)) : SINGLE(LISTS[k])));
  const kind = pick(rng, KINDS), passage = pick(rng, PASSAGES);
  const opts = Object.fromEntries(KINDS.map(k => [k, choose(k)])) as Record<Kind, string>;
  const text = passageText(passage), lead = d === 3 ? 'A new paragraph starts. ' : '';
  return wordQ(rng, `Which adverbial of ${kind} ${d === 3 ? 'starts the new paragraph' : 'fits'}?`, opts[kind], shuffle(rng, KINDS.filter(k => k !== kind).map(k => opts[k])), {
    visual: { type: 'sentence', text }, say: `${lead}${text.replace('___', 'blank')} Which adverbial of ${kind} fits?`,
    hint: `Which one tells you ${kind === 'time' ? 'when' : kind === 'place' ? 'where' : 'the order'}?`, hintIsData: false,
  });
}

export const y5Cohesion: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? sortCard(rng) : chooseCard(rng, d);
