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
  const r = p.len ?? RAY;
  return [at(p.at, p.dir, r), at(p.at, p.dir + p.deg, r)];
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
  return rays + mark + (p.label ? text(p.label, clamp(at(p.at, p.dir + p.deg / 2, (p.len ?? RAY) + 7))) : '');
}

/** `n` short strokes across the segment a–b, centred on its middle, along the normal (nx, ny). */
function tickMarks(a: Pt, b: Pt, n: number, nx: number, ny: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return Array.from({ length: n }, (_, i) => {
    const c: Pt = [mid[0] + ux * (i - (n - 1) / 2) * 3, mid[1] + uy * (i - (n - 1) / 2) * 3];
    return `<path d="M${xy([c[0] - nx * 2.5, c[1] - ny * 2.5])}L${xy([c[0] + nx * 2.5, c[1] + ny * 2.5])}" style="${MARK}"/>`;
  }).join('');
}

function segmentSVG(p: Extract<GeoPart, { kind: 'segment' }>): string {
  const [dx, dy] = [p.b[0] - p.a[0], p.b[1] - p.a[1]], len = Math.hypot(dx, dy) || 1;
  const mid: Pt = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
  const [ux, uy] = [dx / len, dy / len];
  let nx = uy, ny = -ux;                       // a normal; the one pointing up the page (right when level)
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const ticks = tickMarks(p.a, p.b, p.ticks ?? 0, nx, ny);
  const where = p.labelAt ?? clamp([mid[0] + nx * 7, mid[1] + ny * 7]);
  return `<path d="M${xy(p.a)}L${xy(p.b)}" style="${LINE}"/>${ticks}${p.label ? text(p.label, where) : ''}`;
}

/** A polygon (#1154): its outline, equal-side ticks, right-angle squares at the listed vertices, side labels and the letter under it. */
function polygonSVG(p: Extract<GeoPart, { kind: 'polygon' }>): string {
  const n = p.pts.length, cx = p.pts.reduce((t, q) => t + q[0], 0) / n, cy = p.pts.reduce((t, q) => t + q[1], 0) / n;
  let out = `<path class="poly" d="M${p.pts.map(xy).join('L')}Z" style="${LINE}"/>`;
  p.pts.forEach((a, i) => {
    const b = p.pts[(i + 1) % n], mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let [nx, ny] = [b[1] - a[1], a[0] - b[0]];
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    if (nx * (mid[0] - cx) + ny * (mid[1] - cy) < 0) { nx = -nx; ny = -ny; }   // the normal that points away from the middle
    out += tickMarks(a, b, p.ticks?.[i] ?? 0, nx, ny);
    if (p.sides?.[i]) out += text(p.sides[i], clamp([mid[0] + nx * 7, mid[1] + ny * 7]));
  });
  for (const i of p.right ?? []) {
    const v = p.pts[i], a = p.pts[(i + n - 1) % n], b = p.pts[(i + 1) % n];
    const [la, lb] = [Math.hypot(a[0] - v[0], a[1] - v[1]) || 1, Math.hypot(b[0] - v[0], b[1] - v[1]) || 1], m = Math.min(SQUARE, 0.3 * Math.min(la, lb));
    const [u, w]: [Pt, Pt] = [[v[0] + (a[0] - v[0]) / la * m, v[1] + (a[1] - v[1]) / la * m], [v[0] + (b[0] - v[0]) / lb * m, v[1] + (b[1] - v[1]) / lb * m]];
    out += `<path class="rightmark" d="M${xy(u)}L${xy([u[0] + w[0] - v[0], u[1] + w[1] - v[1]])}L${xy(w)}" style="${MARK}"/>`;
  }
  const low = Math.max(...p.pts.map(q => q[1]));
  return out + (p.label ? text(p.label, clamp([cx, low + 7])) : '');
}

/** A circle (#1248): the outline, a centre dot, and its letter just outside the outline at the upper right. */
function circleSVG(p: Extract<GeoPart, { kind: 'circle' }>): string {
  const tag = (p.label ? text(p.label, clamp(at(p.at, 45, p.r + 6))) : '');
  return `<circle class="circ" cx="${n1(p.at[0])}" cy="${n1(p.at[1])}" r="${n1(p.r)}" style="${LINE}"/><circle class="ctr" cx="${n1(p.at[0])}" cy="${n1(p.at[1])}" r="1.3" style="fill:var(--text)"/>${tag}`;
}

/** A circle's numbers are finite and the whole outline sits inside the 100 × 70 box. */
const circleOk = (p: Extract<GeoPart, { kind: 'circle' }>): boolean =>
  finite(...p.at, p.r) && p.r > 0 && p.at[0] - p.r >= 0 && p.at[0] + p.r <= 100 && p.at[1] - p.r >= 0 && p.at[1] + p.r <= 70;
const polygonOk = (p: Extract<GeoPart, { kind: 'polygon' }>): boolean =>
  p.pts.length >= 3 && p.pts.length <= 6 && finite(...p.pts.flat()) && (p.right ?? []).every(i => Number.isInteger(i) && i >= 0 && i < p.pts.length);
const partOk = (p: GeoPart): boolean => p.kind === 'angle' ? finite(...p.at, p.dir, p.deg, p.len ?? 1)
  : p.kind === 'circle' ? circleOk(p) : p.kind === 'polygon' ? polygonOk(p) : finite(...p.a, ...p.b, ...(p.labelAt ?? [0, 0]));
const partSVG = (p: GeoPart): string => p.kind === 'angle' ? angleSVG(p) : p.kind === 'polygon' ? polygonSVG(p) : p.kind === 'circle' ? circleSVG(p) : segmentSVG(p);

/** The drawing for a `geometry` visual; a part with a non-finite number is skipped, as `chart` and `symmetry` do (#137). */
export function geometrySVG(v: Extract<Visual, { type: 'geometry' }>): string {
  const body = v.parts.map(p => {
    if (!partOk(p)) { console.warn('geometry visual: a part has a bad number, index or size — skipped'); return ''; }
    return partSVG(p);
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 100 70" class="geo" style="width:clamp(200px,60vw,220px);height:auto">${body}</svg></div>`;
}
