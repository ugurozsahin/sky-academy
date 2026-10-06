import { describe, it, expect, vi } from 'vitest';
import { coordsSVG, coordsPos, LABEL_FS, VB, MIN_W } from '../../src/ui/vis-coords';
import { renderVisual } from '../../src/ui/visuals';
import { repeatKey } from '../../src/game/session';
import type { Visual } from '../../src/curriculum';

type Coords = Extract<Visual, { type: 'coords' }>;
const grid = (size: number, points: Coords['points'], join?: string[]): Coords => ({ type: 'coords', size, points, ...(join ? { join } : {}) });

describe('coords visual (#1129)', () => {
  it('every dot is centred exactly on the grid mapping of its (x, y), for every size and every position', () => {
    for (let size = 1; size <= 10; size++) {
      const points = [];
      for (let x = 0; x <= size; x++) for (let y = 0; y <= size; y++) points.push({ x, y, label: 'A' });
      const dots = [...coordsSVG(grid(size, points)).matchAll(/<circle class="pt" data-x="(\d+)" data-y="(\d+)" cx="([\d.-]+)" cy="([\d.-]+)"/g)];
      expect(dots.length, `size ${size}`).toBe(points.length);
      for (const [, x, y, cx, cy] of dots) {
        const [ex, ey] = coordsPos(size, +x, +y);
        expect(Math.abs(+cx - ex), `size ${size} (${x}, ${y}) cx`).toBeLessThan(0.006);
        expect(Math.abs(+cy - ey), `size ${size} (${x}, ${y}) cy`).toBeLessThan(0.006);
      }
    }
  });

  it('pins literal positions, not only the formula', () => {
    expect(coordsPos(10, 0, 0)).toEqual([14, 112]);
    expect(coordsPos(10, 10, 10)).toEqual([114, 12]);
    expect(coordsPos(5, 2, 3)).toEqual([54, 52]);
  });

  it('x grows to the right and y grows up the page', () => {
    expect(coordsPos(10, 5, 0)[0]).toBeGreaterThan(coordsPos(10, 4, 0)[0]);
    expect(coordsPos(10, 0, 5)[1]).toBeLessThan(coordsPos(10, 0, 4)[1]);
  });

  it('the axes are numbered 0…size and there are size + 1 gridlines each way', () => {
    for (const size of [1, 5, 8, 10]) {
      const html = coordsSVG(grid(size, []));
      const nums = (cls: string) => [...html.matchAll(new RegExp(`<text class="${cls}"[^>]*>(\\d+)</text>`, 'g'))].map(m => +m[1]);
      const want = Array.from({ length: size + 1 }, (_, i) => i);
      expect(nums('ax'), `size ${size} x axis`).toEqual(want);
      expect(nums('ay'), `size ${size} y axis`).toEqual(want);
      expect((html.match(/class="gx"/g) ?? []).length).toBe(size + 1);
      expect((html.match(/class="gy"/g) ?? []).length).toBe(size + 1);
    }
  });

  it('labels render at 13px or more at the 240px minimum width, and the width is the clamp', () => {
    expect(LABEL_FS * MIN_W / VB).toBeGreaterThanOrEqual(13);
    expect(coordsSVG(grid(10, []))).toContain(`width:min(clamp(${MIN_W}px,70vw,300px),var(--duel-vis,300px))`);
    expect(coordsSVG(grid(10, [{ x: 1, y: 1, label: 'A' }]))).toContain(`font-size:${LABEL_FS}px`);
  });

  it('draws only tokens: no hex colour in the output', () => {
    expect(coordsSVG(grid(10, [{ x: 1, y: 2, label: 'A' }, { x: 3, y: 4, label: 'B' }], ['A', 'B']))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('join draws one polyline through the named points in order, and skips an unknown label', () => {
    const pts = [{ x: 1, y: 1, label: 'A' }, { x: 1, y: 4, label: 'B' }, { x: 5, y: 4, label: 'C' }];
    const m = coordsSVG(grid(5, pts, ['A', 'B', 'C', 'Z'])).match(/<polyline class="join" points="([^"]+)"/)!;
    const drawn = m[1].split(' ').map(p => p.split(',').map(Number));
    expect(drawn).toEqual(['A', 'B', 'C'].map(l => { const p = pts.find(q => q.label === l)!; return coordsPos(5, p.x, p.y).map(n => Math.round(n * 100) / 100); }));
    expect(coordsSVG(grid(5, pts))).not.toContain('<polyline');
  });

  it('a point off the grid or not finite is skipped with a warning, and a bad size draws an empty card', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = coordsSVG(grid(5, [{ x: 6, y: 1, label: 'A' }, { x: NaN, y: 1, label: 'B' }, { x: 2, y: -1, label: 'C' }, { x: 2, y: 2, label: 'D' }]));
    expect((html.match(/class="pt"/g) ?? []).length).toBe(1);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(coordsSVG(grid(11, []))).not.toContain('<svg');
    warn.mockRestore();
  });

  it('renderVisual routes a coords visual here, and escapes a label', () => {
    const v = grid(5, [{ x: 1, y: 1, label: '<b>' }]);
    expect(renderVisual(v)).toBe(coordsSVG(v));
    expect(renderVisual(v)).not.toContain('<b>');
  });

  it('the repeat key reads positions, not labels', () => {
    const q = (pts: Coords['points']) => ({ prompt: 'p', answer: 'a', options: ['a'], visual: grid(5, pts) });
    const base = [{ x: 1, y: 2, label: 'A' }, { x: 3, y: 4, label: 'B' }];
    expect(repeatKey(q(base))).not.toBe(repeatKey(q([{ x: 1, y: 3, label: 'A' }, base[1]])));
    expect(repeatKey(q(base))).toBe(repeatKey(q([{ ...base[0], label: 'C' }, { ...base[1], label: 'D' }])));
    expect(repeatKey({ ...q(base), visual: grid(6, base) })).not.toBe(repeatKey(q(base)));
  });
});
