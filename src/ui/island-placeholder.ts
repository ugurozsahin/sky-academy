import type { YearInfo } from '../curriculum';

// #1032: a plain island in the row's own tint (opaque) on the `--ink` base, the year's short label centred.
// Colours are literal because a data-URI SVG cannot read the page's CSS custom properties — these two hex
// values are `design-language`'s `--ink` and `--text` tokens, copied rather than referenced, same as the
// three ART_* consts in curriculum/types.ts already do for their own colours.
const INK = '#0d1226';
const TEXT = '#f4f6ff';

const svg = (short: string, tint: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'>` +
  `<rect width='120' height='70' fill='${INK}'/>` +
  `<ellipse cx='60' cy='40' rx='46' ry='22' fill='${tint}'/>` +
  `<text x='60' y='40' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-weight='700' font-size='24' fill='${TEXT}'>${short}</text>` +
  `</svg>`;

/** `y.art` when set, otherwise a code-drawn placeholder — so a KS2 island can appear on the map before the
 *  owner's art (#1299–#1302) exists, with no "coming soon" text of any kind. */
export function islandArt(y: YearInfo): string {
  if (y.art) return y.art;
  const opaque = y.tint.length === 9 ? y.tint.slice(0, 7) : y.tint; // drop the border tint's trailing alpha byte
  return `data:image/svg+xml,${encodeURIComponent(svg(y.short, opaque))}`;
}
