import { AVOID, CVC, finalIsGenuine, gapDecoys, medialIsGenuine, R_LETTERS_ALL, R_LETTERS_P2 }
  from '../../../src/curriculum/writing';

/**
 * Every Reception gap card, rebuilt from the same inputs `rLetterSound` uses (#418 review).
 *
 * `rLetterSound` is the one gap generator whose decoy pool is not `gapLetters`, so no rail that reads
 * `gapLetters` can see its cards — which is how four slurs sat on a four-year-old's bubbles through three
 * sweeps. The shapes here mirror the generator exactly: d1 gaps the first sound from the phase-2 pool, d2 the
 * last from the full pool, d3 the middle from the vowels. If the generator's shape changes, this drifts —
 * so `tests/unit/curriculum.test.ts` checks these frames against cards the real generator actually draws.
 */
const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const rLetters = (d: 1 | 2 | 3) => (d === 1 ? R_LETTERS_P2 : R_LETTERS_ALL);
const rWords = (d: 1 | 2 | 3) => { const pool = rLetters(d); return CVC.filter(([w]) => [...w].every(c => pool.includes(c))); };

export type Frame = { d: 1 | 2 | 3; word: string; idx: number; pool: string[] };

export const receptionGapFrames = (): Frame[] => [
  ...rWords(1).map(([word]) => ({ d: 1 as const, word, idx: 0, pool: rLetters(1) })),
  ...rWords(2).filter(([w]) => finalIsGenuine(w)).map(([word]) => ({ d: 2 as const, word, idx: 2, pool: rLetters(2) })),
  ...rWords(3).filter(([w]) => medialIsGenuine(w)).map(([word]) => ({ d: 3 as const, word, idx: 1, pool: VOWELS })),
];

/** Every distinct spelling a Reception gap card can show, sorted — the answer's own included. */
export const receptionGapSpellings = (): string[] => {
  const out = new Set<string>();
  for (const f of receptionGapFrames()) {
    out.add(f.word);
    for (const l of gapDecoys(f.word, f.idx, f.pool)) out.add(f.word.slice(0, f.idx) + l + f.word.slice(f.idx + 1));
  }
  return [...out].sort();
};

/** The spellings `AVOID` is keeping off a Reception card — non-empty, or the filter is doing nothing. */
export const receptionBlocked = (): string[] => {
  const out = new Set<string>();
  for (const f of receptionGapFrames())
    for (const l of f.pool) {
      const filled = f.word.slice(0, f.idx) + l + f.word.slice(f.idx + 1);
      if (l !== f.word[f.idx] && AVOID.has(filled)) out.add(filled);
    }
  return [...out].sort();
};
