// The `coords` visual (#1129): a grid with numbered axes and lettered points, in one swappable module
// (the final look is #1306). A placeholder is plain, not approximate — every dot sits exactly at its (x, y).
// The grid runs `min`…`size` on both axes (`min` defaults to 0, the first quadrant; #1213 gives it a negative value).
import type { Visual } from '../curriculum';
import { esc } from './dom';

type Coords = Extract<Visual, { type: 'coords' }>;
/** The viewBox is `VB` units square; the grid is `SPAN` units wide, `PAD_L` in from the left and `PAD_T` down from the top.
 *  The drawn width is the clamp, but never above the duel's visual budget `--duel-vis` (#388), so the square grid is not cut off there. */
export const VB = 128, SPAN = 100, PAD_L = 14, PAD_T = 12, LABEL_FS = 7.5;
/** The drawn width range in CSS px: the smallest the labels are measured at in the unit test. */
export const MIN_W = 240;
const n2 = (n: number) => String(Math.round(n * 100) / 100);
const ok = (n: number) => Number.isFinite(n);

/** Where grid position (x, y) is drawn, in viewBox units (y runs down the page). */
export function coordsPos(size: number, x: number, y: number, min = 0): [number, number] {
  const cell = SPAN / (size - min);
  return [PAD_L + (x - min) * cell, PAD_T + SPAN - (y - min) * cell];
}
/** An axis number: the real minus sign U+2212 for a negative, never an ASCII hyphen (#1047). */
const axisNum = (i: number) => (i < 0 ? '−' : '') + Math.abs(i);

const text = (s: string, x: number, y: number, anchor: string, style: string, cls: string) =>
  `<text class="${cls}" x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" dominant-baseline="central" style="font-size:${LABEL_FS}px;${style}">${esc(s)}</text>`;

/** The drawing for a `coords` visual; a point outside the grid, or with a non-finite value, is skipped with a warning (#137). */
export function coordsSVG(v: Coords): string {
  const size = Math.round(v.size), min = Math.round(v.min ?? 0);
  if (!(size >= 1 && size <= 10)) { console.warn('coords visual: size must be 1–10 — drawn empty'); return '<div class="vis"></div>'; }
  if (!(min >= -10 && min <= 0)) { console.warn('coords visual: min must be −10–0 — drawn empty'); return '<div class="vis"></div>'; }
  const grid: string[] = [], nums: string[] = [];
  for (let i = min; i <= size; i++) {
    const [gx, gy] = coordsPos(size, i, i, min);
    const axis = i === 0;   // the axes run through the origin
    const style = `stroke:${axis ? 'var(--text)' : 'var(--line)'};stroke-width:${axis ? 1.4 : 0.8}`;
    grid.push(`<line class="gx" x1="${n2(gx)}" y1="${PAD_T}" x2="${n2(gx)}" y2="${PAD_T + SPAN}" style="${style}"/>`);
    grid.push(`<line class="gy" x1="${PAD_L}" y1="${n2(gy)}" x2="${PAD_L + SPAN}" y2="${n2(gy)}" style="${style}"/>`);
    nums.push(text(axisNum(i), gx, PAD_T + SPAN + 8, 'middle', 'fill:var(--text)', 'ax'));
    nums.push(text(axisNum(i), PAD_L - 5, gy, 'end', 'fill:var(--text)', 'ay'));
  }
  const good = v.points.filter(p => {
    const inside = ok(p.x) && ok(p.y) && p.x >= min && p.y >= min && p.x <= size && p.y <= size;
    if (!inside) console.warn(`coords visual: point ${p.label} is off the grid — skipped`);
    return inside;
  });
  const at = new Map(good.map(p => [p.label, coordsPos(size, p.x, p.y, min)]));
  const line = (v.join ?? []).map(l => at.get(l)).filter((p): p is [number, number] => !!p);
  const sides = line.length > 1 ? `<polyline class="join" points="${line.map(p => `${n2(p[0])},${n2(p[1])}`).join(' ')}" style="fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round"/>` : '';
  const dots = good.map(p => {
    const [cx, cy] = coordsPos(size, p.x, p.y, min);
    return `<circle class="pt" data-x="${p.x}" data-y="${p.y}" cx="${n2(cx)}" cy="${n2(cy)}" r="2.6" style="fill:var(--accent);stroke:var(--text);stroke-width:0.6"/>`
      + text(p.label, cx + 4, cy - 4.5, 'start', 'font-weight:700;fill:var(--text)', 'pl');
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 ${VB} ${VB}" class="coords" style="width:min(clamp(${MIN_W}px,70vw,300px),var(--duel-vis,300px));height:auto">${grid.join('')}${nums.join('')}${sides}${dots}</svg></div>`;
}
