// "Which picture starts like snake?" (#928): Reception's first sound-to-sound topic. Parked beside
// `reception.ts` like the other any-order topic files, so that file stays under its size budget.
import type { Generator, Rng } from './types';
import { anyOrderQ } from './any-order';
import { pick, shuffle, wordQ, CVC, PHASE2, PHASE2B } from './util';

/** [keyword, emoji, Unicode short name]. None is a `CVC` word, so a keyword is never among its own options. */
export const R_INITIAL_KEYWORDS: [string, string, string][] = [
  ['snake', '🐍', 'snake'], ['penguin', '🐧', 'penguin'], ['bear', '🐻', 'bear'], ['kite', '🪁', 'kite'],
  ['monkey', '🐒', 'monkey'], ['duck', '🦆', 'duck'], ['tiger', '🐯', 'tiger face'], ['frog', '🐸', 'frog'],
  ['horse', '🐴', 'horse face'], ['lion', '🦁', 'lion'], ['whale', '🐳', 'spouting whale'], ['rabbit', '🐰', 'rabbit face'],
  ['elephant', '🐘', 'elephant'],
];

const FAMILY = new Map([...PHASE2, ...PHASE2B].filter(s => s[0].length === 1).map(s => [s[0], s[1]]));
/** The phoneme family a word starts with, from the Sound Hunt bank, so `c` and `k` count as one sound. */
export const initialFamily = (word: string): string => FAMILY.get(word[0]) ?? word[0];

const matches = (kw: string) => CVC.filter(([w]) => initialFamily(w) === initialFamily(kw));
/** d3 draws only sounds with at least three pictures behind them (2–3 targets and a decoy-free draw). */
const MANY = R_INITIAL_KEYWORDS.filter(([k]) => matches(k).length >= 3);
const ONE = R_INITIAL_KEYWORDS.filter(([k]) => matches(k).length >= 1);

/** `n` pictures whose first sound is not the keyword's, no two sharing a first sound. */
function decoys(rng: Rng, kw: string, n: number): string[] {
  const seen = new Set([initialFamily(kw)]);
  const out: string[] = [];
  for (const [w, e] of shuffle(rng, CVC)) {
    const f = initialFamily(w);
    if (!seen.has(f) && out.length < n) { seen.add(f); out.push(e); }
  }
  return out;
}

export const rInitial: Generator = (d, rng) => {
  const [kw, kwEmoji] = pick(rng, d === 3 ? MANY : ONE);
  const visual = { type: 'word' as const, text: kw, emoji: kwEmoji };
  const hint = `Say ${kw} slowly. What sound does it start with?`;
  const targets = shuffle(rng, matches(kw)).map(([, e]) => e);
  if (d < 3) {
    const say = `Which picture starts like ${kw}?`;
    return wordQ(rng, say, targets[0], decoys(rng, kw, d === 1 ? 2 : 3), { visual, say, hint, hintIsData: false });
  }
  const t = rng() < 0.5 ? 2 : 3;
  const say = `Slice every picture that starts like ${kw}`;
  return anyOrderQ(rng, say, targets.slice(0, t), decoys(rng, kw, 5 - t), { visual, say, hint, hintIsData: false });
};
