// The scaled bar chart (#1076), the line graph (#1156) and the value axis they share. Placeholder look (owner,
// 2026-09-28; final art is #1307): every pixel is drawn here, from tokens, so the look swaps in one module.
import type { Visual } from '../curriculum/types';
import { esc } from './dom';

type BarChart = Extract<Visual, { type: 'chart'; kind: 'bar' }>;
type LineChart = Extract<Visual, { type: 'chart'; kind: 'line' }>;

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

/** The x of point `i` of `count` — the centre of its slot, so a label sits under its marker exactly. */
export const pointX = (f: AxisFrame, count: number, i: number) => r2(f.left + barSlot(f, count) * (i + 0.5));

/** What each axis counts (#2278, "unlabelled axes"). Both sit inside the plot, in the corners a rising line leaves empty, so the graph keeps its height. */
export function axisTitles(f: AxisFrame, base: number, xTitle?: string, yTitle?: string): string {
  const t = (x: number, y: number, anchor: string, s: string) => `<text class="axis-title" x="${x}" y="${y}" text-anchor="${anchor}" font-size="${AXIS_FS}" font-weight="700" fill="var(--text)">${esc(s)}</text>`;
  return (yTitle ? t(f.left + 6, f.top + AXIS_FS, 'start', yTitle) : '') + (xTitle ? t(f.w - f.right - 2, r2(base - 6), 'end', xTitle) : '');
}

/** Points joined by straight segments on the same axis (Y4 time graphs, #1156); each point has a visible marker, a circle with a ring, so it never reads by colour alone. */
export function lineChartSVG(v: LineChart): string {
  const f = AXIS_FRAME;
  const { step, max, rows, xTitle, yTitle } = v;
  if (!(Number.isInteger(step) && step > 0 && Number.isInteger(max) && max > 0 && max % step === 0 && max / step <= 10 && rows.length >= 2 && rows.length <= 6)) {
    console.warn(`line chart: axis step ${step}, max ${max}, ${rows.length} points is not drawable (whole steps up to 10, 2-6 points) — drew nothing`);
    return '';
  }
  const slot = barSlot(f, rows.length), drop = rows.some(r => labelWidth(r.label) > slot) ? STAGGER : 0, base = axisY(f, max, 0);
  const pts = rows.map((r, i) => {
    const ok = Number.isFinite(r.n) && r.n >= 0 && r.n <= max;
    if (!ok) console.warn(`line chart: point "${r.label}" had an invalid value (${r.n}) — drew it on the baseline`);
    return { x: pointX(f, rows.length, i), y: ok ? axisY(f, max, r.n) : base, label: r.label };
  });
  const path = `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--accent-2)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const marks = pts.map((p, i) =>
    `<circle class="pt" cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--ink)" stroke="var(--accent-2)" stroke-width="2.5"/>`
    + `<text x="${p.x}" y="${r2(base + AXIS_FS + 4 + (i % 2 ? drop : 0))}" text-anchor="middle" font-size="${AXIS_FS}" font-weight="700" fill="var(--text)">${esc(p.label)}</text>`).join('');
  return `<div class="vis"><svg viewBox="0 0 ${f.w} ${f.h + drop}" role="img" aria-label="Line graph" style="width:240px;max-width:100%;height:auto;display:block;overflow:visible">${axisSVG(f, max, step)}${path}${marks}${axisTitles(f, base, xTitle, yTitle)}</svg></div>`;
}
