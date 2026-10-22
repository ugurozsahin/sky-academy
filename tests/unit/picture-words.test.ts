import { describe, it, expect } from 'vitest';
import { DIGRAPH_WORDS } from '../../src/curriculum/year1';

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
});
