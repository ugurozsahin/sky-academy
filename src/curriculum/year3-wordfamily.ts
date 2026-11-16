// y3-wordfamily (#1107): Year 3 word families — words related in form and meaning (English Appendix 2, Year 3,
// Word p.3: solve, solution, solver, dissolve, insoluble). Oracle: membership in FAMILIES. Decoys come only from
// other families here, so each is a real word from a clearly different root; lookalikes such as solar or sigh
// (shared letters, no shared meaning) are never used. No word is in two families, root included.
import type { Difficulty, Generator, Question } from './types';
import { pick, shuffle } from './util';
import { anyOrderQ } from './any-order';

export type Family = readonly [root: string, members: readonly string[]];

export const FAMILIES: readonly Family[] = [
  ['solve', ['solution', 'solver', 'dissolve', 'insoluble']],
  ['help', ['helpful', 'helper', 'helpless', 'unhelpful']],
  ['act', ['action', 'actor', 'react', 'active']],
  ['sign', ['signal', 'signature', 'design']],
  ['child', ['children', 'childhood', 'childish']],
  ['know', ['knowledge', 'known', 'unknown']],
  ['cycle', ['bicycle', 'cyclist', 'recycle']],
  ['medicine', ['medical', 'medic', 'medically']],
  ['play', ['player', 'playful', 'replay', 'playground']],
  ['care', ['careful', 'careless', 'carer']],
];

const others = (root: string): string[] => FAMILIES.filter(f => f[0] !== root).flatMap(f => f[1]);

/** The affixes the families use (#2321): a decoy that wears the answer's affix looks like a family member without being one. */
export const SUFFIXES = ['ful', 'less', 'er', 'or', 'ist', 'al', 'ive', 'hood', 'ish', 'ion', 'ly', 'ure'] as const;
export const PREFIXES = ['un', 're', 'dis', 'in', 'bi'] as const;
export const affixesOf = (w: string): string[] => [
  ...SUFFIXES.filter(a => w.endsWith(a) && w.length > a.length + 2), ...PREFIXES.filter(a => w.startsWith(a) && w.length > a.length + 2),
];
/** Decoys from other families, those sharing an affix with `like` first, then the rest; each tier shuffled. */
const decoysFor = (rng: () => number, root: string, like: readonly string[], n: number): string[] => {
  const pool = others(root), aff = new Set(like.flatMap(affixesOf));
  const shares = (w: string): boolean => affixesOf(w).some(a => aff.has(a));
  return [...shuffle(rng, pool.filter(shares)), ...shuffle(rng, pool.filter(w => !shares(w)))].slice(0, n);
};

/** #2318: the family a word belongs to, for the why line. */
const rootOf = (w: string): string => FAMILIES.find(f => f[1].includes(w))![0];
const joinWords = (ws: readonly string[]): string => ws.length === 2 ? `${ws[0]} and ${ws[1]}` : `${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`;

const memberQ = (rng: () => number): Question => {
  const [root, members] = pick(rng, FAMILIES);
  const answer = pick(rng, members);
  const decoys = decoysFor(rng, root, [answer], 2);
  const prompt = `Which word is in the same family as ${root}?`;
  return { prompt, answer, options: shuffle(rng, [answer, ...decoys]), wide: true, say: prompt, hint: 'Look for the same root word', hintIsData: false, why: `${answer} is built from the root ${root}.` };
};

const oddQ = (rng: () => number): Question => {
  const [root, members] = pick(rng, FAMILIES.filter(f => f[1].length >= 3));
  const three = shuffle(rng, members).slice(0, 3);
  const answer = decoysFor(rng, root, three, 1)[0];
  const prompt = `Which word is not in the ${root} family?`;
  return { prompt, answer, options: shuffle(rng, [answer, ...three]), wide: true, say: prompt, hint: 'Three words share one root', hintIsData: false, why: `${answer} comes from ${rootOf(answer)}, not ${root}.` };
};

const allQ = (rng: () => number): Question => {
  const [root, members] = pick(rng, FAMILIES);
  const targets = shuffle(rng, members).slice(0, rng() < 0.5 ? 2 : 3);
  const decoys = decoysFor(rng, root, targets, 2);
  const prompt = `Slice every word in the ${root} family.`;
  return anyOrderQ(rng, prompt, targets, decoys, { wide: true, say: prompt, hint: 'They all share the same root', hintIsData: false, why: `${joinWords(targets)} all come from ${root}.` });
};

export const y3WordFamily: Generator = (d: Difficulty, rng) => (d === 1 ? memberQ(rng) : d === 2 ? oddQ(rng) : allQ(rng));
