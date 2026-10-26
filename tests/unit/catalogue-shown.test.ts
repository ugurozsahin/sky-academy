import { describe, expect, it } from 'vitest';
import { YEARS, type YearId } from '../../src/curriculum';
import { gameOn } from '../../src/curriculum/catalogue-shown';
import { RUNTIME, resolveGame } from '../../src/config/resolve';
import type { RuntimeCatalogue } from '../../src/config/catalogue';

// #2222: "is this game on for this year?" is written twice, `gameOn` (the Pages deploy, #2203) and
// `resolveGame(...).visible` (the game, #2194). They must agree, or the site shows a game the app hides.
//
// Prove it red: change `gameOn` or `resolveGame`'s `visible` so that one of them ignores the year node.

const IDS = Object.keys(RUNTIME.games);
const YEAR_IDS = YEARS.map((y) => y.id as YearId);

/** A copy of the runtime catalogue with `hiddenGame` off everywhere and `hiddenYearGame` off for `hiddenYear` only. */
function mutated(hiddenGame: string, hiddenYearGame: string, hiddenYear: YearId): RuntimeCatalogue {
  const cat = structuredClone(RUNTIME) as { games: Record<string, { visible: boolean; years: Partial<Record<YearId, { visible: boolean }>> }> };
  cat.games[hiddenGame].visible = false;
  const node = cat.games[hiddenYearGame].years[hiddenYear];
  if (node) node.visible = false;
  return cat as unknown as RuntimeCatalogue;
}

const gamesWithYears = IDS.filter((id) => Object.keys(RUNTIME.games[id].years).length > 0);
const a = gamesWithYears[0], b = gamesWithYears[1];
const bYear = Object.keys(RUNTIME.games[b].years)[0] as YearId;

describe('gameOn equals resolveGame().visible (#2222)', () => {
  it('the catalogue has games to compare', () => expect(gamesWithYears.length).toBeGreaterThan(1));

  it.each(IDS)('%s agrees in every year on the committed runtime copy', (id) => {
    for (const y of YEAR_IDS) expect(gameOn(RUNTIME, id, y), `${id} ${y}`).toBe(resolveGame(id, y, undefined, RUNTIME).visible);
  });

  it('agrees on a copy that hides one game globally and another for one year', () => {
    const cat = mutated(a, b, bYear);
    for (const id of IDS) for (const y of YEAR_IDS) expect(gameOn(cat, id, y), `${id} ${y}`).toBe(resolveGame(id, y, undefined, cat).visible);
    expect(YEAR_IDS.some((y) => gameOn(cat, a, y))).toBe(false);
    expect(gameOn(cat, b, bYear)).toBe(false);
    expect(gameOn(RUNTIME, b, bYear)).toBe(true);
  });
});
