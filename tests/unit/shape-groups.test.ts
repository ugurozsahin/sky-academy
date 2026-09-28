import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { SHAPES_2D, SHAPES_3D, sameShape } from '../../src/curriculum/util';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A square IS a rectangle (Y1 NC: "rectangles (including squares)"), so neither may be the other's decoy on
// a "Which is a …?" card (#872, mirroring the existing cube/cuboid rail for #299).
describe('sameShape (#872)', () => {
  it('is symmetric over every pair of SHAPES_2D and SHAPES_3D names', () => {
    const names = [...SHAPES_2D.map(x => x[1]), ...SHAPES_3D.map(x => x[1])];
    for (const a of names) for (const b of names) expect(sameShape(a, b), `${a}/${b}`).toBe(sameShape(b, a));
  });

  it('never offers a same-group decoy on a Year 1 "Which is a …?" 2-D card', () => {
    const t = TOPICS.find(x => x.id === 'y1-shapes'); expect(t, 'y1-shapes').toBeTruthy();
    const byGlyph = new Map(SHAPES_2D.map(([g, name]) => [g, name]));
    let checked = 0;
    const r = rng(872);
    for (const d of [1, 2] as Difficulty[]) for (let i = 0; i < 150; i++) {
      const q = t!.gen(d, r);
      const m = /^Which is a (.+)\?$/.exec(q.prompt);
      if (!m) continue; // d2 can also draw the "How many sides" branch, which this rail does not cover
      checked++;
      const asked = m[1];
      for (const glyph of q.options) {
        const decoy = byGlyph.get(glyph)!;
        if (decoy === asked) continue; // the answer itself, not a decoy
        expect(sameShape(asked, decoy), `${q.prompt} → ${q.options.join(' ')}`).toBe(false);
      }
    }
    // A reworded "Which is a X?" prompt would make the regex above match nothing and this rail would pass
    // vacuously, the same failure mode #373 found for the 3-D table swap.
    expect(checked).toBeGreaterThan(20);
  });

  it('never offers ■ for "Which is a rectangle?" or ▬ for "Which is a square?"', () => {
    const t = TOPICS.find(x => x.id === 'y1-shapes')!;
    const r = rng(873);
    let sawRectangle = 0, sawSquare = 0;
    for (let i = 0; i < 300; i++) {
      const q = t.gen(1, r);
      if (q.prompt === 'Which is a rectangle?') { sawRectangle++; expect(q.options).not.toContain('■'); }
      if (q.prompt === 'Which is a square?') { sawSquare++; expect(q.options).not.toContain('▬'); }
    }
    expect(sawRectangle, 'never drew "Which is a rectangle?"').toBeGreaterThan(0);
    expect(sawSquare, 'never drew "Which is a square?"').toBeGreaterThan(0);
  });
});
