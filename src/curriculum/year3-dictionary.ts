// y3-dictionary (#1113): Year 3 dictionary order (NC Years 3–4: use the first 2 or 3 letters of a word to check its
// spelling in a dictionary; Years 5–6 take it to 4). Oracle: the words sorted alphabetically. At level n the words on
// a card share their first n−1 letters and differ at letter n, so the deciding letter is exactly the one the level
// names. Groups are computed from WORDS, never hand-typed. No decoys: every word on the card is placed.
import type { Difficulty, Generator, Question } from './types';
import { pick, shuffle } from './util';

export const WORDS: readonly string[] = [
  'bat', 'bed', 'bus', 'bag', 'big', 'box', 'cat', 'cow', 'cup', 'car', 'cap', 'cub', 'dog', 'dig', 'den', 'dot', 'dad',
  'fan', 'fig', 'fox', 'fun', 'hat', 'hen', 'hit', 'hot', 'hug', 'jam', 'jet', 'jug', 'leg', 'lip', 'log', 'map', 'man',
  'mud', 'net', 'nut', 'pan', 'pen', 'pig', 'pin', 'pot', 'pup', 'rug', 'red', 'sad', 'sit', 'sun', 'tap', 'ten', 'tin',
  'top', 'toy', 'van', 'web', 'wet', 'wig', 'zip',
  'stamp', 'stand', 'star', 'stay', 'steam', 'step', 'stick', 'still', 'stone', 'stop', 'store', 'storm', 'story', 'stuck',
  'chalk', 'champ', 'chant', 'chart', 'chase', 'cheap', 'check', 'cheek', 'cheer', 'chess', 'chest', 'chick', 'chill', 'chin',
  'chip', 'chop', 'clap', 'class', 'clean', 'clear', 'clock', 'close', 'cloud', 'clown', 'crab', 'crack', 'craft', 'crash',
  'crawl', 'cream', 'crisp', 'crop', 'crowd', 'crown', 'drag', 'dragon', 'drain', 'draw', 'dream', 'dress', 'drift', 'drink',
  'drip', 'drop', 'drum', 'plan', 'plant', 'plate', 'play', 'plum', 'plus', 'pram', 'press', 'price', 'print', 'prize',
  'proud', 'brain', 'brave', 'bread', 'break', 'brick', 'bridge', 'bring', 'broom', 'brown', 'brush', 'glad', 'glass', 'glow',
  'glue', 'grab', 'grape', 'grass', 'green', 'grin', 'ground', 'grow', 'shade', 'shake', 'shape', 'share', 'shark', 'sheep',
  'shelf', 'shell', 'ship', 'shirt', 'shoe', 'shop', 'short', 'show', 'thank', 'that', 'thick', 'thing', 'think', 'third',
  'this', 'three', 'throw',
];

/** Candidate groups at level n (2, 3 or 4): words sharing their first n−1 letters, one per distinct n-th letter, ≥3 letters. */
export function groups(n: number): string[][] {
  const by = new Map<string, Map<string, string>>();
  for (const w of WORDS) {
    if (w.length < n) continue;
    const m = by.get(w.slice(0, n - 1)) ?? new Map<string, string>();
    if (!m.has(w[n - 1])) m.set(w[n - 1], w);
    by.set(w.slice(0, n - 1), m);
  }
  return [...by.values()].map(m => [...m.values()]).filter(g => g.length >= 3);
}

const LEVELS: Record<Difficulty, number> = { 1: 2, 2: 3, 3: 4 };
const ORDINAL: Record<number, string> = { 2: 'second', 3: 'third', 4: 'fourth' };
const POOLS = { 2: groups(2), 3: groups(3), 4: groups(4) } as const;

export const y3Dictionary: Generator = (d: Difficulty, rng): Question => {
  const n = LEVELS[d];
  const g = pick(rng, POOLS[n as 2 | 3 | 4]);
  const size = d === 3 && g.length >= 4 && rng() < 0.5 ? 4 : 3;
  const words = shuffle(rng, g).slice(0, size);
  const sequence = [...words].sort((a, b) => a.localeCompare(b, 'en'));
  const prompt = 'Slice them in dictionary order';
  return { prompt, say: prompt, answer: sequence.join(' '), sequence, options: shuffle(rng, words), wide: true, hint: `Look at the ${ORDINAL[n]} letter`, hintIsData: false };
};
