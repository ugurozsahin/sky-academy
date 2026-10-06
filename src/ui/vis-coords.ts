// The `coords` visual (#1129): a first-quadrant grid with numbered axes and lettered points, in one swappable module
// (the final look is #1306). A placeholder is plain, not approximate — every dot sits exactly at its (x, y).
import type { Visual } from '../curriculum';
import { esc } from './dom';

type Coords = Extract<Visual, { type: 'coords' }>;
/** The viewBox is `VB` units square; the grid is `SPAN` units wide with its origin `PAD_L` in from the left and `PAD_B` up from the bottom. */
export const VB = 128, SPAN = 100, PAD_L = 14, PAD_T = 12, PAD_B = VB - PAD_T - SPAN, LABEL_FS = 7.5;
/** The drawn width range in CSS px: the smallest the labels are measured at in the unit test. */
export const MIN_W = 240;
const n2 = (n: number) => String(Math.round(n * 100) / 100);
const ok = (n: number) => Number.isFinite(n);

/** Where grid position (x, y) is drawn, in viewBox units (y runs down the page). */
export function coordsPos(size: number, x: number, y: number): [number, number] {
  const cell = SPAN / size;
  return [PAD_L + x * cell, PAD_T + SPAN - y * cell];
}

const text = (s: string, x: number, y: number, anchor: string, style: string, cls: string) =>
  `<text class="${cls}" x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" dominant-baseline="central" style="font-size:${LABEL_FS}px;${style}">${esc(s)}</text>`;

/** The drawing for a `coords` visual; a point outside the grid, or with a non-finite value, is skipped with a warning (#137). */
export function coordsSVG(v: Coords): string {
  const size = Math.round(v.size);
  if (!(size >= 1 && size <= 10)) { console.warn('coords visual: size must be 1–10 — drawn empty'); return '<div class="vis"></div>'; }
  const grid: string[] = [], nums: string[] = [];
  for (let i = 0; i <= size; i++) {
    const [gx, gy] = coordsPos(size, i, i);
    const axis = i === 0;
    const style = `stroke:${axis ? 'var(--text)' : 'var(--line)'};stroke-width:${axis ? 1.4 : 0.8}`;
    grid.push(`<line class="gx" x1="${n2(gx)}" y1="${PAD_T}" x2="${n2(gx)}" y2="${PAD_T + SPAN}" style="${style}"/>`);
    grid.push(`<line class="gy" x1="${PAD_L}" y1="${n2(gy)}" x2="${PAD_L + SPAN}" y2="${n2(gy)}" style="${style}"/>`);
    nums.push(text(String(i), gx, PAD_T + SPAN + 8, 'middle', 'fill:var(--text)', 'ax'));
    nums.push(text(String(i), PAD_L - 5, gy, 'end', 'fill:var(--text)', 'ay'));
  }
  const good = v.points.filter(p => {
    const inside = ok(p.x) && ok(p.y) && p.x >= 0 && p.y >= 0 && p.x <= size && p.y <= size;
    if (!inside) console.warn(`coords visual: point ${p.label} is off the grid — skipped`);
    return inside;
  });
  const at = new Map(good.map(p => [p.label, coordsPos(size, p.x, p.y)]));
  const line = (v.join ?? []).map(l => at.get(l)).filter((p): p is [number, number] => !!p);
  const sides = line.length > 1 ? `<polyline class="join" points="${line.map(p => `${n2(p[0])},${n2(p[1])}`).join(' ')}" style="fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round"/>` : '';
  const dots = good.map(p => {
    const [cx, cy] = coordsPos(size, p.x, p.y);
    return `<circle class="pt" data-x="${p.x}" data-y="${p.y}" cx="${n2(cx)}" cy="${n2(cy)}" r="2.6" style="fill:var(--accent);stroke:var(--text);stroke-width:0.6"/>`
      + text(p.label, cx + 4, cy - 4.5, 'start', 'font-weight:700;fill:var(--text)', 'pl');
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 ${VB} ${VB}" class="coords" style="width:clamp(${MIN_W}px,70vw,300px);height:auto">${grid.join('')}${nums.join('')}${sides}${dots}</svg></div>`;
}
