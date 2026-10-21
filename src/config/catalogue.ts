// The game catalogue (#2192, #2193): one file, `catalogue.json`, with a node for every game (topic) and every
// year island — visibility, settings, media and a read-only playability score. It was written once from today's
// code by `scripts/catalogue-init.mjs`; nothing in the game reads it yet (item B, #2194, makes it the source).
//
// This module sits below `src/curriculum/` so the curriculum can import it later without a cycle: its only
// import from there is type-only. The validator is hand-written (no dependency) and returns every error.
import type { Difficulty, YearId } from '../curriculum/types';
import raw from './catalogue.json';

export type GroupId = 'eyfs' | 'ks1' | 'lks2' | 'uks2';
export type Speed = 0 | 1 | 2 | 3;
/** One value per bubble speed 0..2; speed 3 is still `layoutWave`'s own fallback, outside the file. */
export type SpeedTable = readonly [number, number, number];

/** The keys a game, a group override or a single year may override (#2193). */
export interface Overridable {
  readonly perStage?: number;
  readonly lives?: number;
  readonly gentle?: boolean;
  readonly speeds?: readonly Speed[];
  readonly diffs?: readonly Difficulty[];
  readonly airTime?: SpeedTable;
  readonly stagger?: SpeedTable;
}
/** A year island's settings: today's `YEARS` values, every key present, plus the year-only guards and rewards. */
export interface YearSettings extends Overridable {
  readonly perStage: number;
  readonly lives: number;
  readonly gentle: boolean;
  readonly speeds: readonly Speed[];
  readonly diffs: readonly Difficulty[];
  readonly sprintStars: { readonly threeStar: number; readonly twoStar: number };
  readonly maxAnswer: number;
  readonly minAnswer: number;
}
export interface DefaultSettings { readonly airTime: SpeedTable; readonly stagger: SpeedTable }

/** A picture: `src` is relative to the site root. Further keys (`caption`, `kind`…) are allowed here only. */
export interface MediaEntry { readonly src: string; readonly alt: string; readonly [extra: string]: unknown }
export interface Media { readonly thumbnail: MediaEntry; readonly screenshots: readonly MediaEntry[] }
export type Playability = null | { readonly score: number; readonly by: string; readonly at: string; readonly report: string };

export interface YearNode { readonly visible: 'auto' | boolean; readonly settings: YearSettings; readonly media: Media; readonly playability: Playability }
export interface GameYearNode { readonly visible: boolean; readonly settings: Overridable; readonly playability: Playability }
export interface GameNode {
  readonly visible: boolean;
  readonly settings: Overridable;
  readonly groupSettings: { readonly [G in GroupId]?: Overridable };
  readonly years: { readonly [Y in YearId]?: GameYearNode };
  readonly media: Media;
  readonly playability: Playability;
}
export interface Catalogue {
  readonly version: 1;
  readonly groups: { readonly [G in GroupId]: readonly YearId[] };
  readonly defaults: { readonly settings: DefaultSettings };
  readonly years: { readonly [Y in YearId]: YearNode };
  readonly games: { readonly [id: string]: GameNode };
}

/** The committed file, typed. Not validated here: `tests/unit/catalogue.test.ts` holds it valid. */
export const CATALOGUE = raw as unknown as Catalogue;

// ---- Bounds: the values the code accepts today -------------------------------------------------------------
export const GROUP_IDS: readonly GroupId[] = ['eyfs', 'ks1', 'lks2', 'uks2'];
/** Stages per mission: the session runs `speeds.length` of them, and `STAGE_NAMES` names five. */
export const STAGES = 5;
/** `layoutWave` indexes the timing tables by speed 0..2 and falls back past them, so speed 3 is the fastest. */
const SPEED_SET = [0, 1, 2, 3], DIFF_SET = [1, 2, 3];
/** One mission-pill segment per question, so a stage stays short enough for the pill to draw. */
const PER_STAGE_MAX = 10, LIVES_MIN = 1, LIVES_MAX = 5;
export const OVERRIDABLE_KEYS = ['perStage', 'lives', 'gentle', 'speeds', 'diffs', 'airTime', 'stagger'] as const;
export const YEAR_ONLY_KEYS = ['sprintStars', 'maxAnswer', 'minAnswer'] as const;
const YEAR_KEYS: readonly string[] = ['perStage', 'lives', 'gentle', 'speeds', 'diffs', ...YEAR_ONLY_KEYS];
/** The global code constants: required in `defaults`, overridable everywhere else. */
const TIMING_KEYS: readonly string[] = ['airTime', 'stagger'];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SRC_TAIL = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.webp$/;
const REPORT = /^docs\/playability\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z]+$/;

