import { describe, it, expect, vi } from 'vitest';
import { renderVisual } from '../../src/ui/visuals';
import { AXIS_FRAME as F, AXIS_FS, axisY, axisSVG, barSlot } from '../../src/ui/vis-axis-chart';
import { labelEm } from './helpers/r-lbl';
import { LABEL_READABLE_FS } from '../../src/game/bubbles';
import type { Visual } from '../../src/curriculum';

type Bar = Extract<Visual, { type: 'chart'; kind: 'bar' }>;
const bar = (ns: number[], labels = ['tennis', 'rugby', 'chess', 'dance', 'judo'], step = 10, max = 50): Bar =>
  ({ type: 'chart', kind: 'bar', step, max, rows: ns.map((n, i) => ({ label: labels[i], n })) });
const attr = (tag: string, name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)![1]);

describe('bar chart visual (#1076)', () => {
  it('every bar top sits exactly where the axis puts its value, and its height reaches the baseline', () => {
    const ns = [10, 25, 50, 0, 35];
    const html = renderVisual(bar(ns));
    const rects = html.match(/<rect [^>]+>/g)!;
    expect(rects).toHaveLength(ns.length);
    rects.forEach((r, i) => {
      expect(attr(r, 'y'), `bar ${i}`).toBe(axisY(F, 50, ns[i]));
      expect(attr(r, 'y') + attr(r, 'height'), `bar ${i} base`).toBeCloseTo(axisY(F, 50, 0), 5);
    });
  });

  it('has a gridline and a number at 0, step, … max', () => {
    const svg = axisSVG(F, 50, 10);
    expect(svg.match(/<line /g)).toHaveLength(6);
    expect([...svg.matchAll(/>(\d+)<\/text>/g)].map(m => Number(m[1]))).toEqual([0, 10, 20, 30, 40, 50]);
    for (const v of [0, 10, 20, 30, 40, 50]) expect(svg).toContain(`y1="${axisY(F, 50, v)}"`);
  });

  it('keeps an odd count on step 2 off the gridlines', () => {
    const y = axisY(F, 20, 7);
    expect(y).toBeGreaterThan(axisY(F, 20, 8));
    expect(y).toBeLessThan(axisY(F, 20, 6));
  });

  it('draws every number and label at the readable floor, and each label fits its slot at 240px', () => {
    expect(AXIS_FS).toBeGreaterThanOrEqual(LABEL_READABLE_FS);
    const labels = ['tennis', 'grapes', 'cherry', 'dance', 'mango'];
    const html = renderVisual(bar([10, 20, 30, 40, 50], labels));
    for (const m of html.matchAll(/<text [^>]*font-size="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(LABEL_READABLE_FS);
    expect(html).toContain(`viewBox="0 0 ${F.w} ${F.h}"`);
    for (const l of labels) expect(labelEm(l) * AXIS_FS, l).toBeLessThanOrEqual(barSlot(F, 5));
  });

  it('leaves tally, block and pictogram output unchanged', () => {
    const rows = [{ label: 'a', n: 4 }, { label: 'b', n: 2 }];
    const pic = renderVisual({ type: 'chart', kind: 'pictogram', rows, each: 2, icon: '⭐' });
    expect(pic).toBe('<div class="vis"><div class="chart pictogram"><div class="chart-row"><span class="cat">a</span><span class="data"><span class="pic">⭐</span><span class="pic">⭐</span></span></div><div class="chart-row"><span class="cat">b</span><span class="data"><span class="pic">⭐</span></span></div><div class="key">1 ⭐ = 2</div></div></div>');
    expect(renderVisual({ type: 'chart', kind: 'block', rows })).toContain('class="chart block"');
    expect(renderVisual({ type: 'chart', kind: 'tally', rows })).toContain('class="chart tally"');
  });

  it('uses design tokens only — no hex colour', () => {
    expect(renderVisual(bar([10, 20, 30]))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('escapes a label, and draws an invalid value as an empty bar with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderVisual(bar([-5, NaN, 80, 10], ['<b>', 'b', 'c', 'd']));
    expect(html).toContain('&lt;b&gt;');
    const rects = html.match(/<rect [^>]+>/g)!;
    expect(rects.slice(0, 3).map(r => attr(r, 'height'))).toEqual([0, 0, 0]);
    expect(attr(rects[3], 'height')).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('draws nothing, with a warning, for an axis that is not whole steps of at most ten', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(renderVisual(bar([10], ['a'], 10, 55))).toBe('');
    expect(renderVisual(bar([10], ['a'], 2, 40))).toBe('');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('bar chart labels too wide for their slot (#1076)', () => {
  it('stagger onto a second row, so neighbours never overlap and the viewBox grows to hold it', () => {
    const labels = ['cricket', 'running', 'bananas', 'scooter', 'cherry'];
    const html = renderVisual(bar([10, 20, 30, 40, 50], labels));
    const ys = [...html.matchAll(/<text [^>]*text-anchor="middle"[^>]*y="([\d.]+)"|<text x="[\d.]+" y="([\d.]+)" text-anchor="middle"/g)].map(m => Number(m[1] ?? m[2]));
    expect(ys).toHaveLength(5);
    expect(ys[1]).toBeGreaterThan(ys[0]);
    expect(ys[2]).toBe(ys[0]);
    expect(ys[3]).toBe(ys[1]);
    expect(Number(/viewBox="0 0 \d+ (\d+)"/.exec(html)![1])).toBeGreaterThan(F.h);
    expect(Math.max(...ys)).toBeLessThan(Number(/viewBox="0 0 \d+ (\d+)"/.exec(html)![1]));
    for (const l of labels) expect(labelEm(l) * AXIS_FS, l).toBeLessThanOrEqual(2 * barSlot(F, 5));
  });

  it('keep one row when every label fits', () => {
    const html = renderVisual(bar([10, 20, 30, 40, 50], ['tennis', 'rugby', 'chess', 'dance', 'judo']));
    expect(html).toContain(`viewBox="0 0 ${F.w} ${F.h}"`);
  });
});
