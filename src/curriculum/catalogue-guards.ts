// What the grown-ups' "Years and games" controls may not do (#2200, the owner's rule on the issue): leave the map
// with no island, or switch off a year's last game. Pure, like `catalogue-shown.ts`: the catalogue and the topic
// list are arguments, and each check tries the change on a copy and asks `islandShown`, the one rule, what is left.
import { gameOn, islandShown, type GateTopic, type Visibility } from './catalogue-shown';
import type { YearId } from './types';

/** An island's three choices: `"auto"` is the topic-count gate, `true` Show, `false` Hide. Derived, so it follows `Visibility`. */
export type IslandChoice = NonNullable<Visibility['years'][YearId]>['visible'];
/** Why a control is disabled: the map would be left with no island, or the year with no game. */
export type Refusal = 'last-island' | 'last-game';

/** `cat` with island `year` set to `v`. */
export function withIsland(cat: Visibility, year: YearId, v: IslandChoice): Visibility {
  return { ...cat, years: { ...cat.years, [year]: { ...cat.years[year], visible: v } } };
}

/** `cat` with game `id` switched `on` for `year`; switching on also turns on the game itself, as `onGame` does. */
export function withGame(cat: Visibility, id: string, year: YearId, on: boolean): Visibility {
  const g = cat.games[id];
  if (!g) return cat;
  return { ...cat, games: { ...cat.games, [id]: { ...g, visible: on ? true : g.visible, years: { ...g.years, [year]: { ...g.years[year], visible: on } } } } };
}

/** The islands `cat` shows, in its own order. */
export const islandsShown = (cat: Visibility, topics: readonly GateTopic[]): YearId[] =>
  (Object.keys(cat.years) as YearId[]).filter(y => islandShown(cat, y, topics));

/** `year`'s non-drill games that are switched on: the ones that keep its island on the map. */
export const gamesOn = (cat: Visibility, year: YearId, topics: readonly GateTopic[]): GateTopic[] =>
  topics.filter(t => t.year === year && !t.drill && gameOn(cat, t.id, year));

/** Setting island `year` to `v` would leave no island on the map. */
export function islandRefusal(cat: Visibility, year: YearId, v: IslandChoice, topics: readonly GateTopic[]): Refusal | null {
  return islandsShown(withIsland(cat, year, v), topics).length === 0 ? 'last-island' : null;
}

/** Switching game `id` off on `year` would leave the year with no game on, or the map with no island. Drills never count. */
export function gameRefusal(cat: Visibility, id: string, year: YearId, topics: readonly GateTopic[]): Refusal | null {
  const t = topics.find(x => x.id === id);
  if (!t || t.drill || !gameOn(cat, id, year)) return null;
  if (gamesOn(cat, year, topics).length === 1) return 'last-game';
  return islandsShown(withGame(cat, id, year, false), topics).length === 0 ? 'last-island' : null;
}
