import { describe, it, expect, vi } from 'vitest';
import { renderVisual } from '../../src/ui/visuals';
import { PIE } from '../../src/ui/vis-pie';
import type { Visual } from '../../src/curriculum';

type Pie = Extract<Visual, { type: 'pie' }>;
const pie = (ns: number[], labels = ['apples', 'pears', 'plums', 'grapes', 'mango']): Pie => ({ type: 'pie', slices: ns.map((n, i) => ({ label: labels[i], n })) });
/** A slice's drawn sweep in degrees, from its path's two arc endpoints about the centre. */
const bearing = (x: number, y: number) => ((Math.atan2(x - PIE.cx, PIE.cy - y) * 180 / Math.PI) + 360) % 360;
const sweeps = (html: string) => [...html.matchAll(/<path d="M[\d.]+ [\d.]+L([\d.]+) ([\d.]+)A[\d.]+ [\d.]+ 0 (\d) 1 ([\d.]+) ([\d.]+)Z"/g)]
  .map(m => ({ from: bearing(+m[1], +m[2]), to: bearing(+m[4], +m[5]), large: m[3] === '1' }))
  .map(s => ({ ...s, sweep: ((s.to - s.from) + 360) % 360 }));

describe('pie chart visual (#1239)', () => {
  it('draws every slice at n / total of 360 degrees, within half a degree, summing to the circle', () => {
    for (const ns of [[1, 1], [3, 1], [5, 3, 2], [5, 2, 2, 1], [7, 5, 3, 9, 4], [11, 1]]) {
      const total = ns.reduce((a, b) => a + b, 0), got = sweeps(renderVisual(pie(ns)));
      expect(got).toHaveLength(ns.length);
      got.forEach((s, i) => { expect(Math.abs(s.sweep - ns[i] / total * 360), `${ns} slice ${i}`).toBeLessThanOrEqual(0.5); expect(s.large).toBe(ns[i] / total > 0.5); });
      expect(Math.abs(got.reduce((a, s) => a + s.sweep, 0) - 360)).toBeLessThanOrEqual(0.5);
    }
  });

  it('starts at 12 o\'clock and goes clockwise', () => {
    const [first, second] = sweeps(renderVisual(pie([1, 3])));
    expect(first.from).toBeLessThanOrEqual(0.5); expect(second.from).toBeCloseTo(90, 0);
  });

  it('names every slice once, at the readable size, with no hex colour', () => {
    const html = renderVisual(pie([5, 3, 2]));
    const texts = [...html.matchAll(/<text [^>]*font-size="(\d+)"[^>]*>([^<]+)</g)];
    expect(texts.map(t => t[2])).toEqual(['apples', 'pears', 'plums']);
    texts.forEach(t => expect(Number(t[1])).toBeGreaterThanOrEqual(13));
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(html).toContain('clamp(260px,80vw,320px)');
  });

  it('keeps label boxes apart for every split a topic draws', () => {
    const w = (s: string) => s.length * 0.52 * PIE.fs;
    for (const ns of [[5, 3, 2], [5, 2, 2, 1], [4, 3, 2, 1], [1, 1, 1, 1, 1], [1, 11], [10, 1, 1], [3, 3, 2, 2]]) {
      const html = renderVisual(pie(ns, ['grapes', 'rabbits', 'yellow', 'purple', 'tennis']));
      const boxes = [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*>([^<]+)</g)].map(m => {
        const x = +m[1], width = w(m[4]), left = m[3] === 'start' ? x : m[3] === 'end' ? x - width : x - width / 2;
        return { left, right: left + width, top: +m[2] - PIE.fs, bottom: +m[2] + 3 };
      });
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b =>
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${ns} overlap`).toBe(true)));
      boxes.forEach(b => { expect(b.left).toBeGreaterThanOrEqual(-4); expect(b.right).toBeLessThanOrEqual(PIE.w + 4); });
    }
  });

  it('draws nothing, and says so, for data it cannot honestly draw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of [pie([5]), pie([0, 4]), pie([NaN, 4]), pie([-1, 4]), pie([1, 1, 1, 1, 1, 1], ['a', 'b', 'c', 'd', 'e', 'f'])]) expect(renderVisual(bad)).toBe('');
    expect(warn).toHaveBeenCalledTimes(5); warn.mockRestore();
  });
});
