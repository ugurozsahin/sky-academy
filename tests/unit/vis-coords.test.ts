import { createHash } from 'node:crypto';
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

  // #1213: `min` extends the grid below zero; without it the drawing is exactly what #1129 shipped.
  describe('four quadrants (#1213)', () => {
    const first = grid(8, [{ x: 1, y: 2, label: 'A' }, { x: 6, y: 5, label: 'B' }, { x: 0, y: 8, label: 'C' }], ['A', 'B', 'C']);

    it('a first-quadrant card renders byte-identically to #1129, with or without min: 0', () => {
      const sha = (v: Coords) => createHash('sha256').update(coordsSVG(v)).digest('hex');
      expect(sha(first)).toBe('1b0ec273e063adc26fc2185126c376d6398e4a77bd56661e15b5d5983e880c56');
      expect(coordsSVG({ ...first, min: 0 })).toBe(coordsSVG(first));
    });

    it('the axes are numbered −5…5 with the real minus sign, and the heavy axes cross at the origin', () => {
      const html = coordsSVG({ ...grid(5, []), min: -5 });
      const nums = (cls: string) => [...html.matchAll(new RegExp(`<text class="${cls}"[^>]*>([^<]+)</text>`, 'g'))].map(m => m[1]);
      const want = ['−5', '−4', '−3', '−2', '−1', '0', '1', '2', '3', '4', '5'];
      expect(nums('ax')).toEqual(want);
      expect(nums('ay')).toEqual(want);
      expect(html).not.toMatch(/>-\d/);
      expect((html.match(/class="gx"/g) ?? []).length).toBe(11);
      const heavy = (cls: string) => [...html.matchAll(new RegExp(`<line class="${cls}"[^>]*stroke:var\\(--text\\)`, 'g'))];
      expect(heavy('gx')).toHaveLength(1);
      expect(heavy('gy')).toHaveLength(1);
      expect(html).toContain('x1="64" y1="12" x2="64" y2="112"');   // x = 0 is the middle column
      expect(html).toContain('x1="14" y1="62" x2="114" y2="62"');   // y = 0 is the middle row
    });

    it('every dot in all four quadrants sits exactly on its (x, y)', () => {
      const points = [];
      for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) points.push({ x, y, label: 'A' });
      const dots = [...coordsSVG({ ...grid(5, points), min: -5 }).matchAll(/<circle class="pt" data-x="(-?\d+)" data-y="(-?\d+)" cx="([\d.-]+)" cy="([\d.-]+)"/g)];
      expect(dots).toHaveLength(121);
      for (const [, x, y, cx, cy] of dots) {
        const [ex, ey] = coordsPos(5, +x, +y, -5);
        expect(Math.abs(+cx - ex)).toBeLessThan(0.006);
        expect(Math.abs(+cy - ey)).toBeLessThan(0.006);
      }
      expect(coordsPos(5, 0, 0, -5)).toEqual([64, 62]);
      expect(coordsPos(5, -5, -5, -5)).toEqual([14, 112]);
      expect(coordsPos(5, 5, 5, -5)).toEqual([114, 12]);
    });

    it('a point below min is skipped, a min outside −10…0 draws an empty card, and the repeat key reads min', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect((coordsSVG({ ...grid(5, [{ x: -6, y: 0, label: 'A' }, { x: -5, y: 0, label: 'B' }]), min: -5 }).match(/class="pt"/g) ?? []).length).toBe(1);
      expect(coordsSVG({ ...grid(5, []), min: 1 })).not.toContain('<svg');
      warn.mockRestore();
      const q = (v: Coords) => ({ prompt: 'p', answer: 'a', options: ['a'], visual: v });
      const pts = [{ x: 1, y: 2, label: 'A' }];
      expect(repeatKey(q({ ...grid(5, pts), min: -5 }))).not.toBe(repeatKey(q(grid(5, pts))));
      expect(repeatKey(q({ ...grid(5, pts), min: 0 }))).toBe(repeatKey(q(grid(5, pts))));
    });
  });
});