type Obj = Record<string, unknown>;
type Check = (v: unknown) => string | null;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);
const stageList = (allowed: number[]): Check => (v) =>
  Array.isArray(v) && v.length === STAGES && v.every((x) => allowed.includes(x)) ? null : `must be ${STAGES} values, one per stage, each one of ${allowed.join(', ')}`;
const speedTable: Check = (v) =>
  Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0) ? null : 'must be 3 positive numbers, one per bubble speed 0 to 2';

const SETTING_RULES: Record<(typeof OVERRIDABLE_KEYS)[number], Check> = {
  perStage: (v) => (isInt(v, 1, PER_STAGE_MAX) ? null : `must be a whole number from 1 to ${PER_STAGE_MAX}`),
  lives: (v) => (isInt(v, LIVES_MIN, LIVES_MAX) ? null : `must be a whole number from ${LIVES_MIN} to ${LIVES_MAX}`),
  gentle: (v) => (typeof v === 'boolean' ? null : 'must be true or false'),
  speeds: stageList(SPEED_SET),
  diffs: stageList(DIFF_SET),
  airTime: speedTable,
  stagger: speedTable,
};
const PLAY_RULES: Record<string, Check> = {
  score: (v) => (isInt(v, 0, 10) ? null : 'must be a whole number from 0 to 10'),
  by: (v) => (typeof v === 'string' && ID.test(v) ? null : 'must be a profile id'),
  at: (v) => (isDate(v) ? null : 'must be a date, YYYY-MM-DD'),
  report: (v) => (typeof v === 'string' && REPORT.test(v) ? null : 'must be a file under docs/playability/'),
};

const at = (path: string, k: string | number) => (typeof k === 'number' ? `${path}[${k}]` : path ? `${path}.${k}` : k);

/** Reports each missing required key and each key that is neither required nor optional. */
function checkKeys(path: string, o: Obj, required: readonly string[], optional: readonly string[], errs: string[], unknown = (_k: string) => 'unknown key') {
  for (const k of required) if (!(k in o)) errs.push(`${at(path, k)}: missing`);
  for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) errs.push(`${at(path, k)}: ${unknown(k)}`);
}
const settingUnknown = (k: string) => ((YEAR_ONLY_KEYS as readonly string[]).includes(k) ? 'year-only, set it on the year island' : 'not a setting this level holds');

/** Runs `rules` over the keys of `o` that are present, so a missing key is reported once, by `checkKeys`. */
function runRules(path: string, o: Obj, rules: Record<string, Check>, errs: string[]) {
  for (const [k, rule] of Object.entries(rules)) {
    const e = k in o ? rule(o[k]) : null;
    if (e) errs.push(`${at(path, k)}: ${e}`);
  }
}

function checkObj(path: string, v: unknown, errs: string[], what = 'an object'): v is Obj {
  if (!isObj(v)) errs.push(`${path}: must be ${what}`);
  return isObj(v);
}

/** `required` and `optional` say which keys this level may hold; the bounds are the same at every level. */
function checkSettings(path: string, v: unknown, required: readonly string[], optional: readonly string[], errs: string[]) {
  if (!checkObj(path, v, errs)) return;
  checkKeys(path, v, required, optional, errs, settingUnknown);
  const allowed = [...required, ...optional];
  runRules(path, v, Object.fromEntries(Object.entries(SETTING_RULES).filter(([k]) => allowed.includes(k))), errs);
}

