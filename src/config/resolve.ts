// The catalogue resolver (#2194): what a year island, or a game played on one, actually gets. It reads the
// generated runtime copy (`catalogue.runtime.json`, written by `scripts/catalogue-slim.mjs`), never the full file,
// so `media` and `playability` stay out of the game bundle. Pure: no storage, no DOM. The user's own patch (#2199) is
// built by `patch.ts` and arrives here as the `patch` argument, applied last.
import type { YearId, YearInfo } from '../curriculum/types';
import { OVERRIDABLE_KEYS, type DefaultSettings, type GroupId, type Overridable, type RuntimeCatalogue, type YearSettings } from './catalogue';
import { activeCatalogue } from './active';
import runtime from './catalogue.runtime.json' with { type: 'json' };   // the attribute lets Playwright's Node loader import it (tests/e2e)

/** A year's full settings: every year key, plus the bubble timing it inherits from `defaults`. */
export type ResolvedSettings = YearSettings & DefaultSettings;
export interface ResolvedGame { readonly visible: boolean; readonly settings: ResolvedSettings }

/** The committed runtime catalogue. `tests/unit/resolve.test.ts` holds it equal to the slimmed full file. */
export const RUNTIME = runtime as unknown as RuntimeCatalogue;

/** The global bubble timing, `defaults.settings`: what `layoutWave` reads until per-game timing (item D, #2198). */
export const TIMING: DefaultSettings = RUNTIME.defaults.settings;

/** A timing table's value at `speed`; past speed 3, its last (fastest) entry, as `layoutWave`'s old fallback was. A table missing an entry for speeds 0–3 throws, so a short edit cannot play a wrong speed silently (#2217). */
export const bySpeed = (table: readonly number[], speed: number): number => {
  const v = table[speed];
  if (v !== undefined) return v;
  if (speed >= 0 && speed <= 3) throw new Error(`timing table has no entry for speed ${speed} (${table.length} entries)`);
  return table[table.length - 1];
};

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

/** A year's settings. Order, last wins: `defaults.settings`, then `years.<year>.settings`. `cat` defaults to the active profile's catalogue (#2231). */
export function resolveYear(year: YearId, cat: RuntimeCatalogue = activeCatalogue()): ResolvedSettings {
  if (!own(cat.years, year)) throw new Error(`catalogue: no year ${year}`);
  return { ...cat.defaults.settings, ...cat.years[year].settings };
}

/**
 * A game played on `year`. Settings, last wins: defaults; the year; `games.<id>.settings`; its `groupSettings`
 * for the year's group; its `years.<year>.settings`; then `patch` (item E). Every game level and the patch apply
 * their overridable keys only. `visible` is the game's own AND its year node's; a game with no node for `year`
 * is not on that island, so it is not visible there. Island visibility is item C1's (#2195), not this.
 */
export function resolveGame(id: string, year: YearId, patch?: Overridable, cat: RuntimeCatalogue = activeCatalogue()): ResolvedGame {
  if (!own(cat.games, id)) throw new Error(`catalogue: no game ${id}`);
  const game = cat.games[id];
  const node = game.years[year];
  const over: Overridable = Object.assign({}, ...[game.settings, game.groupSettings[groupOf(year, cat)], node?.settings, patch].map(overridable));
  return { visible: game.visible && !!node?.visible, settings: { ...resolveYear(year, cat), ...over } };
}

/**
 * `year` as one game on its own plays it (#2198): `perStage`, `lives`, `gentle`, `speeds` and `diffs` from
 * `resolveGame(id, year.id).settings`, and its `airTime`/`stagger` as `timing`. Only a single game played on its
 * own calls this; the mixed modes (Sensei, Legend, mixed, Daily, Duel) keep their mode table and the year's
 * settings. A topic the catalogue does not list plays as the year does.
 */
export function gameYear(year: YearInfo, id: string, cat: RuntimeCatalogue = activeCatalogue(), patch?: Overridable): YearInfo {
  if (!own(cat.games, id)) return year;
  const s = resolveGame(id, year.id, patch, cat).settings;
  return { ...year, perStage: s.perStage, lives: s.lives, gentle: s.gentle, speeds: [...s.speeds], diffs: [...s.diffs], timing: { airTime: s.airTime, stagger: s.stagger } };
}
