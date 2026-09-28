import { describe, it, expect } from 'vitest';
import { R_SENTS } from '../../src/curriculum/reception';

/**
 * #1298: `R_SENTS[1]`'s "Mum has a cup." paired with ☕ ("hot beverage"), the same mistaught-picture
 * class #874 fixed in `CVC` — a cup entry must name a cup, not what it might hold.
 */
describe('R_SENTS picture bank (#1298)', () => {
  it('cup is a cup, not a hot beverage', () => {
    const entry = R_SENTS[1].find(([sentence]) => sentence === 'Mum has a cup.');
    expect(entry?.[1]).toBe('🥤');
  });

  it('no entry still pairs a sentence with ☕', () => {
    for (const bank of R_SENTS)
      for (const [sentence, picture] of bank)
        expect(picture, `"${sentence}" pairs with ☕`).not.toBe('☕');
  });

  it('every picture in a difficulty bank is unique, as CVC requires of its own bank', () => {
    for (const bank of R_SENTS) {
      const pictures = bank.map(([, picture]) => picture);
      expect(new Set(pictures).size).toBe(pictures.length);
    }
  });
});