function checkYearSettings(path: string, v: unknown, errs: string[]) {
  checkSettings(path, v, YEAR_KEYS, TIMING_KEYS, errs);
  if (!isObj(v)) return;
  const stars = v.sprintStars;
  if (isObj(stars)) checkKeys(at(path, 'sprintStars'), stars, ['threeStar', 'twoStar'], [], errs);
  const two = isObj(stars) ? stars.twoStar : undefined, three = isObj(stars) ? stars.threeStar : undefined;
  if ('sprintStars' in v && !(isInt(two, 1, Infinity) && isInt(three, 1, Infinity) && (two as number) < (three as number)))
    errs.push(`${at(path, 'sprintStars')}: must be whole numbers with 1 <= twoStar < threeStar`);
  const { maxAnswer: max, minAnswer: min } = v;
  if ('maxAnswer' in v && !isInt(max, 1, Infinity)) errs.push(`${at(path, 'maxAnswer')}: must be a whole number above 0`);
  if ('minAnswer' in v && !(isInt(min, -Infinity, Infinity) && (!isInt(max, 1, Infinity) || (min as number) < (max as number))))
    errs.push(`${at(path, 'minAnswer')}: must be a whole number below maxAnswer`);
}

function checkEntry(path: string, v: unknown, prefix: string, seen: Set<string>, errs: string[]) {
  if (!checkObj(path, v, errs, '{ src, alt }')) return;
  const { src, alt } = v;
  if (typeof src !== 'string' || !src.startsWith(prefix) || !SRC_TAIL.test(src.slice(prefix.length)))
    errs.push(`${at(path, 'src')}: must be a .webp path under ${prefix}`);
  else if (seen.has(src)) errs.push(`${at(path, 'src')}: ${src} is used more than once`);
  else seen.add(src);
  if (typeof alt !== 'string' || !alt.trim()) errs.push(`${at(path, 'alt')}: must be some text`);
}

function checkMedia(path: string, v: unknown, prefix: string, seen: Set<string>, errs: string[]) {
  if (!checkObj(path, v, errs)) return;
  checkKeys(path, v, ['thumbnail', 'screenshots'], [], errs);
  if ('thumbnail' in v) checkEntry(at(path, 'thumbnail'), v.thumbnail, prefix, seen, errs);
  const shots = v.screenshots;
  if (!('screenshots' in v)) return;
  if (!Array.isArray(shots) || !shots.length) errs.push(`${at(path, 'screenshots')}: must be a list of at least one picture`);
  else shots.forEach((s, i) => checkEntry(at(at(path, 'screenshots'), i), s, prefix, seen, errs));
}

function checkPlayability(path: string, v: unknown, errs: string[]) {
  if (v === null || !checkObj(path, v, errs, 'null or { score, by, at, report }')) return;
  checkKeys(path, v, Object.keys(PLAY_RULES), [], errs);
  runRules(path, v, PLAY_RULES, errs);
}

/** Returns the year ids the groups name, each of which must be in exactly one group. */
function checkGroups(v: unknown, errs: string[]): Set<string> {
  const years = new Set<string>();
  if (!checkObj('groups', v, errs)) return years;
  checkKeys('groups', v, GROUP_IDS, [], errs);
  for (const [g, list] of Object.entries(v)) {
    if (!Array.isArray(list) || !list.length || !list.every((y) => typeof y === 'string')) { errs.push(`groups.${g}: must be a list of year ids`); continue; }
    for (const y of list) {
      if (years.has(y)) errs.push(`groups.${g}: ${y} is in more than one group`);
      years.add(y);
    }
  }
  return years;
}

function checkYear(path: string, id: string, v: unknown, seen: Set<string>, errs: string[]) {
  if (!checkObj(path, v, errs)) return;
  checkKeys(path, v, ['visible', 'settings', 'media', 'playability'], [], errs);
  if ('visible' in v && v.visible !== 'auto' && typeof v.visible !== 'boolean') errs.push(`${path}.visible: must be "auto", true or false`);
  if ('settings' in v) checkYearSettings(`${path}.settings`, v.settings, errs);
  if ('media' in v) checkMedia(`${path}.media`, v.media, `img/islands/${id}/`, seen, errs);
  if ('playability' in v) checkPlayability(`${path}.playability`, v.playability, errs);
}

