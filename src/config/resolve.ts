// The catalogue resolver (#2194): what a year island, or a game played on one, actually gets. It reads the
// generated runtime copy (`catalogue.runtime.json`, written by `scripts/catalogue-slim.mjs`), never the full file,
// so `media` and `playability` stay out of the game bundle. Pure: no storage, no DOM. The user's own patch is
// item E's (#2199); it arrives here as the `patch` argument.
import type { YearId } from '../curriculum/types';
import { OVERRIDABLE_KEYS, type DefaultSettings, type GroupId, type Overridable, type RuntimeCatalogue, type YearSettings } from './catalogue';
import runtime from './catalogue.runtime.json' with { type: 'json' };   // the attribute lets Playwright's Node loader import it (tests/e2e)

/** A year's full settings: every year key, plus the bubble timing it inherits from `defaults`. */
export type ResolvedSettings = YearSettings & DefaultSettings;
export interface ResolvedGame { readonly visible: boolean; readonly settings: ResolvedSettings }

/** The committed runtime catalogue. `tests/unit/resolve.test.ts` holds it equal to the slimmed full file. */
export const RUNTIME = runtime as unknown as RuntimeCatalogue;

/** The global bubble timing, `defaults.settings`: what `layoutWave` reads until per-game timing (item D, #2198). */
export const TIMING: DefaultSettings = RUNTIME.defaults.settings;

/** A timing table's value at `speed`; past the table, its last (fastest) entry, as `layoutWave`'s old fallback was. */
export const bySpeed = (table: readonly number[], speed: number): number => table[speed] ?? table[table.length - 1];

/** An own key only, so `constructor` is not a game. Not `Object.hasOwn`: older Android WebViews (Chrome < 93) lack it. */
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Only the overridable keys of `layer`, so a game level or a patch can never reach a year-only key. */
function overridable(layer: Overridable | undefined): Overridable {
  if (!layer) return {};
  return Object.fromEntries(OVERRIDABLE_KEYS.filter((k) => layer[k] !== undefined).map((k) => [k, layer[k]]));
}

function groupOf(year: YearId, cat: RuntimeCatalogue): GroupId {
  const g = (Object.keys(cat.groups) as GroupId[]).find((id) => cat.groups[id].includes(year));
  if (!g) throw new Error(`catalogue: year ${year} is in no group`);
  return g;
}

/** A year's settings. Order, last wins: `defaults.settings`, then `years.<year>.settings`. */
export function resolveYear(year: YearId, cat: RuntimeCatalogue = RUNTIME): ResolvedSettings {
  if (!own(cat.years, year)) throw new Error(`catalogue: no year ${year}`);
  return { ...cat.defaults.settings, ...cat.years[year].settings };
}

/**
 * A game played on `year`. Settings, last wins: defaults; the year; `games.<id>.settings`; its `groupSettings`
 * for the year's group; its `years.<year>.settings`; then `patch` (item E). Every game level and the patch apply
 * their overridable keys only. `visible` is the game's own AND its year node's; a game with no node for `year`
 * is not on that island, so it is not visible there. Island visibility is item C1's (#2195), not this.
 */
export function resolveGame(id: string, year: YearId, patch?: Overridable, cat: RuntimeCatalogue = RUNTIME): ResolvedGame {
  if (!own(cat.games, id)) throw new Error(`catalogue: no game ${id}`);
  const game = cat.games[id];
  const node = game.years[year];
  const over: Overridable = Object.assign({}, ...[game.settings, game.groupSettings[groupOf(year, cat)], node?.settings, patch].map(overridable));
  return { visible: game.visible && !!node?.visible, settings: { ...resolveYear(year, cat), ...over } };
}
