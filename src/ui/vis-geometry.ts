// The `geometry` visual (#1075): angles and straight lines drawn exactly to their data, in one swappable module
// (the final look is #1305). A placeholder is plain, not approximate — the arc's sweep is `deg`, to the pixel.
import type { GeoPart, Visual } from '../curriculum';
import { esc } from './dom';

export const RAY = 16, ARC = 7, SQUARE = 6, LABEL_FS = 8;
type Pt = [number, number];
const rad = (deg: number) => deg * Math.PI / 180;
/** The point `r` away from `at` in direction `deg` (anticlockwise from the right; the page's y runs down). */
const at = (from: Pt, deg: number, r: number): Pt => [from[0] + r * Math.cos(rad(deg)), from[1] - r * Math.sin(rad(deg))];
const n1 = (n: number) => String(Math.round(n * 100) / 100);
const xy = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
const clamp = (p: Pt): Pt => [Math.min(95, Math.max(5, p[0])), Math.min(65, Math.max(5, p[1]))];

const LINE = 'fill:none;stroke:var(--text);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round';
const MARK = 'fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round';

/** The two ray end points of an angle part — what the unit test measures the angle between. */
export function rayEnds(p: Extract<GeoPart, { kind: 'angle' }>): [Pt, Pt] {
  return [at(p.at, p.dir, RAY), at(p.at, p.dir + p.deg, RAY)];
}
const finite = (...n: number[]) => n.every(Number.isFinite);
const text = (label: string, p: Pt) =>
  `<text x="${n1(p[0])}" y="${n1(p[1])}" text-anchor="middle" dominant-baseline="central" style="font-size:${LABEL_FS}px;font-weight:700;fill:var(--text)">${esc(label)}</text>`;

function angleSVG(p: Extract<GeoPart, { kind: 'angle' }>): string {
  const [e1, e2] = rayEnds(p);
  const rays = `<path d="M${xy(e1)}L${xy(p.at)}L${xy(e2)}" style="${LINE}"/>`;
  let mark = '';
  if (p.deg === 90) {
    const a = at(p.at, p.dir, SQUARE), c = at(p.at, p.dir + 90, SQUARE);
    mark = `<path class="rightmark" d="M${xy(a)}L${xy([a[0] + c[0] - p.at[0], a[1] + c[1] - p.at[1]])}L${xy(c)}" style="${MARK}"/>`;
  } else if (p.deg >= 360) {
    mark = `<circle cx="${n1(p.at[0])}" cy="${n1(p.at[1])}" r="${ARC}" style="${MARK}"/>`;
  } else if (p.deg > 0) {
    mark = `<path class="arc" d="M${xy(at(p.at, p.dir, ARC))}A${ARC} ${ARC} 0 ${p.deg > 180 ? 1 : 0} 0 ${xy(at(p.at, p.dir + p.deg, ARC))}" style="${MARK}"/>`;
  }
  return rays + mark + (p.label ? text(p.label, clamp(at(p.at, p.dir + p.deg / 2, RAY + 7))) : '');
}

function segmentSVG(p: Extract<GeoPart, { kind: 'segment' }>): string {
  const [dx, dy] = [p.b[0] - p.a[0], p.b[1] - p.a[1]], len = Math.hypot(dx, dy) || 1;
  const mid: Pt = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
  const [ux, uy] = [dx / len, dy / len];
  let nx = uy, ny = -ux;                       // a normal; the one pointing up the page (right when level)
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const ticks = Array.from({ length: p.ticks ?? 0 }, (_, i) => {
    const c: Pt = [mid[0] + ux * (i - ((p.ticks ?? 1) - 1) / 2) * 3, mid[1] + uy * (i - ((p.ticks ?? 1) - 1) / 2) * 3];
    return `<path d="M${xy([c[0] - nx * 2.5, c[1] - ny * 2.5])}L${xy([c[0] + nx * 2.5, c[1] + ny * 2.5])}" style="${MARK}"/>`;
  }).join('');
  const where = p.labelAt ?? clamp([mid[0] + nx * 7, mid[1] + ny * 7]);
  return `<path d="M${xy(p.a)}L${xy(p.b)}" style="${LINE}"/>${ticks}${p.label ? text(p.label, where) : ''}`;
}

/** The drawing for a `geometry` visual; a part with a non-finite number is skipped, as `chart` and `symmetry` do (#137). */
export function geometrySVG(v: Extract<Visual, { type: 'geometry' }>): string {
  const body = v.parts.map(p => {
    const ok = p.kind === 'angle' ? finite(...p.at, p.dir, p.deg) : finite(...p.a, ...p.b, ...(p.labelAt ?? [0, 0]));
    if (!ok) { console.warn('geometry visual: a part has a non-finite number — skipped'); return ''; }
    return p.kind === 'angle' ? angleSVG(p) : segmentSVG(p);
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 100 70" class="geo" style="width:clamp(200px,60vw,220px);height:auto">${body}</svg></div>`;
}
