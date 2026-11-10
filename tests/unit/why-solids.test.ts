// #2317 (y2-objects3d, y2-faces, y5-3d, y6-nets): the why line states a fact that is true of the card it follows.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string, d: Difficulty, s: number) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d));

describe('3-D topics say why (#2317)', () => {
  it('y2-objects3d: the why describes the answer solid', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 150; s++) {
      const q = draw('y2-objects3d', d, s), solid = q.prompt.startsWith('Which one is a ') ? q.prompt.slice(15, -1) : q.answer;
      expect(q.why, q.prompt).toContain(solid === 'pyramid' ? 'pyramid' : solid);
    }
  });
  it('y2-faces: a face why names the face and the solid it belongs to', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 150; s++) {
      const q = draw('y2-faces', d, s);
      expect(q.why, q.prompt).toMatch(/^A [a-z-]+( [a-z-]+)? has (a [a-z]+ face|\d sides)\.$/);
    }
  });
  it('y6-nets: a count why states the number the answer is', () => {
    for (let s = 0; s < 200; s++) {
      const q = draw('y6-nets', 1, s);
      expect(q.why, q.prompt).toContain(`has ${q.answer} `);
    }
  });
  it('y6-nets: a net why names the net, and a "no" names the solid asked', () => {
    for (let s = 0; s < 200; s++) {
      const q = draw('y6-nets', 2, s);
      expect(q.why, q.prompt).toMatch(q.answer === 'yes' ? /make a / : /needs .*, not /);
    }
  });
  it('y5-3d: the face description why repeats the faces the card asked about', () => {
    for (let s = 0; s < 150; s++) {
      const q = draw('y5-3d', 1, s), faces = q.prompt.replace('Which solid has ', '').replace('?', '');
      expect(q.why, q.prompt).toBe(`A ${q.answer} has ${faces}.`);
    }
  });
});
