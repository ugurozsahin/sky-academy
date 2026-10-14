import { describe, it, expect } from 'vitest';
import { POOL_CARDS } from './helpers/duel-cards';

describe('duel card catalogue (#425, moved from duel.spec.ts by #1022)', () => {
  it('guard rail: the fixture catalogue still covers what the pool can draw (#425)', () => {
    // A floor of its own, because the realistic degradations are SILENT. `POOL_CARDS = []` throws a TypeError
    // rather than failing an assertion, and `[plain]` — the one text-only card, which is what a `renderVisual`
    // or `duelPool` regression actually leaves — passes both sweeps green, every height and clipping and
    // subpixel claim in them then describing a card with no picture at all.
    expect(POOL_CARDS.length, 'the catalogue is not empty').toBeGreaterThan(20);
    const kinds = new Set(POOL_CARDS.map(c => c.kind));
    expect(kinds.size, 'every visual kind a duel can draw is represented').toBeGreaterThanOrEqual(14);
    expect(new Set(POOL_CARDS.map(c => c.topic)).size, 'drawn from many topics, not one').toBeGreaterThan(10);
    // The three cards the CSS comments are written around, by name rather than by hoping iteration order keeps
    // them. Each was absent from the first version of this catalogue.
    // By its SIZE, not merely its existence. `some(kind && topic)` is satisfied by a FOUR-star card, which is
    // exactly what the catalogue held while this line read green (PR #428 review round 4, B1a): the selection
    // above is what fixed it, and this is what keeps it fixed. Counted on the rendered output — one
    // `class="obj"` per star — so the claim in the message is the claim being checked.
    const stars = POOL_CARDS.filter(c => c.topic === 'y2-fractions' && c.kind === 'objects')
      .map(c => (c.html.match(/class="obj"/g) ?? []).length);
    expect(Math.max(0, ...stars), 'the TWELVE-star counting card the 160px budget exists for, not a smaller one of the same kind')
      .toBeGreaterThanOrEqual(12);
    expect(POOL_CARDS.some(c => c.what.endsWith('hidden tick rightmost')),
      "the number line whose `?` is rightmost, which `overflow-y: clip` exists for").toBe(true);
    expect(POOL_CARDS.some(c => c.kind === 'chart'), 'a chart card').toBe(true);
  });
});
