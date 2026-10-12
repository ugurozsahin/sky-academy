import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/audio', () => ({ say: vi.fn() }));
import { say } from '../../src/audio';
import { BEAT_LINE, createGhost, passedBest } from '../../src/ui/ghost';

describe('passedBest (#914)', () => {
  it('is true only on the answer that crosses the best', () => {
    expect(passedBest(10, 11, 10)).toBe(true);
    expect(passedBest(9, 10, 10)).toBe(false);     // equalling is not beating
    expect(passedBest(11, 12, 10)).toBe(false);    // already past: never again
  });
  it('is never true with no best', () => {
    expect(passedBest(0, 1, 0)).toBe(false);
    expect(passedBest(0, 1, Number.NaN)).toBe(false);
  });
});

describe('createGhost (#914)', () => {
  const o = { mode: 'sprint' } as never;
  it('speaks and returns the line exactly once as the score climbs past the best', () => {
    vi.mocked(say).mockClear();
    const g = createGhost(o, 2);
    expect([1, 2, 3, 4, 5].map(s => g.beat(s))).toEqual([null, null, BEAT_LINE, null, null]);
    expect(say).toHaveBeenCalledTimes(1);
  });
  it('has no ghost outside a one-topic Sprint', () => {
    for (const bad of [{ mode: 'mission', topic: { id: 'y2-tables' } }, { mode: 'sprint' }, { mode: 'sprint', topic: { id: 'y2-tables' }, deck: [] }]) {
      const g = createGhost(bad as never);
      expect([1, 5, 50].map(s => g.beat(s))).toEqual([null, null, null]);
    }
  });
});
