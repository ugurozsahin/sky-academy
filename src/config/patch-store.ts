// Where the patch lives (#2199): `sna:catalogue:<profile>` in localStorage, one small key per child profile, like
// `sna:mapline:<profile>` (device-settings.ts). A refused or corrupt store reads as no patch and never throws; each
// setter returns whether the store now holds what was asked, so the control paints the truth. This module is the
// whole write API (item F's screen calls it): the setters take a visibility or an overridable setting and have no
// parameter that could carry a `media` or `playability` value.
import type { ProfileId } from '../storage/profile-index';
import type { YearId } from '../curriculum/types';
import { OVERRIDABLE_KEYS, type Overridable } from './catalogue';
import { EMPTY_PATCH, sanitisePatch, type GamePatch, type Patch } from './patch';
import { RUNTIME } from './resolve';

const keyFor = (profile: ProfileId): string => `sna:catalogue:${profile}`;
const getItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };

/** The stored text, for callers that cache a parsed copy and need to know it changed. */
export const patchText = (profile: ProfileId): string | null => getItem(keyFor(profile));

/** Parses and sanitises stored text: anything unreadable is the empty patch. */
export function parsePatch(text: string | null): Patch {
  if (text === null) return EMPTY_PATCH;
  try { return sanitisePatch(JSON.parse(text), RUNTIME); } catch { return EMPTY_PATCH; }
}

export const readPatch = (profile: ProfileId): Patch => parsePatch(patchText(profile));

const isEmpty = (p: Patch): boolean => !p.years && !p.games;

/** Writes `next` (sanitised, so a bad value cannot get in) and reports whether the store now holds it. */
function commit(profile: ProfileId, next: Patch): boolean {
  const clean = sanitisePatch(next, RUNTIME), text = JSON.stringify(clean);
  try { if (isEmpty(clean)) localStorage.removeItem(keyFor(profile)); else localStorage.setItem(keyFor(profile), text); } catch { /* the read-back decides */ }
  return JSON.stringify(readPatch(profile)) === text || (isEmpty(clean) && patchText(profile) === null);
}

const clone = (p: Patch): Patch => JSON.parse(JSON.stringify(p));
const gameOf = (p: Patch, id: string): GamePatch => ((p.games ??= {})[id] ??= {});

/** `year` null is the game itself, a year id is the game on that island. An unknown id or a game with no node for `year` is refused. */
export function setGameVisible(profile: ProfileId, id: string, year: YearId | null, on: boolean): boolean {
  if (!Object.prototype.hasOwnProperty.call(RUNTIME.games, id) || (year !== null && !RUNTIME.games[id].years[year])) return false;
  const p = clone(readPatch(profile)), g = gameOf(p, id);
  if (year === null) g.visible = on; else ((g.years ??= {})[year] ??= {}).visible = on;
  return commit(profile, p);
}

export function setYearVisible(profile: ProfileId, year: YearId, visible: 'auto' | boolean): boolean {
  if (!RUNTIME.years[year] || !(visible === 'auto' || typeof visible === 'boolean')) return false;
  const p = clone(readPatch(profile));
  ((p.years ??= {})[year] ??= {}).visible = visible;
  return commit(profile, p);
}

/** `scope` null is the game's own setting, a year id is the game on that island. A key that is not an overridable setting, or a value out of bounds, is refused and nothing is stored. */
export function setGameSetting<K extends keyof Overridable>(profile: ProfileId, id: string, scope: YearId | null, key: K, value: Overridable[K]): boolean {
  if (!(OVERRIDABLE_KEYS as readonly string[]).includes(key) || !Object.prototype.hasOwnProperty.call(RUNTIME.games, id)) return false;
  if (scope !== null && !RUNTIME.games[id].years[scope]) return false;
  const p = clone(readPatch(profile)), g = gameOf(p, id), node = scope === null ? g : ((g.years ??= {})[scope] ??= {});
  node.settings = { ...node.settings, [key]: value };
  const stuck = JSON.stringify(sanitisePatch(p, RUNTIME)) === JSON.stringify(p);   // an out-of-bounds value was dropped by the sanitiser: say so
  return stuck && commit(profile, p);
}

/** Back to the committed catalogue. Returns whether the key is gone. */
export function resetCatalogue(profile: ProfileId): boolean { return removePatch(profile); }

/** Removes the key: a deleted profile, or a slot handed to a new child. Returns whether it is gone. */
export function removePatch(profile: ProfileId): boolean {
  try { localStorage.removeItem(keyFor(profile)); } catch { /* the read-back decides */ }
  return patchText(profile) === null;
}
