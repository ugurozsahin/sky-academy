import { describe, expect, it } from 'vitest';
import { RUNTIME } from '../../src/config/resolve';
import { TOPICS, YEARS, type YearId } from '../../src/curriculum';
import { gameOn, type Visibility } from '../../src/curriculum/catalogue-shown';
import { gameRefusal, gamesOn, islandRefusal, islandsShown, withGame, withIsland } from '../../src/curriculum/catalogue-guards';

// #2200, the owner's rule on the issue: the grown-ups' settings never leave the map with no island, and never switch
// off a year's last game. Prove it red: make `islandRefusal` return null (the last-island cases fail); drop the
// `gamesOn(...).length === 1` line (the last-game case fails); drop the `t.drill` check (the drill case fails).
const core = (y: YearId) => TOPICS.filter(t => t.year === y && !t.drill);
const onlyIsland = (keep: YearId): Visibility => YEARS.filter(y => y.id !== keep).reduce<Visibility>((c, y) => withIsland(c, y.id, false), RUNTIME);
const onlyGame = (year: YearId, keep: string, cat: Visibility = RUNTIME): Visibility =>
  core(year).filter(t => t.id !== keep).reduce((c, t) => withGame(c, t.id, year, false), cat);

describe('the committed catalogue refuses nothing', () => {
  it('shows every island, and no island or game control is held', () => {
    expect(islandsShown(RUNTIME, TOPICS)).toEqual(YEARS.map(y => y.id));
    for (const y of YEARS) {
      for (const v of ['auto', true, false] as const) expect(islandRefusal(RUNTIME, y.id, v, TOPICS)).toBeNull();
      for (const t of TOPICS.filter(x => x.year === y.id)) expect(gameRefusal(RUNTIME, t.id, y.id, TOPICS)).toBeNull();
    }
  });
});

describe('the last island', () => {
  it.each(YEARS.map(y => y.id))('%s alone on the map cannot be hidden; Automatic and Show stay open', (y) => {
    const cat = onlyIsland(y);
    expect(islandsShown(cat, TOPICS)).toEqual([y]);
    expect(islandRefusal(cat, y, false, TOPICS)).toBe('last-island');
    expect(islandRefusal(cat, y, true, TOPICS)).toBeNull();
    expect(islandRefusal(cat, y, 'auto', TOPICS)).toBeNull();
  });
  it('a second island shown lifts the refusal', () => {
    expect(islandRefusal(withIsland(onlyIsland('year1'), 'year2', true), 'year1', false, TOPICS)).toBeNull();
  });
});

describe('a year\'s last game', () => {
  it.each(YEARS.map(y => y.id))('%s: the one game left on cannot be switched off; the ones off can be switched on', (y) => {
    const keep = core(y)[0].id, cat = onlyGame(y, keep);
    expect(gamesOn(cat, y, TOPICS).map(t => t.id)).toEqual([keep]);
    expect(gameRefusal(cat, keep, y, TOPICS)).toBe('last-game');
    for (const t of core(y).slice(1)) expect(gameRefusal(cat, t.id, y, TOPICS)).toBeNull();
  });
  it('two games on: either may go', () => {
    const [a, b] = core('year1'), cat = withGame(onlyGame('year1', a.id), b.id, 'year1', true);
    expect(gameRefusal(cat, a.id, 'year1', TOPICS)).toBeNull();
    expect(gameRefusal(cat, b.id, 'year1', TOPICS)).toBeNull();
  });
  it('a drill never holds an island on the map, so it is never held on', () => {
    const drills = TOPICS.filter(t => t.drill);
    expect(drills.length).toBeGreaterThan(0);
    for (const d of drills) expect(gameRefusal(onlyGame(d.year, core(d.year)[0].id), d.id, d.year, TOPICS)).toBeNull();
  });
  it('the last game is held even on a hidden island, so Show always has something to show', () => {
    const keep = core('year2')[0].id, cat = withIsland(onlyGame('year2', keep), 'year2', false);
    expect(gameRefusal(cat, keep, 'year2', TOPICS)).toBe('last-game');
  });
});

describe('the copies the checks try changes on', () => {
  it('withGame switching on also turns the game itself on, and leaves the input alone', () => {
    const id = core('year1')[0].id, off: Visibility = { ...RUNTIME, games: { ...RUNTIME.games, [id]: { ...RUNTIME.games[id], visible: false } } };
    expect(gameOn(off, id, 'year1')).toBe(false);
    expect(gameOn(withGame(off, id, 'year1', true), id, 'year1')).toBe(true);
    expect(off.games[id].visible).toBe(false);
  });
  it('an unknown game is no change and no refusal', () => {
    expect(withGame(RUNTIME, 'nope', 'year1', false)).toBe(RUNTIME);
    expect(gameRefusal(RUNTIME, 'nope', 'year1', TOPICS)).toBeNull();
  });
});
