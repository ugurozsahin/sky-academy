import { waveRadius, fitLabelLines, LABEL_READABLE_FS } from '../../../src/game/bubbles';
import { FREDOKA_700_ADVANCES } from './fredoka-700-advances';

// #1046: the phone width the readable-size floor is measured against — the same 390px `bubbleRadius`'s own
// evidence numbers (33.15px, 41.4px) were measured at. Height only has to be `>= width` for `bubbleRadius`'s
// `Math.min(W, H)` to pick the width; 664 is this repo's own e2e phone viewport (`tests/e2e/game.spec.ts`).
const PHONE_W = 390, PHONE_H = 664;

/**
 * Sum of Fredoka-700 advance widths (em) for `text`. Throws on any character missing from the committed
 * table, or on an empty label — either would otherwise divide/measure as zero width and read as maximally
 * readable, the opposite of what a rail whose whole job is catching too-small text should ever do.
 */
export function labelEm(text: string): number {
  if (text.length === 0) throw new Error('labelEm: empty label');
  let sum = 0;
  for (const ch of text) {
    const em = FREDOKA_700_ADVANCES[ch];
    if (em === undefined) throw new Error(`fredoka-700-advances.ts has no entry for "${ch}" (from label "${text}")`);
    sum += em;
  }
  return sum;
}

// `fitLabel`/`fitLabelLines` (`src/game/bubbles.ts`) take a `measure(font, text)` callback so they can be
// driven without a canvas (the same reason `bubbleRadius` is documented "pure"). This is that callback,
// built off the committed advance table instead of `CanvasRenderingContext2D.measureText`: `font` is always
// `labelFont(fs)`, so its pixel size is read back out of the string it was built from.
function measureViaTable(font: string, text: string): number {
  const fs = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]);
  if (!Number.isFinite(fs)) throw new Error(`r-lbl: cannot read a font size out of "${font}"`);
  return fs * labelEm(text);
}

/**
 * R-LBL (#1046): every KS2 card's bubble labels must render at `LABEL_READABLE_FS` (13px) or above on a
 * 390px phone. Drives the real `fitLabelLines` — the exact function the running game fits a label with,
 * including its length-bucketed starting size, its shrink-to-fit floor, and its one-line-vs-wrapped choice —
 * rather than a re-derived formula: an earlier version of this file computed its own `LINE_BUDGET * r / em`
 * estimate, which could report a label as readable when `fitLabelLines` would actually have drawn it smaller
 * (review finding, #1046). `waveRadius` is the same radius `layoutWave` lays real waves out at.
 *
 * Returns the first option that fails, naming the fix (#1046 acceptance criteria), or `null` if every
 * option is readable.
 */
export function rLblProblem(q: { options: string[]; wide?: boolean }): string | null {
  const r = waveRadius(PHONE_W, PHONE_H, !!q.wide, q.options.length);
  for (const label of q.options) {
    const fit = fitLabelLines(label, r, measureViaTable);
    if (fit.fs < LABEL_READABLE_FS) {
      return `"${label}" draws at ${fit.fs.toFixed(1)}px (r ${r.toFixed(1)}, ${q.options.length} options) — put the term on the card; bubbles carry a letter, yes/no, a symbol or a digit`;
    }
  }
  return null;
}
