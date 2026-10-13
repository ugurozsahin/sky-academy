import { describe, it, expect } from 'vitest';
import { y2Faces } from '../../src/curriculum/year2-faces';
import { SHAPES_2D, SHAPES_3D } from '../../src/curriculum/util';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DRAWS = 400;
// The test's own copy of the face-set table (a square is a rectangle, so a set holding one holds the other).
const TABLE: Record<string, string[]> = {
  cube: ['square', 'rectangle'], cuboid: ['rectangle', 'square'], cylinder: ['circle'], cone: ['circle'],
  pyramid: ['triangle', 'square', 'rectangle'], sphere: [],
};
const flatOf = (g: string) => SHAPES_2D.find(s => s[0] === g)?.[1];
const solidOfGlyph = (g: string) => SHAPES_3D.find(s => s[0] === g)?.[1];
const solidOfAs = (a: string) => SHAPES_3D.find(s => s[2].as === a)![1];

describe('y2-faces (#998)', () => {
  it.each([1, 2, 3] as const)('d%i: exactly one option is right by the face-set table, every card has 4 options and a say', (d) => {
    const rng = mulberry32(980 + d);
    const kinds = new Set<string>();
    for (let i = 0; i < DRAWS; i++) {
      const q = y2Faces(d, rng);
      expect(q.say, q.prompt).toBeTruthy();
      expect(new Set(q.options).size, q.prompt).toBe(4);
      expect(q.options).toContain(q.answer);
      let right: string[];
      const on = /^Which flat shape is on a ([\w-]+ ?\w*)\?$/.exec(q.prompt);
      const has = /^Which 3-D shape has a (\w+) face\?$/.exec(q.prompt);
      const sides = /^How many sides has a (\w+) face of a ([\w -]+)\?$/.exec(q.prompt);
      if (on) {
        kinds.add('face');
        const s = solidOfAs(on[1]);
        expect(s, q.prompt).not.toBe('sphere');
        right = q.options.filter(o => TABLE[s].includes(flatOf(o)!));
        expect(q.options.every(o => flatOf(o) !== undefined), q.prompt).toBe(true);
        const names = q.options.map(o => flatOf(o));
        expect(names.includes('square') && names.includes('rectangle'), q.prompt).toBe(false);
        if (s === 'cube') expect(flatOf(q.answer)).toBe('square');
        if (s === 'cuboid') expect(flatOf(q.answer)).toBe('rectangle');
      } else if (has) {
        kinds.add('solid');
        right = q.options.filter(o => TABLE[solidOfGlyph(o)!].includes(has[1]));
        const names = q.options.map(o => solidOfGlyph(o));
        expect(names.includes('cube') && names.includes('cuboid'), q.prompt).toBe(false);
        if (has[1] === 'circle') expect(names.includes('cylinder') && names.includes('cone'), q.prompt).toBe(false);
        if (has[1] === 'rectangle') expect(solidOfGlyph(q.answer)).toBe('cuboid');
      } else {
        expect(sides, q.prompt).not.toBeNull();
        kinds.add('sides');
        const face = SHAPES_2D.find(s => s[1] === sides![1])!;
        expect(TABLE[solidOfAs(sides![2])], q.prompt).toContain(face[1]);
        expect(q.answer).toBe(String(face[2]));
        expect(q.answer, q.prompt).toMatch(/^[34]$/);
        right = [q.answer];
      }
      expect(right, q.prompt).toEqual([q.answer]);
    }
    expect([...kinds].sort()).toEqual(d === 1 ? ['face'] : d === 2 ? ['face', 'solid'] : ['face', 'sides', 'solid']);
  });
});
