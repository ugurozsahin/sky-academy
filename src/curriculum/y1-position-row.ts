import type { Generator } from './types';
import { ri, pick, shuffle, wordQ } from './util';

/**
 * #989: "between", "next to", first and last, on a row of five distinct animals (the `strip` visual). Everything is
 * index arithmetic on the row, so the oracle can be re-derived from `visual.text`. d1 first/last, d2 adds between,
 * d3 adds next to (only ever asked of an animal at an end, so it has exactly one neighbour).
 */
const ROW_ANIMALS: [string, string][] = [['🐶', 'dog'], ['🐱', 'cat'], ['🐰', 'rabbit'], ['🐸', 'frog'], ['🐟', 'fish'], ['🐢', 'turtle'], ['🐭', 'mouse'], ['🐻', 'bear'], ['🦆', 'duck']];
export const y1PositionRow: Generator = (d, rng) => {
  const row = shuffle(rng, ROW_ANIMALS).slice(0, 5);
  const glyphs = row.map(a => a[0]), name = (i: number) => `the ${row[i][1]}`;
  const list = `${row.slice(0, 4).map(a => `the ${a[1]}`).join(', ')} and ${name(4)}`;
  const form = pick(rng, d === 1 ? ['first', 'last'] : d === 2 ? ['first', 'last', 'between'] : ['first', 'last', 'between', 'next']);
  const visual = { type: 'strip' as const, text: glyphs.join(' ') };
  const ask = (prompt: string, say: string, ans: number, off: number[], decoys: number, near: number[] = []) => wordQ(rng, prompt, glyphs[ans],
    [...near, ...shuffle(rng, glyphs.map((_, i) => i).filter(i => i !== ans && !off.includes(i) && !near.includes(i)))].slice(0, decoys).map(i => glyphs[i]),
    { visual, say: `${list.replace(/^the /, 'The ')} are in a row. ${say}`, hint: 'Slice the animal', hintIsData: false });
  const decoys = d === 1 ? 2 : 3;
  if (form === 'first' || form === 'last') {
    const i = form === 'first' ? 0 : 4;
    return ask(`Which is ${form} in the row?`, `Start on the left. Which is ${form}?`, i, [], decoys, form === 'first' ? [4, 1] : [0, 3]);   // the other end, then the one beside it: what a child mixes up
  }
  if (form === 'between') {
    const i = ri(rng, 0, 2);
    return ask(`Which is between ${glyphs[i]} and ${glyphs[i + 2]}?`, `Which is between ${name(i)} and ${name(i + 2)}?`, i + 1, [i, i + 2], decoys);
  }
  const end = rng() < 0.5 ? 0 : 4;
  return ask(`Which is next to ${glyphs[end]}?`, `Which is next to ${name(end)}?`, end === 0 ? 1 : 3, [end], decoys);
};
