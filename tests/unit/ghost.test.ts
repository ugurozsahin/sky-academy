import { describe, expect, it, vi } from 'vitest';

const save = vi.hoisted(() => ({ timeX: 1 }));
vi.mock('../../src/audio', () => ({ say: vi.fn() }));
vi.mock('../../src/storage', () => ({ load: () => ({ settings: { timeX: save.timeX }, progress: { 'y2-tables-5': { sprint: 2 }, 'zz-unregistered': { sprint: 2 } } }) }));
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
    for (const bad of [{ mode: 'mission', topic: { id: 'y2-tables-5' } }, { mode: 'endless', topic: { id: 'y2-tables-5' } }, { mode: 'sprint' }]) {
      const g = createGhost(bad as never);
      expect([1, 5, 50].map(s => g.beat(s))).toEqual([null, null, null]);
    }
  });
});

describe('ghostBest gates, each failing alone (#914)', () => {
  const run = (o: Record<string, unknown>) => { const g = createGhost({ mode: 'sprint', topic: { id: 'y2-tables-5' }, ...o } as never); return [1, 2, 3].map(n => g.beat(n)); };
  it('reads the stored best for a one-topic Sprint at normal time', () => {
    save.timeX = 1;
    expect(run({})).toEqual([null, null, BEAT_LINE]);
  });
  it('is silent in Extra time, in practice and on a deck', () => {
    save.timeX = 1.5;
    expect(run({})).toEqual([null, null, null]);
    save.timeX = 1;
    expect(run({ practice: true })).toEqual([null, null, null]);
    expect(run({ deck: [] })).toEqual([null, null, null]);
    expect(run({ mode: 'mission' })).toEqual([null, null, null]);                     // Sky Storm, Boss, missions never toast
    expect(run({ topic: { id: 'zz-unregistered' } })).toEqual([null, null, null]);   // a stored best, but no registry row
  });
});
