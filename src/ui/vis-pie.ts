// The pie chart (#1239): unequal slices drawn to their exact angles, every slice named by its own label so the chart never
// relies on colour alone (WCAG 1.4.1). Placeholder look (owner, 2026-09-28; final art is #1308): every pixel is drawn here,
// from tokens, so the look swaps in one module.
import type { Visual } from '../curriculum/types';
import { esc } from './dom';

type Pie = Extract<Visual, { type: 'pie' }>;

/** The SVG's own coordinates, 1 unit = 1px at the narrowest width the chart is drawn (260px), so a 13px label is 13px there. */
export const PIE = { w: 260, h: 200, cx: 130, cy: 100, r: 54, fs: 13 } as const;
const FILLS = ['var(--accent)', 'var(--accent-2)', 'var(--good)', 'var(--muted)', 'var(--panel-2)'];
const r2 = (x: number) => Number(x.toFixed(2));
/** The point at `deg` degrees clockwise from 12 o'clock, `radius` from the centre. */
export const piePoint = (deg: number, radius: number): [number, number] => {
  const a = deg * Math.PI / 180;
  return [r2(PIE.cx + radius * Math.sin(a)), r2(PIE.cy - radius * Math.cos(a))];
};

/** Slices from 12 o'clock, clockwise. A chart the data cannot honestly draw draws nothing. */
export function pieSVG(v: Pie): string {
  const { slices } = v, total = slices.reduce((a, s) => a + s.n, 0);
  if (!(slices.length >= 2 && slices.length <= 5 && slices.every(s => Number.isFinite(s.n) && s.n > 0) && total > 0)) {
    console.warn(`pie chart: ${slices.length} slices with counts ${slices.map(s => s.n).join(', ')} is not drawable (2-5 slices, each above 0) — drew nothing`);
    return '';
  }
  let from = 0;
  const parts = slices.map((s, i) => {
    const sweep = s.n / total * 360, to = from + sweep, mid = from + sweep / 2;
    const [x1, y1] = piePoint(from, PIE.r), [x2, y2] = piePoint(to, PIE.r);
    const [lx1, ly1] = piePoint(mid, PIE.r), [lx2, ly2] = piePoint(mid, PIE.r + 8), [tx, ty] = piePoint(mid, PIE.r + 12);
    const side = Math.sin(mid * Math.PI / 180), anchor = Math.abs(side) < 0.2 ? 'middle' : side > 0 ? 'start' : 'end';
    // A label above the circle sits on its baseline; one below it hangs from its cap height.
    const dy = Math.cos(mid * Math.PI / 180) > 0.2 ? 0 : Math.cos(mid * Math.PI / 180) < -0.2 ? PIE.fs * 0.8 : PIE.fs * 0.35;
    from = to;
    return `<path d="M${PIE.cx} ${PIE.cy}L${x1} ${y1}A${PIE.r} ${PIE.r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}Z" fill="${FILLS[i]}" stroke="var(--text)" stroke-width="1.5" stroke-linejoin="round"/>`
      + `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="var(--text)" stroke-width="1.5"/>`
      + `<text x="${tx}" y="${r2(ty + dy)}" text-anchor="${anchor}" font-size="${PIE.fs}" font-weight="700" fill="var(--text)">${esc(s.label)}</text>`;
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 ${PIE.w} ${PIE.h}" role="img" aria-label="Pie chart" style="width:min(clamp(260px,80vw,320px),calc(var(--duel-vis,300px) * 1.3));max-width:100%;height:auto;display:block;overflow:visible">${parts}</svg></div>`;
}
