import { describe, it, expect } from 'vitest';
import { y2Position } from '../../src/curriculum/year2';
import { DIRS, DIR_DEG } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const TURN_Q = /Which turn\?$/;          // kind 2: "Face ⬆️, turn … to face ➡️. Which turn?"
const FACE_Q = /^Face (\S+), then /;      // kind 0
const RIGHT_ANGLES = /right angle/;       // kind 1

describe('y2-position draws the turn it asks about (#2271)', () => {
  it('DIR_DEG runs parallel to DIRS', () => expect(DIR_DEG).toHaveLength(DIRS.length));

  for (const d of [1, 2, 3] as const) {
    it(`difficulty ${d}: each kind carries the picture it should`, () => {
      const seen = new Set<number>();
      for (let seed = 1; seed <= 300; seed++) {
        const q = y2Position(d, rng(seed));
        const parts = q.visual?.type === 'geometry' ? q.visual.parts : [];
        if (TURN_Q.test(q.prompt)) {               // two bare rays would mislead (a quarter and three-quarters look alike): no picture
          seen.add(2); expect(q.visual, q.prompt).toBeUndefined();
        } else if (FACE_Q.test(q.prompt)) {        // one ray, pointing the way the start arrow names
          seen.add(0); expect(parts, q.prompt).toHaveLength(1);
          const p = parts[0], start = DIRS.findIndex(x => x[1] === FACE_Q.exec(q.prompt)![1]);
          expect(p.kind).toBe('segment');
          if (p.kind === 'segment') {
            const ang = Math.round(Math.atan2(p.a[1] - p.b[1], p.b[0] - p.a[0]) * 180 / Math.PI + 360) % 360;
            expect(ang, q.prompt).toBe(DIR_DEG[start]);
          }
        } else {                                   // right angles: one angle arc worth steps * 90
          expect(q.prompt, q.prompt).toMatch(RIGHT_ANGLES); seen.add(1);
          expect(parts, q.prompt).toHaveLength(1);
          const p = parts[0];
          expect(p.kind).toBe('angle');
          if (p.kind === 'angle') expect(p.deg % 90).toBe(0);
        }
      }
      expect([...seen].sort()).toEqual(d === 1 ? [0, 1] : [0, 1, 2]);
    });
  }
});
