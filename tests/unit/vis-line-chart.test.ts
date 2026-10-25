import { describe, it, expect, vi } from 'vitest';
import { renderVisual } from '../../src/ui/visuals';
import { AXIS_FRAME as F, axisY, pointX } from '../../src/ui/vis-axis-chart';
import type { Visual } from '../../src/curriculum';

type Line = Extract<Visual, { type: 'chart'; kind: 'line' }>;
const line = (ns: number[], labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'], step = 2, max = 20): Line =>
  ({ type: 'chart', kind: 'line', step, max, rows: ns.map((n, i) => ({ label: labels[i], n })) });
const attr = (tag: string, name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)![1]);

describe('line graph visual (#1156)', () => {
  it('every point sits at the axis-mapped value and above its label tick', () => {
    const ns = [4, 7, 12, 20, 9, 2];
    const html = renderVisual(line(ns));
    const circles = html.match(/<circle [^>]+>/g)!;
    expect(circles).toHaveLength(ns.length);
    circles.forEach((c, i) => {
      expect(Math.abs(attr(c, 'cy') - axisY(F, 20, ns[i])), `point ${i} y`).toBeLessThanOrEqual(0.5);
      expect(attr(c, 'cx'), `point ${i} x`).toBe(pointX(F, ns.length, i));
    });
    const texts = [...html.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="middle"[^>]*>([^<]+)</g)];
    expect(texts.map(t => t[2])).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']);
    texts.forEach((t, i) => expect(Number(t[1])).toBe(pointX(F, ns.length, i)));
  });

  it('joins the points with one polyline, in order, and marks each with a shape', () => {
    const html = renderVisual(line([4, 8, 6, 10]));
    const pts = /<polyline points="([^"]+)"/.exec(html)![1].split(' ').map(p => p.split(',').map(Number));
    expect(pts).toHaveLength(4);
    expect(pts.map(p => p[0])).toEqual([0, 1, 2, 3].map(i => pointX(F, 4, i)));
    expect(html.match(/<circle /g)).toHaveLength(4);
  });

  it('puts a halfway value between two gridlines', () => {
    const y = axisY(F, 20, 7);
    expect(y).toBeGreaterThan(axisY(F, 20, 8));
    expect(y).toBeLessThan(axisY(F, 20, 6));
  });

  it('draws nothing, with a warning, for an axis or point count it cannot draw honestly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(renderVisual(line([4, 8], undefined, 3, 20))).not.toContain('<circle');
    expect(renderVisual(line([4]))).not.toContain('<circle');
    expect(renderVisual(line([1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c', 'd', 'e', 'f', 'g']))).not.toContain('<circle');
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('leaves the bar chart output unchanged', () => {
    const html = renderVisual({ type: 'chart', kind: 'bar', step: 10, max: 50, rows: [{ label: 'a', n: 10 }, { label: 'b', n: 50 }] });
    expect(html).toContain('aria-label="Bar chart"');
    expect(html.match(/<rect /g)).toHaveLength(2);
  });

  it('names the axes when asked, inside the plot and at the readable floor (#2278)', () => {
    const html = renderVisual({ ...line([2, 6, 10]), xTitle: 'km', yTitle: 'miles' });
    const titles = [...html.matchAll(/<text class="axis-title" x="([\d.]+)" y="([\d.]+)"[^>]*font-size="(\d+)"[^>]*>([^<]+)</g)];
    expect(titles.map(t => t[4])).toEqual(['miles', 'km']);
    titles.forEach(t => { expect(Number(t[3])).toBeGreaterThanOrEqual(13); expect(Number(t[1])).toBeLessThanOrEqual(F.w); expect(Number(t[2])).toBeLessThan(F.h - F.bottom); });
    expect(renderVisual(line([2, 6, 10]))).not.toContain('axis-title');
  });
});
