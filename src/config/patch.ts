// A grown-up's own changes to the catalogue (#2199): a small patch over `catalogue.json`, applied last. Pure: no
// storage, no DOM (`patch-store.ts` keeps it on the device). A patch may change visibility and the overridable
// gameplay settings and nothing else, so `media`, `playability`, year-only guards and unknown ids have no place to
// live in it: `sanitisePatch` drops them one by one on every read.
import type { YearId } from '../curriculum/types';
import { OVERRIDABLE_KEYS, SETTING_RULES, type Overridable, type RuntimeCatalogue } from './catalogue';

export interface YearPatch { visible?: 'auto' | boolean; settings?: Overridable }
export interface GameYearPatch { visible?: boolean; settings?: Overridable }
export interface GamePatch { visible?: boolean; settings?: Overridable; years?: { [Y in YearId]?: GameYearPatch } }
export interface Patch { version: 1; years?: { [Y in YearId]?: YearPatch }; games?: { [id: string]: GamePatch } }

export const EMPTY_PATCH: Patch = { version: 1 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** The overridable keys of `v` whose values pass the item A bounds; the rest are dropped, one by one. */
function cleanSettings(v: unknown): Overridable | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of OVERRIDABLE_KEYS) if (own(v, k) && SETTING_RULES[k](v[k]) === null) out[k] = v[k];
  return Object.keys(out).length ? (out as Overridable) : undefined;
}

/** Keeps only `visible` (when `ok` accepts it) and `settings`; `undefined` when nothing is left. */
function cleanNode(v: unknown, ok: (x: unknown) => boolean): { visible?: never; settings?: Overridable } | undefined {
  if (!isObj(v)) return undefined;
  const out: Obj = {};
  if (own(v, 'visible') && ok(v.visible)) out.visible = v.visible;
  const settings = cleanSettings(v.settings);
  if (settings) out.settings = settings;
  return Object.keys(out).length ? out : undefined;
}

const isBool = (x: unknown) => typeof x === 'boolean';
const isIsland = (x: unknown) => x === 'auto' || typeof x === 'boolean';

/**
 * Any stored value as a valid patch. Drops every unknown game or year id, out-of-bounds value, year-only key and
 * `media`/`playability` key; a game's year the catalogue gives it no node for; and anything that is not a version 1
 * object. A corrupt value reads as an empty patch.
 */
export function sanitisePatch(raw: unknown, cat: RuntimeCatalogue): Patch {
  if (!isObj(raw) || raw.version !== 1) return { version: 1 };
  const out: Patch = { version: 1 }, years = sanitiseYears(raw.years, cat), games = sanitiseGames(raw.games, cat);
  if (years) out.years = years;
  if (games) out.games = games;
  return out;
}

/** The known year ids of `src` (an object or not) whose node survives `cleanNode`; `undefined` when none do. */
function pickYears(src: unknown, ids: string[], ok: (x: unknown) => boolean): Obj | undefined {
  if (!isObj(src)) return undefined;
  const out: Obj = {};
  for (const y of ids) { const n = own(src, y) ? cleanNode(src[y], ok) : undefined; if (n) out[y] = n; }
  return Object.keys(out).length ? out : undefined;
}

const sanitiseYears = (v: unknown, cat: RuntimeCatalogue) => pickYears(v, Object.keys(cat.years), isIsland) as Patch['years'];

function sanitiseGames(v: unknown, cat: RuntimeCatalogue): Patch['games'] {
  if (!isObj(v)) return undefined;
  const games: Obj = {};
  for (const id of Object.keys(v)) {
    if (!own(cat.games, id) || !isObj(v[id])) continue;
    const g = v[id] as Obj, node: Obj = cleanNode(g, isBool) ?? {}, years = pickYears(g.years, Object.keys(cat.games[id].years), isBool);
    if (years) node.years = years;
    if (Object.keys(node).length) games[id] = node;
  }
  return Object.keys(games).length ? (games as Patch['games']) : undefined;
}

/** `cat` with the patch's visibility and year settings laid over it: the whole catalogue `activeCatalogue()` hands out. */
export function applyPatch(cat: RuntimeCatalogue, patch: Patch): RuntimeCatalogue {
  const years = Object.fromEntries(Object.entries(cat.years).map(([y, node]) => {
    const p = patch.years?.[y as YearId];
    return [y, p ? { visible: p.visible ?? node.visible, settings: { ...node.settings, ...p.settings } } : node];
  })) as unknown as RuntimeCatalogue['years'];
  const games = Object.fromEntries(Object.entries(cat.games).map(([id, node]) => {
    const p = patch.games?.[id];
    if (!p) return [id, node];
    const gy = Object.fromEntries(Object.entries(node.years).map(([y, yn]) => [y, { ...yn, visible: p.years?.[y as YearId]?.visible ?? yn!.visible }]));
    return [id, { ...node, visible: p.visible ?? node.visible, years: gy }];
  })) as unknown as RuntimeCatalogue['games'];
  return { ...cat, years, games };
}

/** A game's settings from the patch for `year`, the game level first and the game-on-this-year level over it: `resolveGame`'s last layer. */
export function gameOverrides(patch: Patch, id: string, year: YearId): Overridable {
  const g = patch.games?.[id];
  return { ...g?.settings, ...g?.years?.[year]?.settings };
}
