import { describe, it, expect, vi } from 'vitest';
import { duelTopic } from '../../src/game/duel-topic';
import { shownYears, topicById, topicsFor } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';

describe('duelTopic (#956: a caller can name the duel topic)', () => {
  const pool = ['y1-add', 'y1-sub', 'y1-skip'].map(id => topicById(id)!);
  it('returns the chosen pool topic for every rng value', () => {
    for (const r of [0, 0.3, 0.99]) expect(duelTopic(pool, 'y1-sub', () => r).id).toBe('y1-sub');
  });
  it('unknown ids warn and fall back to a pool topic', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pool).toContain(duelTopic(pool, 'nope', () => 0.5));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('a topic duelPool screens out (tracing, sequence) never reaches a match: it warns and falls back', () => {
    const all = topicsFor('year1'), real = duelPool(all, 1);
    const screened = [all.find(t => t.input === 'tracing'), topicById('y1-order')].map(t => t!);   // y1-order: sequenceFrom 1
    for (const t of screened) {
      expect(t, 'fixture topic exists').toBeDefined();
      expect(real).not.toContain(t);
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const t of screened) expect(real).toContain(duelTopic(real, t.id, () => 0.5));
    expect(warn).toHaveBeenCalledTimes(screened.length);
    warn.mockRestore();
  });
  it("no id gives today's random pick without warning", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duelTopic(pool, undefined, () => 0.5)).toBe(pool[Math.floor(0.5 * pool.length)]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  // #1750: `pool[Math.floor(rng() * 0)]` of `[]` is `undefined` typed as `Topic` — the hole #1325 closed in
  // `weightedPick()`. The one caller (`src/ui/duel.ts`) guards first with its player-facing message, so this is
  // the function's own honesty for the next caller, not a path a child can reach today.
  it('an empty pool throws, chosen or not, instead of returning undefined typed as a Topic (#1750)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => duelTopic([], undefined, () => 0.5)).toThrow('duelTopic: nothing to draw from (empty pool)');
    expect(() => duelTopic([], 'y1-add', () => 0.5)).toThrow('duelTopic: nothing to draw from (empty pool)');
    expect(warn, 'the throw comes before the "picking one at random" warning, which would be a lie here').not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

/**
 * #1750: `duelScreen` throws `Ninja Duel: <year> has no bubble topic to duel on` when `duelPool()` comes back empty
 * — reachable only if a registry change strips a shown year of every plain bubble topic at its gentlest stage.
 * This pins that invariant in the screen's own terms: the `shownYears()` rows the map can hand to a duel, at every
 * `y.diffs` entry (not only the `diffs[0]` it plays at). `duel.test.ts`'s `duelPool` block sweeps the wider
 * `YEARS × [1, 2, 3]`, hidden KS2 years included, so a registry change goes red there too; this is the named
 * #1750 rail, kept beside the throw it makes unreachable. Proved to bite by feeding one row `[]` in place of
 * `topicsFor(y.id)`: the row's line fails by name.
 */
describe('every shown year has a duel pool at every difficulty (#1750)', () => {
  it('duelPool(topicsFor(y.id), d) is non-empty for every shownYears() row and every y.diffs entry', () => {
    for (const y of shownYears()) expect(y.diffs.length, `${y.id} has stages, so the sweep below reaches it`).toBeGreaterThan(0);
    const rows = shownYears().flatMap(y => y.diffs.map(d => [y.id, d] as const));
    for (const [year, d] of rows) expect(duelPool(topicsFor(year), d).length, `${year} d${d}`).toBeGreaterThan(0);
  });
});
