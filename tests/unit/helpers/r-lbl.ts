import { bubbleRadius, splitLabel, LINE_BUDGET, LABEL_READABLE_FS } from '../../../src/game/bubbles';
import { FREDOKA_700_ADVANCES } from './fredoka-700-advances';

// #1046: the phone width the readable-size floor is measured against — the same 390px `bubbleRadius`'s own
// evidence numbers (33.15px, 41.4px) were measured at. Height only has to be `>= width` for `bubbleRadius`'s
// `Math.min(W, H)` to pick the width; 664 is this repo's own e2e phone viewport (`tests/e2e/game.spec.ts`).
const PHONE_W = 390, PHONE_H = 664;

/**
 * Sum of Fredoka-700 advance widths (em) for `text`. Throws on any character missing from the committed
 * table (#1046) — a KS2 label using a glyph never measured must fail loudly, not silently count as zero
 * width and pass a rail it was never actually checked against.
 */
export function labelEm(text: string): number {
  let sum = 0;
  for (const ch of text) {
    const em = FREDOKA_700_ADVANCES[ch];
    if (em === undefined) throw new Error(`fredoka-700-advances.ts has no entry for "${ch}" (from label "${text}")`);
    sum += em;
  }
  return sum;
}

// A label `splitLabel` can break onto two lines is measured by its wider half (#1046 proposed fix) — the
// same line `fitLabelLines` (`src/game/bubbles.ts`) would end up drawing once it wraps.
function measuredEm(label: string): number {
  const split = splitLabel(label);
  return split ? Math.max(labelEm(split[0]), labelEm(split[1])) : labelEm(label);
}

/**
 * R-LBL (#1046): every KS2 card's bubble labels must render at `LABEL_READABLE_FS` (13px) or above on a
 * 390px phone. `fs = LINE_BUDGET * r / em` is the same relationship `fitLabel`'s shrink-to-fit loop
 * converges on (`src/game/bubbles.ts`) — measured statically here so a whole registry can be swept without
 * a canvas. `r` narrows exactly as `layoutWave` narrows it for a crowded wave: ×0.9 at 7–8 options, ×0.8 at
 * 9 or more.
 *
 * Returns the first option that fails, naming the fix (#1046 acceptance criteria), or `null` if every
 * option is readable.
 */
export function rLblProblem(q: { options: string[]; wide?: boolean }): string | null {
  const base = bubbleRadius(PHONE_W, PHONE_H, !!q.wide);
  const n = q.options.length;
  const r = base * (n >= 9 ? 0.8 : n >= 7 ? 0.9 : 1);
  for (const label of q.options) {
    const fs = (LINE_BUDGET * r) / measuredEm(label);
    if (fs < LABEL_READABLE_FS) {
      return `"${label}" draws at ${fs.toFixed(1)}px (r ${r.toFixed(1)}, ${n} options) — put the term on the card; bubbles carry a letter, yes/no, a symbol or a digit`;
    }
  }
  return null;
}
