import { describe, it, expect } from 'vitest';
import { DIGRAPH_WORDS } from '../../src/curriculum/year1';
import { TOPICS } from '../../src/curriculum';

/**
 * #2273: a child who decodes the picture must get the right sound. Every pair below has exactly one name a
 * four- to six-year-old says; an oil drum for "oil" and a butterfly for "moth" did not.
 * A word added to `DIGRAPH_WORDS` fails here until someone has looked at its picture.
 */
const REVIEWED: [string, string, string][] = [
  ['ship', 'sh', '🚢'], ['fish', 'sh', '🐟'], ['chip', 'ch', '🍟'], ['chick', 'ch', '🐤'], ['thumb', 'th', '👍'], ['bath', 'th', '🛁'],
  ['ring', 'ng', '💍'], ['king', 'ng', '👑'], ['rain', 'ai', '🌧️'], ['boat', 'oa', '⛵'], ['moon', 'oo', '🌙'], ['tree', 'ee', '🌳'],
  ['toilet', 'oi', '🚽'], ['cow', 'ow', '🐮'], ['star', 'ar', '⭐'], ['fork', 'or', '🍴'], ['bee', 'ee', '🐝'], ['sheep', 'ee', '🐑'],
  ['snail', 'ai', '🐌'], ['goat', 'oa', '🐐'], ['shark', 'ar', '🦈'], ['whale', 'wh', '🐋'],
];

describe('phonics pictures name one word (#2273)', () => {
  it('y1-digraphs draws only the reviewed word–picture pairs', () => {
    expect(DIGRAPH_WORDS).toEqual(REVIEWED);
  });

  it('y1-when strips show morning, afternoon, evening as sunrise, sun, sunset (not a moon)', () => {
    const gen = TOPICS.find(t => t.id === 'y1-when')!.gen;
    const seen = new Set<number>();
    for (let seed = 1; seen.size < 3 && seed < 500; seed++) {
      let a = seed;
      const rng = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const v = gen(1, rng).visual as { type: string; text: string } | undefined;
      if (v?.type !== 'strip') continue;
      const cells = v.text.split(' '), gap = cells.indexOf('_');
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(cells.map((c, i) => (i === gap ? '_' : c))).toEqual(['🌅', '☀️', '🌇'].map((c, i) => (i === gap ? '_' : c)));
      seen.add(gap);
    }
    expect([...seen].sort(), 'drew a strip with each of the three cells hidden').toEqual([0, 1, 2]);
  });
});
