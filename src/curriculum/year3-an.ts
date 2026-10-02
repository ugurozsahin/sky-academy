// y3-an (#1106): choose a or an for the gap. The word right after the gap decides — by its first *sound*, so d1
// and d2 teach the rule as Appendix 2 words it (consonant or vowel) and only d3 breaks the letter rule (an hour,
// a unicorn). The bank avoids words whose first sound differs between speakers (herb, historic).
import type { Generator, Question } from './types';
import { pick, wordQ } from './util';

/** [sentence with one `___`, the word directly after the gap, whether that word starts with a vowel *sound*]. */
export type AnRow = readonly [string, string, boolean];

/** d1: a noun follows the gap, and its first letter and first sound agree. */
export const AN_D1: readonly AnRow[] = [
  ['We saw ___ owl.', 'owl', true], ['I ate ___ apple.', 'apple', true], ['The hen laid ___ egg.', 'egg', true],
  ['Dad built ___ igloo.', 'igloo', true], ['Look at ___ ant!', 'ant', true], ['I met ___ elephant.', 'elephant', true],
  ['Mum cut ___ onion.', 'onion', true],
  ['I picked up ___ rock.', 'rock', false], ['We have ___ cat.', 'cat', false], ['We fed ___ dog.', 'dog', false],
  ['I saw ___ tiger.', 'tiger', false], ['She drew ___ house.', 'house', false], ['Look at ___ frog!', 'frog', false],
  ['I found ___ shell.', 'shell', false],
];

/** d2: an adjective sits between the gap and the noun, so the adjective decides; letter and sound still agree. */
export const AN_D2: readonly AnRow[] = [
  ['I found ___ open box.', 'open', true], ['We have ___ old car.', 'old', true], ['I want ___ empty jar.', 'empty', true],
  ['We saw ___ angry owl.', 'angry', true], ['She has ___ orange hat.', 'orange', true], ['Look at ___ icy lake!', 'icy', true],
  ['It was ___ easy test.', 'easy', true], ['He has ___ untidy desk.', 'untidy', true], ['I saw ___ enormous egg.', 'enormous', true],
  ['I found ___ huge egg.', 'huge', false], ['She ate ___ big apple.', 'big', false], ['We saw ___ small owl.', 'small', false],
  ['Look at ___ green ant!', 'green', false], ['I met ___ tall elephant.', 'tall', false], ['He has ___ funny hat.', 'funny', false],
  ['We saw ___ tiny ant.', 'tiny', false], ['It was ___ long road.', 'long', false],
];

/** d3: the first letter and the first sound disagree — a silent h, or a u that says "yoo". Mixed with d2 cards. */
export const AN_D3: readonly AnRow[] = [
  ['We waited ___ hour.', 'hour', true], ['I ran for ___ hour.', 'hour', true], ['She is ___ honest girl.', 'honest', true],
  ['He is ___ honest man.', 'honest', true], ['It is ___ honour to win.', 'honour', true], ['What ___ honour!', 'honour', true],
  ['I saw ___ unicorn.', 'unicorn', false], ['He wore ___ uniform.', 'uniform', false], ['It is ___ useful tool.', 'useful', false],
  ['That is ___ unit of length.', 'unit', false], ['She is ___ European girl.', 'European', false],
  ['We went to ___ university.', 'university', false], ['I saw ___ unicorn toy.', 'unicorn', false], ['It was ___ usual day.', 'usual', false],
];

export const y3An: Generator = (d, rng): Question => {
  const bank = d === 1 ? AN_D1 : d === 2 ? AN_D2 : rng() < 0.5 ? AN_D3 : AN_D2;
  const [sentence, , vowelSound] = pick(rng, bank);
  const answer = vowelSound ? 'an' : 'a';
  return wordQ(rng, 'a or an?', answer, [vowelSound ? 'a' : 'an'], {
    visual: { type: 'sentence', text: sentence }, say: sentence.replace('___', 'blank'),
    hint: "Listen to the next word's first sound", hintIsData: false,
  });
};
