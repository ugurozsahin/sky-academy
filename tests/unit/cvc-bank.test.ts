import { describe, it, expect } from 'vitest';
import { CVC } from '../../src/curriculum/util';

/**
 * #874: `mug`/`rug`/`jam`/`zip` taught the wrong word from their pictures, and `cup`'s ☕ names no cup.
 * This pins the reviewed allowlist so a future `CVC` entry cannot land without the same review: word,
 * emoji, and the emoji's Unicode short name, checked against the actual codepoint rather than eyeballed.
 */
const REVIEWED: [string, string, string][] = [
  ['cat', '🐱', 'cat face'],
  ['dog', '🐶', 'dog face'],
  ['sun', '☀️', 'sun'],
  ['pig', '🐷', 'pig face'],
  ['cup', '🥤', 'cup with straw'],
  ['pen', '🖊️', 'pen'],
  ['egg', '🥚', 'egg'],
  ['map', '🗺️', 'world map'],
  ['net', '🥅', 'goal net'],
  ['tap', '🚰', 'potable water'],
  ['pot', '🍲', 'pot of food'],
  ['pin', '📌', 'pushpin'],
  ['nut', '🥜', 'peanuts'],
  ['cap', '🧢', 'billed cap'],
  ['rat', '🐀', 'rat'],
  ['pan', '🍳', 'cooking'],
  ['bus', '🚌', 'bus'],
  ['hat', '🎩', 'top hat'],
  ['bed', '🛏️', 'bed'],
  ['fox', '🦊', 'fox face'],
  ['bag', '👜', 'handbag'],
  ['hen', '🐔', 'chicken'],
  ['box', '📦', 'package'],
  ['bat', '🦇', 'bat'],
  ['web', '🕸️', 'spider web'],
  ['cow', '🐮', 'cow face'],
  ['leg', '🦵', 'leg'],
  ['bug', '🐛', 'bug'],
  ['van', '🚐', 'minibus'],
  ['log', '🪵', 'wood'],
];

describe('CVC picture bank (#874)', () => {
  it('is exactly the reviewed allowlist, in the reviewed order', () => {
    expect(CVC).toEqual(REVIEWED.map(([w, e]) => [w, e]));
  });

  it('removed the four mistaught words', () => {
    for (const w of ['mug', 'rug', 'jam', 'zip'])
      expect(CVC.some(([word]) => word === w), `${w} should be gone`).toBe(false);
  });

  it('cup is a cup, not a hot beverage', () => {
    expect(CVC.find(([w]) => w === 'cup')?.[1]).toBe('🥤');
  });

  it('every emoji in the bank is unique', () => {
    const emojis = CVC.map(([, e]) => e);
    expect(new Set(emojis).size).toBe(emojis.length);
  });
});
