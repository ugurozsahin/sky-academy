import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { SHAPES_2D, sameShape } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-shapes')!;
const SET = SHAPES_2D.slice(0, 4);
const nameOf = (g: string) => SET.find(s => s[0] === g)![1];
const DRAWS = 150;

/** #969: Reception names the four shapes; a square is a rectangle, so neither is ever the other's decoy. */
describe('r-shapes (#969)', () => {
  it('is a Reception maths topic', () => {
    expect(topic.year).toBe('reception');
  });

  it('the answer is the glyph–name pair, and no other option shares its shape group', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9690 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const ctx = `d${d} draw ${i}: ${q.prompt} ${q.options.join(',')}`;
        if (d === 3) {
          const g = (q.visual as { type: 'word'; text: string }).text;
          expect(q.answer, ctx).toBe(nameOf(g));
          for (const o of q.options.filter(o => o !== q.answer)) expect(sameShape(o, q.answer), ctx).toBe(false);
        } else {
          const asked = /Which is a (\w+)\?/.exec(q.prompt)![1];
          expect(nameOf(q.answer), ctx).toBe(asked);
          for (const o of q.options.filter(o => o !== q.answer)) expect(sameShape(nameOf(o), asked), ctx).toBe(false);
        }
        expect(q.options, ctx).toContain(q.answer);
      }
    }
  });

  it('only the four Reception shapes appear, and option counts follow the ladder', () => {
    const names = SET.map(s => s[1]), glyphs = SET.map(s => s[0]);
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9695 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const o of q.options) expect(d === 3 ? names : glyphs, `d${d}`).toContain(o);
        if (d === 1) {
          expect(q.options).toHaveLength(3);
        } else {
          const n = q.answer === 'square' || q.answer === 'rectangle' || q.answer === '■' || q.answer === '▬' ? 3 : 4;
          expect(q.options, `d${d} ${q.prompt}`).toHaveLength(n);
        }
      }
    }
  });
});
