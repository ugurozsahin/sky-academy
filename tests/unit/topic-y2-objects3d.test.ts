import { describe, it, expect } from 'vitest';
import { y2Objects3d, OBJECTS_3D, ANSWER_SOLIDS } from '../../src/curriculum/year2-objects3d';
import { SHAPES_3D, sameShape } from '../../src/curriculum/util';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DRAWS = 400;
const solidOfEmoji = (e: string) => OBJECTS_3D.find(o => o[0] === e)?.[2];
const SOLID_NAMES = SHAPES_3D.map(s => s[1]);

describe('y2-objects3d (#997)', () => {
  it('no bank picture is a SHAPES_3D glyph (compared by reference, never typed here)', () => {
    const glyphs = new Set(SHAPES_3D.map(s => s[0]));
    expect(OBJECTS_3D.filter(o => glyphs.has(o[0]))).toEqual([]);
  });

  it('a solid is an answer only with two or more objects: sphere, cylinder, cuboid', () => {
    expect([...ANSWER_SOLIDS].sort()).toEqual(['cuboid', 'cylinder', 'sphere']);
  });

  it.each([1, 2, 3] as const)('d%i: exactly one option is the right solid, cube and cuboid never share a card, every card has a say', (d) => {
    const rng = mulberry32(900 + d);
    const dirs = new Set<string>();
    for (let i = 0; i < DRAWS; i++) {
      const q = y2Objects3d(d, rng);
      expect(q.say, q.prompt).toBeTruthy();
      expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
      if (SOLID_NAMES.includes(q.answer)) {                              // object → solid name
        dirs.add('name');
        const emoji = (q.visual as { text: string }).text;
        expect(q.answer, q.prompt).toBe(solidOfEmoji(emoji));
        expect(q.options.filter(o => sameShape(o, q.answer)), q.prompt).toHaveLength(1);
        expect(q.options.includes('cube') && q.options.includes('cuboid'), q.prompt).toBe(false);
      } else {                                                           // solid → object
        dirs.add('object');
        const solid = /Which one is a (\w+)\?/.exec(q.prompt)![1];
        expect(solidOfEmoji(q.answer), q.prompt).toBe(solid);
        expect(q.options.filter(o => sameShape(solidOfEmoji(o)!, solid)), q.prompt).toEqual([q.answer]);
        const solids = q.options.map(o => solidOfEmoji(o));
        expect(solids.includes('cube') && solids.includes('cuboid'), q.prompt).toBe(false);
      }
    }
    expect([...dirs].sort()).toEqual(d === 1 ? ['name'] : d === 2 ? ['object'] : ['name', 'object']);
  });
});