/** A game's `years`: exactly one key, its code year, for now (#2193); more years is a later issue. */
function checkGameYears(path: string, v: unknown, known: Set<string>, errs: string[]) {
  if (!checkObj(path, v, errs)) return;
  const ids = Object.keys(v);
  if (ids.length !== 1) errs.push(`${path}: must name exactly one year`);
  for (const y of ids) {
    const node = v[y], p = at(path, y);
    if (!known.has(y)) errs.push(`${p}: not a year in groups`);
    if (!checkObj(p, node, errs)) continue;
    checkKeys(p, node, ['visible', 'settings', 'playability'], [], errs);
    if ('visible' in node && typeof node.visible !== 'boolean') errs.push(`${p}.visible: must be true or false`);
    if ('settings' in node) checkSettings(`${p}.settings`, node.settings, [], OVERRIDABLE_KEYS, errs);
    if ('playability' in node) checkPlayability(`${p}.playability`, node.playability, errs);
  }
}

function checkGroupSettings(path: string, v: unknown, errs: string[]) {
  if (!checkObj(path, v, errs)) return;
  for (const [g, s] of Object.entries(v)) {
    if ((GROUP_IDS as readonly string[]).includes(g)) checkSettings(at(path, g), s, [], OVERRIDABLE_KEYS, errs);
    else errs.push(`${at(path, g)}: not a group`);
  }
}

function checkGame(path: string, id: string, v: unknown, known: Set<string>, seen: Set<string>, errs: string[]) {
  if (!ID.test(id)) errs.push(`${path}: a game id is lower-case letters, digits and hyphens`);
  if (!checkObj(path, v, errs)) return;
  checkKeys(path, v, ['visible', 'settings', 'groupSettings', 'years', 'media', 'playability'], [], errs);
  if ('visible' in v && typeof v.visible !== 'boolean') errs.push(`${path}.visible: must be true or false`);
  if ('settings' in v) checkSettings(`${path}.settings`, v.settings, [], OVERRIDABLE_KEYS, errs);
  if ('groupSettings' in v) checkGroupSettings(`${path}.groupSettings`, v.groupSettings, errs);
  if ('years' in v) checkGameYears(`${path}.years`, v.years, known, errs);
  if ('media' in v) checkMedia(`${path}.media`, v.media, `img/games/${id}/`, seen, errs);
  if ('playability' in v) checkPlayability(`${path}.playability`, v.playability, errs);
}

/**
 * Every way `json` breaks the catalogue's shape or bounds, as `path: problem` lines; `[]` means valid. It does
 * not know the code's topic or year lists (that would import the curriculum at run time): the coverage rails in
 * `tests/unit/catalogue.test.ts` compare the file with `TOPICS` and `YEARS`.
 */
export function validateCatalogue(json: unknown): string[] {
  const errs: string[] = [];
  if (!checkObj('catalogue', json, errs)) return errs;
  checkKeys('', json, ['version', 'groups', 'defaults', 'years', 'games'], [], errs);
  if ('version' in json && json.version !== 1) errs.push('version: must be 1');
  // A missing top-level key is reported once, by `checkKeys`, so each block below runs only when its key is there.
  const known = 'groups' in json ? checkGroups(json.groups, errs) : new Set<string>(), seen = new Set<string>();
  const { defaults, years, games } = json;
  if ('defaults' in json && checkObj('defaults', defaults, errs)) {
    checkKeys('defaults', defaults, ['settings'], [], errs);
    if ('settings' in defaults) checkSettings('defaults.settings', defaults.settings, TIMING_KEYS, [], errs);
  }
  if ('years' in json && checkObj('years', years, errs)) {
    checkKeys('years', years, [...known], [], errs);
    for (const [id, node] of Object.entries(years)) checkYear(`years.${id}`, id, node, seen, errs);
  }
  if ('games' in json && checkObj('games', games, errs))
    for (const [id, node] of Object.entries(games)) checkGame(`games.${id}`, id, node, known, seen, errs);
  return errs;
}
