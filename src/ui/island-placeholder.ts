import type { YearInfo } from '../curriculum';

// #1032: a plain island in the row's own tint (opaque) on the `--ink` base, the year's short label centred.
// Colours are literal because a data-URI SVG cannot read the page's CSS custom properties — these two hex
// values are `design-language`'s `--ink` and `--text` tokens, copied rather than referenced, same as the
// three ART_* consts in curriculum/types.ts already do for their own colours.
const INK = '#0d1226';
const TEXT = '#f4f6ff';

// #1327: the five XML-significant characters — `encodeURIComponent` on the whole string below makes a valid
// *URI*, not valid *XML*, and a browser renders a malformed data-URI SVG as nothing, silently. Not `dom.ts`'s
// `esc()`, which leaves `'` raw while every attribute here is single-quoted. Identity on `[A-Za-z0-9#]`, which
// is all today's rows use (`tests/unit/shown-years.test.ts` pins the output byte-for-byte for them); anything
// else a `short` could carry — a control character, say — is the data-source rail's to refuse, not this line's.
const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' };
export const escapeXml = (s: string) => s.replace(/[&<>'"]/g, c => XML_ESCAPES[c]);

const svg = (short: string, tint: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'>` +
  `<rect width='120' height='70' fill='${INK}'/>` +
  `<ellipse cx='60' cy='40' rx='46' ry='22' fill='${escapeXml(tint)}'/>` +
  `<text x='60' y='40' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-weight='700' font-size='24' fill='${TEXT}'>${escapeXml(short)}</text>` +
  `</svg>`;

/** `y.art` when set, otherwise a code-drawn placeholder — so a KS2 island can appear on the map before the
 *  owner's art (#1299–#1302) exists, with no "coming soon" text of any kind. */
export function islandArt(y: YearInfo): string {
  if (y.art) return y.art;
  const opaque = y.tint.length === 9 ? y.tint.slice(0, 7) : y.tint; // drop the border tint's trailing alpha byte
  return `data:image/svg+xml,${encodeURIComponent(svg(y.short, opaque))}`;
}
