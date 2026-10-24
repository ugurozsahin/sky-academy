// y1-when (#979, #2322): see the generator below.
import type { Generator, Question } from './types';
import { ri, shuffle, wordQ } from './util';

/** "My Day" (#979): two fixed ordered lists; the answer is the list neighbour, never wrapping. */
const DAY_PARTS = ['morning', 'afternoon', 'evening'];
const DAY_PART_EMOJI = ['🌅', '☀️', '🌇'];
const DAY_WORDS = ['yesterday', 'today', 'tomorrow'];
export const y1When: Generator = (d, rng) => {
  // #2322: a day part is a picture bubble and the voice says the word; the three pictures are the ones on the strip
  const pic = (w: string) => DAY_PART_EMOJI[DAY_PARTS.indexOf(w)];
  const picQ = (q: Question): Question => ({ ...q, answer: pic(q.answer), options: q.options.map(pic), wide: false, hint: 'Slice the picture', hintIsData: false } as Question);
  return picturePart(y1WhenWords(d, rng), picQ);
};
const picturePart = (q: Question, picQ: (q: Question) => Question): Question => q.options.every(o => DAY_PARTS.includes(o)) ? picQ(q) : q;
const y1WhenWords: Generator = (d, rng) => {
  const hint = { hint: 'Slice the word', hintIsData: false };
  const kind = d === 1 ? 0 : d === 2 ? ri(rng, 0, 2) : ri(rng, 1, 3);
  const first = 'Which part of the day comes first?';
  if (d === 1 && rng() < 0.25) return wordQ(rng, first, DAY_PARTS[0], DAY_PARTS.slice(1), { say: first, ...hint });  // keeps d1 above the suite's variety floor
  if (kind === 0) {                                              // strip with one day part hidden
    const gap = ri(rng, 0, 2), ans = DAY_PARTS[gap];
    const text = DAY_PART_EMOJI.map((e, i) => (i === gap ? '_' : e)).join(' ');
    return wordQ(rng, 'Which part of the day is missing?', ans, DAY_PARTS.filter(x => x !== ans), { visual: { type: 'strip', text }, say: 'Which part of the day is missing? Morning, afternoon or evening?', ...hint });
  }
  const parts = d === 2 ? kind === 2 : rng() < 0.5;              // d2: kind 1 = word cards, kind 2 = day parts
  const list = parts ? DAY_PARTS : DAY_WORDS, other = parts ? DAY_WORDS : DAY_PARTS;
  const decoys = (ans: string) => [...shuffle(rng, list.filter(x => x !== ans)), ...shuffle(rng, other)];
  if (parts && rng() < 0.3) {
    return wordQ(rng, first, DAY_PARTS[0], decoys(DAY_PARTS[0]), { say: first, ...hint });
  }
  const after = rng() < 0.5, i = after ? ri(rng, 0, 1) : ri(rng, 1, 2), ans = list[after ? i + 1 : i - 1];
  const q2 = `What comes ${after ? 'after' : 'before'} ${list[i]}?`;
  return wordQ(rng, q2, ans, decoys(ans), { say: q2, ...hint });
};
