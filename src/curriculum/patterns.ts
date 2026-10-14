// Pattern objects shared by Reception and Year 2 repeating-pattern strips (#970); moved unchanged from year2/shape.ts.
/**
 * The objects a pattern is built from: **one silhouette each** (#299 review B4).
 *
 * The first pool here was eight coloured circles. Six of them differed by hue alone, and because the near
 * decoy is always another object from the same card, 54% of d1 cards put two of those six in front of the
 * child at once — 🔴/🟢, 🔵/🟣 and the rest of the standard confusions. To a colour-blind child the sequence
 * then reads as one repeated circle and the two bubbles are identical: not a hard card, a card with **no**
 * answer, which fails #299's own "exactly one defensible answer with the voice off" the same way a card that
 * answers itself does.
 *
 * So every object carries a different shape, and the name beside each glyph is what the rail in
 * `tests/unit/curriculum.test.ts` holds unique — colour is decoration here, never the thing being read.
 */
export const PATTERN_OBJECTS: readonly (readonly [string, string])[] = [
  ['🔴', 'circle'], ['🟦', 'square'], ['🔺', 'triangle'], ['⭐', 'star'],
  ['❤️', 'heart'], ['🌙', 'crescent'], ['🔶', 'diamond'], ['🐟', 'fish'],
];
