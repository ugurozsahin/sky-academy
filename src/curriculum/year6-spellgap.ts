// y6-spellgap (#1237): SATs-style spelling. The card shows the sentence with one gap, one spoken line gives the
// sentence and the word, and the child builds the missing word. Bank: the Year 5–6 words 51–100 (#1236) plus
// about 30 Appendix 1 pattern words (-cious/-tious, -cial/-tial, -able/-ible, -fer, ough, ei after c, silent letters).
import type { Difficulty, Generator, Question } from './types';
import { pick, shuffle, spellQ } from './util';
import { chunkQ } from './spelling-ks2';
import type { WordForm } from './spelling-ks2';
import { Y6_WORDLIST } from './wordlist-y6';

/** One gap word: a list form (sentence, chunks for a long word) plus `swap`, the confusable letter of its usual misspelling. */
export type GapWord = WordForm & { swap?: string };

const g = (w: string, s: string, swap?: string, chunks?: string[], decoys?: string[]): GapWord => ({ w, s, swap, chunks, decoys });

export const GAP_PATTERN: GapWord[] = [
  g('vicious', 'The vicious storm broke the gate.', 't'),
  g('ambitious', 'She is an ambitious young artist.', 'c'),
  g('cautious', 'Be cautious when you cross the road.'),
  g('delicious', 'The soup smelt delicious.', 't'),
  g('precious', 'My gran gave me a precious ring.', 't'),
  g('conscious', 'He was conscious all the time.', 't'),
  g('suspicious', 'The fox looked suspicious to the hens.', 't', ['sus', 'pi', 'ci', 'ous'], ['ti', 'tous']),
  g('official', 'The official opened the new bridge.', 't'),
  g('special', 'Today is a very special day.', 't'),
  g('social', 'Ants are social insects.', 't'),
  g('crucial', 'A good night of sleep is crucial.', 't'),
  g('essential', 'Water is essential for life.', 'c'),
  g('artificial', 'The cake had artificial colouring.', undefined, ['ar', 'ti', 'fi', 'cial'], ['tial', 'shal']),
  g('adorable', 'The puppy looked adorable.', 'i'),
  g('sensible', 'Wearing a hat is sensible in the sun.', 'a'),
  g('possible', 'Is it possible to fly to the moon?', 'a'),
  g('visible', 'The moon was visible at noon.', 'a'),
  g('horrible', 'What a horrible smell!', 'a'),
  g('terrible', 'We had a terrible storm last night.', 'a'),
  g('flexible', 'A gymnast needs to be flexible.', 'a'),
  g('referring', 'She was referring to the red book.'),
  g('transferred', 'He transferred the water to a jug.', undefined, ['tra', 'ns', 'fer', 'red'], ['ferr', 'fur']),
  g('preferred', 'She preferred the green hat.'),
  g('though', 'It was fun, though it was cold.'),
  g('enough', 'Is there enough milk for us all?', 'f'),
  g('through', 'The train went through the tunnel.'),
  g('ceiling', 'A spider sat on the ceiling.'),
  g('receive', 'I hope to receive a card from Gran.'),
  g('deceive', 'The fox tried to deceive the hen.'),
  g('solemn', 'The room was calm and solemn.'),
  g('autumn', 'Leaves fall in autumn.'),
  g('column', 'A column of ants crossed the path.'),
];

/** The Year 5–6 list words (51–100), as the plain forms the gap card can use. */
export const GAP_LIST: GapWord[] = Y6_WORDLIST.flatMap(e => e.forms.map(f => ({ ...f })));
export const GAP_BANK: GapWord[] = [...GAP_LIST, ...GAP_PATTERN];

/** The paper orders its words by difficulty: d1 short list words, d2 adds pattern words, d3 adds the long ones. */
export const GAP_LADDER: Record<Difficulty, (x: GapWord) => boolean> = {
  1: x => GAP_LIST.includes(x) && x.w.length <= 7,
  2: x => x.w.length <= 9,
  3: () => true,
};

/** The sentence with the target word replaced by one gap; the target occurs once, as a whole word. */
export const gapped = (x: GapWord): string => x.s.replace(new RegExp(`\\b${x.w}\\b`, 'i'), '______');

export function gapQ(rng: Parameters<Generator>[1], x: GapWord): Question {
  const say = `The word is ${x.w}. ${x.s} The word is ${x.w}.`;
  const dictation = { prompt: gapped(x), say, visual: undefined, peek: true };
  if (x.chunks) return { ...chunkQ(rng, x.w, x.chunks, x.decoys ?? []), ...dictation, peekHint: 'Slice the parts in order' };
  const q = spellQ(rng, x.w);
  if (x.swap && !q.options.includes(x.swap)) {
    // Replace one decoy (never a letter of the word) with the confusable letter, so the tile count stays constant (#481).
    const i = q.options.findIndex(o => !x.w.includes(o));
    if (i >= 0) q.options[i] = x.swap;
  }
  return { ...q, ...dictation, options: shuffle(rng, q.options), peekHint: 'Slice the letters in order' };
}

export const y6Spellgap: Generator = (d, rng) => gapQ(rng, pick(rng, GAP_BANK.filter(GAP_LADDER[d])));
