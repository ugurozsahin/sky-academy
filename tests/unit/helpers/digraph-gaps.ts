import { AVOID, DIGRAPHS, DIGRAPH_WORDS } from '../../../src/curriculum/writing';

/**
 * Every `y1-digraphs` gap card, rebuilt from the same inputs `y1Digraphs` uses (#445).
 *
 * `y1Digraphs` is the one gap generator whose decoy pool is neither `gapLetters` nor `gapDecoys` — it slices a
 * two-letter digraph out of a word and offers other digraphs in its place, so no rail that reads either filter
 * can see its cards. The shape here mirrors the generator exactly: for each `DIGRAPH_WORDS` entry, the digraph's
 * own index in the word, and every other `DIGRAPHS` entry as a possible decoy. If the generator's shape changes,
 * this drifts — so `tests/unit/curriculum.test.ts` checks these frames against cards the real generator draws.
 */
export type Frame = { word: string; dg: string; idx: number };

export const digraphFrames = (): Frame[] =>
  DIGRAPH_WORDS.map(([word, dg]) => {
    const idx = word.indexOf(dg);
    // A DIGRAPH_WORDS entry whose digraph is not actually in its word would compose a wrong spelling
    // silently (`indexOf` returns -1, and slicing at -1 still produces a string) rather than fail loudly —
    // review of #445 (type-design-analyzer).
    if (idx === -1) throw new Error(`DIGRAPH_WORDS entry "${word}" does not contain its own digraph "${dg}"`);
    return { word, dg, idx };
  });

/** Every distinct spelling a `y1-digraphs` card can show, sorted — the answer's own included. */
export const digraphSpellings = (): string[] => {
  const out = new Set<string>();
  for (const { word, dg, idx } of digraphFrames()) {
    out.add(word);
    for (const decoy of DIGRAPHS.filter(x => x !== dg)) out.add(word.slice(0, idx) + decoy + word.slice(idx + 2));
  }
  return [...out].sort();
};

/** The spellings `AVOID` would be keeping off a `y1-digraphs` card, if any reached it — empty today. */
export const digraphBlocked = (): string[] => {
  const out = new Set<string>();
  for (const { word, dg, idx } of digraphFrames())
    for (const decoy of DIGRAPHS.filter(x => x !== dg)) {
      const filled = word.slice(0, idx) + decoy + word.slice(idx + 2);
      if (AVOID.has(filled)) out.add(filled);
    }
  return [...out].sort();
};
