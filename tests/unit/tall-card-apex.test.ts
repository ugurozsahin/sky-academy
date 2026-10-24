// #2278: on a 390×844 phone `y5-transform`'s card ends at 534 px, past half the box, so the old 0.5 cap put the card
// line at 422 px and an arc could end at 422 px, behind the card. A tall box now lets the card line sit where the
// card ends (up to 0.65 of the box); a landscape box keeps the old half.
import { describe, expect, it } from 'vitest';
import { layoutWave } from '../../src/game/bubbles';
import { insetMax, TOP_INSET_MAX } from '../../src/game/wave-bounds';
import type { Rng } from '../../src/curriculum/types';

const seeded = (s: number): Rng => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

describe('the card line in a tall box', () => {
  it('allows 0.65 of an upright phone, and half of a landscape one', () => {
    expect(insetMax(390, 844)).toBeCloseTo(844 * 0.65, 9);
    expect(insetMax(844, 390)).toBe(390 * TOP_INSET_MAX);
    expect(insetMax(768, 1024)).toBe(1024 * TOP_INSET_MAX);   // a tablet's card is small against its box: no change
  });

  it('no arc ends behind a 534 px card at 390×844', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const geom = { W: 390, H: 844, topInset: 534 };
      const plan = layoutWave({ labels: ['A', 'B', 'C', 'D'], speed: 1 }, geom, 1, 0, seeded(seed));
      for (const b of plan.bubbles) {
        const apexY = geom.H + plan.r - (b.vy * b.vy) / (2 * b.g);   // launched from the line `H + r`, as `check` in wave-gravity.test.ts reads it
        expect(apexY, `seed ${seed}`).toBeGreaterThanOrEqual(534 + plan.r - 1e-6);
      }
    }
  });
});
