import { describe, expect, it } from 'vitest';
import { COIN_MIN_PX, coinSVG } from '../../src/ui/visuals';

describe('coinSVG — legible on a phone (#2278)', () => {
  const width = (p: number) => Number(/class="coin" style="width:([\d.]+)px"/.exec(coinSVG(p))![1]);
  it('no coin is drawn narrower than the minimum', () => {
    for (const p of [1, 2, 5, 10, 20, 50, 100, 200]) expect(width(p)).toBeGreaterThanOrEqual(COIN_MIN_PX);
  });
  it('the bigger coins keep their size, so the 50p is still wider than the 5p', () => {
    expect(width(50)).toBeGreaterThan(width(5));
  });
  it('the label is a dark ink, not the rim colour', () => {
    expect(coinSVG(5)).toContain('fill="#2f3542">5p');
    expect(coinSVG(1)).toContain('fill="#3d2209">1p');
  });
});
