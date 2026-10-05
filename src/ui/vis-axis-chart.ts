// The scaled bar chart (#1076) and the value axis a line graph will share (#1156). Placeholder look (owner,
// 2026-09-28; final art is #1307): every pixel is drawn here, from tokens, so the look swaps in one module.
import type { Visual } from '../curriculum/types';
import { esc } from './dom';

type BarChart = Extract<Visual, { type: 'chart'; kind: 'bar' }>;

/** The SVG's own coordinates, drawn 1 unit = 1px at 240px wide: 150px tall keeps it inside Ninja Duel's 160px visual budget (and its 100px one under the sideways zoom of 0.62). */
export interface AxisFrame { w: number; h: number; left: number; right: number; top: number; bottom: number }
export const AXIS_FRAME: AxisFrame = { w: 240, h: 150, left: 28, right: 6, top: 10, bottom: 26 };
/** Axis numbers and category labels: the bubbles' readable floor (`LABEL_READABLE_FS`, 13px). */
export const AXIS_FS = 13;

const r2 = (x: number) => Number(x.toFixed(2));
/** The y of `value` on the axis — the one mapping the gridlines and the bar tops both use. */
export const axisY = (f: AxisFrame, max: number, value: number) => r2(f.top + (f.h - f.top - f.bottom) * (1 - value / max));
/** The width each category's bar slot gets. */
export const barSlot = (f: AxisFrame, bars: number) => r2((f.w - f.left - f.right) / bars);

/** A conservative width for a label at `AXIS_FS` (Fredoka 700 averages under 0.52em a letter): a longer one than its slot staggers onto a second row. */
const labelWidth = (s: string) => s.length * 0.52 * AXIS_FS;
const STAGGER = AXIS_FS + 4;

/** Gridline, number and baseline for 0, step, …, max. */
export function axisSVG(f: AxisFrame, max: number, step: number): string {
  let out = '';
  for (let v = 0; v <= max; v += step) {
    const y = axisY(f, max, v);
    out += `<line x1="${f.left}" x2="${f.w - f.right}" y1="${y}" y2="${y}" stroke="${v === 0 ? 'var(--text)' : 'var(--line)'}" stroke-width="1"/>`
      + `<text x="${f.left - 4}" y="${r2(y + AXIS_FS * 0.35)}" text-anchor="end" font-size="${AXIS_FS}" font-weight="700" fill="var(--text)">${v}</text>`;
  }
  return out;
}

/** Vertical bars on a left axis, the category under each. A bar the data cannot honestly draw is empty. */
export function barChartSVG(v: BarChart): string {
  const f = AXIS_FRAME;
  const { step, max } = v;
  if (!(Number.isInteger(step) && step > 0 && Number.isInteger(max) && max > 0 && max % step === 0 && max / step <= 10)) {
    console.warn(`bar chart: axis step ${step}, max ${max} is not a whole number of at most 10 steps — drew nothing`);
    return '';
  }
  const slot = barSlot(f, v.rows.length), drop = v.rows.some(r => labelWidth(r.label) > slot) ? STAGGER : 0, bw = r2(slot * 0.6), base = axisY(f, max, 0);
  const bars = v.rows.map((r, i) => {
    const ok = Number.isFinite(r.n) && r.n >= 0 && r.n <= max;
    if (!ok) console.warn(`bar chart: row "${r.label}" had an invalid value (${r.n}) — drew an empty bar`);
    const top = ok ? axisY(f, max, r.n) : base, cx = r2(f.left + slot * (i + 0.5));
    return `<rect x="${r2(cx - bw / 2)}" y="${top}" width="${bw}" height="${r2(base - top)}" rx="2" fill="var(--accent-2)"/>`
      + `<text x="${cx}" y="${r2(base + AXIS_FS + 4 + (i % 2 ? drop : 0))}" text-anchor="middle" font-size="${AXIS_FS}" font-weight="700" fill="var(--text)">${esc(r.label)}</text>`;
  }).join('');
  return `<div class="vis"><svg viewBox="0 0 ${f.w} ${f.h + drop}" role="img" aria-label="Bar chart" style="width:240px;max-width:100%;height:auto;display:block;overflow:visible">${axisSVG(f, max, step)}${bars}</svg></div>`;
}
