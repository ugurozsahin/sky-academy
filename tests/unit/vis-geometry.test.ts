import { describe, it, expect } from 'vitest';
import { geometrySVG, rayEnds, LABEL_FS } from '../../src/ui/vis-geometry';
import { renderVisual } from '../../src/ui/visuals';
import type { GeoPart } from '../../src/curriculum';

type Angle = Extract<GeoPart, { kind: 'angle' }>;
const angle = (deg: number, dir = 20): Angle => ({ kind: 'angle', at: [50, 38], dir, deg });
const svg = (p: GeoPart) => geometrySVG({ type: 'geometry', parts: [p] });
/** The anticlockwise turn from the first vector to the second, in degrees, 0–360. */
const turn = (c: [number, number], a: [number, number], b: [number, number]) => {
  const t = (p: [number, number]) => Math.atan2(-(p[1] - c[1]), p[0] - c[0]) * 180 / Math.PI;
  return (((t(b) - t(a)) % 360) + 360) % 360;
};

describe('geometry visual (#1075)', () => {
  it('the rays are drawn at the data angle, 0°–360° in 5° steps, within 0.5°', () => {
    for (let deg = 0; deg <= 360; deg += 5) for (const dir of [0, 20, 133, 270]) {
      const p = angle(deg, dir), [a, b] = rayEnds(p);
      const off = Math.abs(turn(p.at, a, b) - (deg % 360));
      expect(Math.min(off, 360 - off), `deg ${deg} dir ${dir}`).toBeLessThan(0.5);
    }
  });

  it('the arc sweeps exactly deg, and the square mark appears if and only if deg is 90', () => {
    for (let deg = 5; deg < 360; deg += 5) {
      const html = svg(angle(deg, 40));
      expect(html.includes('rightmark'), `deg ${deg}`).toBe(deg === 90);
      expect(html.includes('class="arc"'), `deg ${deg}`).toBe(deg !== 90);
      if (deg === 90) continue;
      const m = html.match(/class="arc" d="M([\d.-]+) ([\d.-]+)A7 7 0 (\d) 0 ([\d.-]+) ([\d.-]+)"/)!;
      expect(m, `arc path for ${deg}`).toBeTruthy();
      expect(m[3]).toBe(deg > 180 ? '1' : '0');
      expect(Math.abs(turn([50, 38], [+m[1], +m[2]], [+m[4], +m[5]]) - deg)).toBeLessThan(0.5);
    }
  });

  it('a full turn draws a circle mark, and no angle draws no mark', () => {
    expect(svg(angle(360))).toContain('<circle');
    expect(svg(angle(0))).not.toMatch(/class="arc"|rightmark|<circle/);
  });

  it('segment end points equal the data, and ticks and labels are drawn', () => {
    const html = svg({ kind: 'segment', a: [10, 20], b: [40.5, 20], ticks: 2, label: 'B' });
    expect(html).toContain('M10 20L40.5 20');
    expect(html.match(/<path/g)).toHaveLength(3);
    expect(html).toContain('>B</text>');
  });

  it('every label is rendered at 13 px or more at the narrowest card width, and no hex colours are used', () => {
    expect(LABEL_FS * 200 / 100).toBeGreaterThanOrEqual(13);
    const html = geometrySVG({ type: 'geometry', parts: [angle(90), angle(45, 200), { kind: 'segment', a: [1, 2], b: [30, 40], ticks: 3, label: 'A' }] });
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).toContain('var(--text)');
    expect(html).toContain('var(--accent)');
  });

  it('a part with a non-finite number is skipped with a warning, not thrown', () => {
    const warn = console.warn; const calls: unknown[] = []; console.warn = (...a) => { calls.push(a); };
    try {
      const html = geometrySVG({ type: 'geometry', parts: [angle(NaN), { kind: 'segment', a: [0, 0], b: [Infinity, 1] }, angle(60)] });
      expect(calls).toHaveLength(2);
      expect(html.match(/<path/g)).toHaveLength(2);   // the good angle: rays + arc
    } finally { console.warn = warn; }
  });

  it('renderVisual dispatches to it', () => {
    expect(renderVisual({ type: 'geometry', parts: [angle(90)] })).toContain('class="geo"');
  });
});
