import { describe, it, expect } from 'vitest';
import { dojoRowLine, lockedStickerLine } from '../../src/ui/home';
import { shopItemLine } from '../../src/ui/shop';
import type { Challenge } from '../../src/game/dojo';

// #894: pre-readers cannot read the Daily Dojo rows, locked stickers or shop item cards, so a tap on any of
// them reads the same text a sighted reader already sees. These are the pure line builders behind that tap —
// the DOM binding itself is covered by tests/e2e/game.spec.ts, since it needs a real click and a speech stub.

const challenge = (goal: number): Challenge => ({ id: 'correct15', group: 'volume', icon: '🎯', title: 'Answer 15 questions right', goal, bonus: 10 });

describe('menu tap-to-speak lines (#894)', () => {
  it('dojoRowLine: undone reads the title with a fraction', () => {
    expect(dojoRowLine(challenge(15), 7)).toBe('Answer 15 questions right. 7 of 15 done.');
  });
  it('dojoRowLine: no progress yet still reads a fraction, not "Done!"', () => {
    expect(dojoRowLine(challenge(15), 0)).toBe('Answer 15 questions right. 0 of 15 done.');
  });
  it('dojoRowLine: met or passed its goal reads "Done!" instead of a fraction', () => {
    expect(dojoRowLine(challenge(15), 15)).toBe('Answer 15 questions right. Done!');
    expect(dojoRowLine(challenge(15), 20)).toBe('Answer 15 questions right. Done!');   // carried past goal, still "Done!"
  });

  it('lockedStickerLine: a coin sticker names its cost', () => {
    expect(lockedStickerLine(50, undefined)).toBe('This sticker costs 50 coins.');
  });
  it('lockedStickerLine: an achievement sticker names the achievement, not a cost', () => {
    expect(lockedStickerLine(undefined, 'Beat Hammer Man once')).toBe('Beat Hammer Man once');
  });
  it('lockedStickerLine: a cost of 0 still reads as a coin sticker, not the achievement branch', () => {
    // 0 !== undefined, so a coin-priced sticker (were the price ever 0) must not fall through to the title.
    expect(lockedStickerLine(0, 'should not be read')).toBe('This sticker costs 0 coins.');
  });

  it('shopItemLine: the item\'s name and blurb, full stop between them', () => {
    expect(shopItemLine({ name: 'Gold Trail', blurb: 'A shimmering gold slice trail' }))
      .toBe('Gold Trail. A shimmering gold slice trail');
  });
});
