// y3-prefix (#1103): the Year 3–4 "more prefixes" of English Appendix 1 (p.11–12). d1 names the prefix for a meaning,
// d2 picks the word for a definition, d3 builds the word from its prefix and root. Hand-curated: every word is real,
// every decoy is a real word or prefix, and a decoy never shares the answer's meaning (dis- and mis- are both "wrong").
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type PrefixRow = [word: string, prefix: string, root: string, definition: string];

/** The six prefixes with a meaning of their own. dis- and mis- share "not/wrong" (p.11), so d1 never asks them. */
export const PREFIX_MEANING: Record<string, string> = { re: 'again', sub: 'under', inter: 'between', super: 'above', anti: 'against', auto: 'self' };
/** Prefixes whose meanings overlap: the same group never supplies both the answer and a decoy. */
const GROUP: Record<string, string> = { dis: 'wrong', mis: 'wrong' };
const group = (p: string) => GROUP[p] ?? p;

export const PREFIX_WORDS: PrefixRow[] = [
  ['disobey', 'dis', 'obey', 'not obey'], ['disagree', 'dis', 'agree', 'not agree'], ['dislike', 'dis', 'like', 'not like'],
  ['misspell', 'mis', 'spell', 'write a word wrongly'], ['misplace', 'mis', 'place', 'put in the wrong place'], ['mislead', 'mis', 'lead', 'lead the wrong way'],
  ['reappear', 're', 'appear', 'appear again'], ['rewrite', 're', 'write', 'write again'], ['replay', 're', 'play', 'play again'], ['rebuild', 're', 'build', 'build again'],
  ['submarine', 'sub', 'marine', 'a boat that goes under the sea'], ['subway', 'sub', 'way', 'a path under the road'], ['submerge', 'sub', 'merge', 'go under the water'],
  ['interact', 'inter', 'act', 'act with each other'], ['intercity', 'inter', 'city', 'between two cities'], ['intermix', 'inter', 'mix', 'mix among each other'],
  ['superstar', 'super', 'star', 'a star above all the rest'], ['supercar', 'super', 'car', 'a car above all the rest'], ['superhero', 'super', 'hero', 'a hero above all the rest'],
  ['antiwar', 'anti', 'war', 'against war'], ['antivirus', 'anti', 'virus', 'protects against viruses'], ['antifreeze', 'anti', 'freeze', 'stops water freezing'],
  ['autograph', 'auto', 'graph', 'your own signature'], ['autopilot', 'auto', 'pilot', 'flies a plane by itself'], ['autofocus', 'auto', 'focus', 'a camera that focuses by itself'],
];

const PREFIXES = [...new Set(PREFIX_WORDS.map(r => r[1]))];
const ROOTS = [...new Set(PREFIX_WORDS.map(r => r[2]))];

const d1 = (rng: Rng): Question => {
  const p = pick(rng, Object.keys(PREFIX_MEANING));
  const ds = shuffle(rng, Object.keys(PREFIX_MEANING).filter(x => x !== p)).slice(0, 2);
  return wordQ(rng, `Which prefix means ${PREFIX_MEANING[p]}?`, p, ds, { hint: `The prefix goes at the front of a word: ${PREFIX_MEANING[p]}`, hintIsData: false });
};

const d2 = (rng: Rng): Question => {
  const [word, prefix, root, def] = pick(rng, PREFIX_WORDS);
  const others = shuffle(rng, PREFIX_WORDS.filter(r => group(r[1]) !== group(prefix)).map(r => r[0]));
  return wordQ(rng, `Which word means ${def}?`, word, [root, ...others.slice(0, 2)], { hint: `Look at the prefix: ${prefix}`, hintIsData: false });
};

const d3 = (rng: Rng): Question => {
  const [word, prefix, root, def] = pick(rng, PREFIX_WORDS);
  const dp = pick(rng, PREFIXES.filter(p => group(p) !== group(prefix)));
  const dr = pick(rng, ROOTS.filter(r => r !== root));
  return { prompt: `Build the word: ${def}`, say: `Build the word that means ${def}`, answer: word, sequence: [prefix, root],
    options: shuffle(rng, [prefix, root, dp, dr]), hint: 'Slice the prefix, then the root', hintIsData: false };
};

export const y3Prefix: Generator = (d: Difficulty, rng) => (d === 1 ? d1 : d === 2 ? d2 : d3)(rng);
