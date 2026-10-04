// New v5 save fields (#903) — kept out of storage.ts, which is at its #714 ratchet cap. Also holds the
// field-check infrastructure storage.ts's own CERT_FIELDS/DUEL_FIELDS used to define locally (`Fields`,
// `checkFields`, `str`, `fin`, `strOrNull`, `count`), moved here for the same reason and imported back.
import { YEARS, type YearId } from './curriculum/types';
export type Fields<T> = { [K in keyof T]-?: (v: unknown) => v is T[K] };
export const checkFields = <T>(fields: Fields<T>, x: Record<string, unknown>): boolean =>
  (Object.keys(fields) as (keyof T)[]).every(k => fields[k](x[k as string]));
export const str = (v: unknown): v is string => typeof v === 'string';
export const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const strOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
export const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = (v: unknown): v is string => typeof v === 'string' && ISO_DAY.test(v);
const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The cap #903's Proposed fix asks for on every free-text field these records store — "cut every stored
 * string to at most 200 characters, as `cleanName` (`storage.ts`, #424) bounds a name" — because the Restore
 * box accepts any version-valid paste and `str`/`isoDay` above check type only, never length. Unlike
 * `cleanName`, these fields are never shown to a person (no reader exists yet, #903's own scope), so a plain
 * code-unit `.slice` is enough: there is no rendered cluster to protect from splitting mid-character.
 */
const MAX_FIELD_LEN = 200;
const clampStr = (s: string): string => s.slice(0, MAX_FIELD_LEN);

/**
 * Round 2 review: a topics array has no cap of its own — 50,000 topic strings survived `sanitizeLog`
 * with every one individually clamped to `MAX_FIELD_LEN`, so the array's own length was the unbounded
 * dimension left open. A day cannot really hold more distinct topics than the curriculum has, so this is
 * generous headroom, not a tight fit to today's registry size.
 */
const MAX_TOPICS_PER_DAY = 50;

/**
 * Round 4 review: `progress` is keyed by topic id, and nothing capped how many keys a Restore paste could
 * carry (5,000 synthetic ids all survived) or how long any one of them could be (a 50,000-character id
 * survived too). The registry holds 87 topics today and the KS2 programme in the backlog will add more, so
 * this is the same generous-headroom sizing `MAX_TOPICS_PER_DAY` uses, not a tight fit.
 */
const MAX_PROGRESS_ENTRIES = 500;

/** One wrong answer logged for the parent view (#938 is the reader; #903 adds only the format). */
export interface Slip { topic: string; prompt: string; answer: string; picked: string; at: string }
const SLIP_FIELDS: Fields<Slip> = { topic: str, prompt: str, answer: str, picked: str, at: isoDay };
const isSlip = (v: unknown): v is Slip => isRecord(v) && checkFields(SLIP_FIELDS, v);
/**
 * Trusts the stored order (newest first, #903's table) rather than re-sorting by `at` — unlike `sanitizeLog`
 * below, which dedupes and re-sorts because a log day is keyed by date and a slip is not. #938, the eventual
 * writer, is what has to keep that order true on every write; this only drops what cannot be a slip at all,
 * clamps its four free-text fields to `MAX_FIELD_LEN`, and caps what is left to the most recent 20.
 * Round 2 review: rebuilds the object from the five known fields rather than spreading the input, matching
 * `sanitizeSettings` below — a spread re-admits any extra key a Restore paste carries, unbounded, since
 * `isSlip` only checks the fields it knows about and never rejects an object for having more.
 */
export const sanitizeSlips = (v: unknown): Slip[] =>
  (Array.isArray(v) ? v.filter(isSlip) : [])
    .slice(0, 20)
    .map(s => ({ topic: clampStr(s.topic), prompt: clampStr(s.prompt), answer: clampStr(s.answer), picked: clampStr(s.picked), at: s.at }));

/** One day's play, for the parent view (#939 is the reader; #903 adds only the format). */
export interface LogDay { date: string; games: number; q: number; ok: number; topics: string[] }
const LOG_FIELDS: Fields<LogDay> = { date: isoDay, games: count, q: count, ok: count, topics: strArr };
const isLogDay = (v: unknown): v is LogDay => isRecord(v) && checkFields(LOG_FIELDS, v);
/**
 * Stored oldest first, one entry per date — a repeated date keeps the entry that comes later in the input,
 * matching a day that was logged and then re-logged rather than two separate days — kept to the 30 most
 * recent dates (#903's table), each topic clamped to `MAX_FIELD_LEN` and the topics array itself capped to
 * `MAX_TOPICS_PER_DAY`. Round 2 review: rebuilds the object from the five known fields rather than spreading
 * the input, matching `sanitizeSettings` below — the same unknown-key gap `sanitizeSlips` above closes the
 * same way.
 */
export function sanitizeLog(v: unknown): LogDay[] {
  if (!Array.isArray(v)) return [];
  const byDate = new Map<string, LogDay>();
  for (const entry of v) if (isLogDay(entry)) byDate.set(entry.date, entry);
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-30)
    .map(d => ({
      date: d.date,
      games: d.games,
      q: d.q,
      ok: d.ok,
      topics: d.topics.slice(0, MAX_TOPICS_PER_DAY).map(clampStr),
    }));
}

/**
 * Add one finished game to the day log (#939): today's entry is created or bumped in place, `topics` gains any
 * new ids, and the 30 most recent days are kept (`sanitizeLog` sorts and caps). A game with no questions
 * (Memory Match: pairs and moves are not questions) passes `q: 0, ok: 0` and adds the game alone.
 */
export function logGame(log: readonly LogDay[], date: string, g: { q: number; ok: number; topics?: readonly string[] }): LogDay[] {
  const n = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0), q = n(g.q), ok = Math.min(q, n(g.ok));   // a bad count must not make `sanitizeLog` drop the whole day
  const day = log.find(d => d.date === date) ?? { date, games: 0, q: 0, ok: 0, topics: [] };
  const topics = [...day.topics, ...(g.topics ?? []).filter(t => !day.topics.includes(t))];
  return sanitizeLog([...log.filter(d => d.date !== date), { date, games: day.games + 1, q: day.q + q, ok: day.ok + ok, topics }]);
}

/** Device-wide play settings kept in the save rather than `sna:three` (#940 keeps that one separate). */
export interface Settings { slow: boolean; timeX: 1 | 1.5 | 0 }   // timeX (#1054): time allowance, 0 = no time limit
export const DEFAULT_SETTINGS: Settings = { slow: false, timeX: 1 };
export const sanitizeSettings = (v: unknown): Settings => {
  const r = isRecord(v) ? v : {};
  return { slow: typeof r.slow === 'boolean' ? r.slow : false, timeX: r.timeX === 1.5 || r.timeX === 0 ? r.timeX : 1 };
};

/**
 * Drops `rest` unless it is a stored day (#950 reads it as the Daily Dojo's rest-day marker).
 * Round 3 review: rebuilds from `streak`'s two known fields (`last`, `days`, left as whatever type they
 * already were — this function has never validated them, only `rest`) rather than spreading the input, the
 * same unknown-key gap round 2 closed for `sanitizeSlips`/`sanitizeLog`/`sanitizeSettings` but left open here
 * and in `sanitizeProgressExtras` below.
 */
export function sanitizeStreakRest(streak: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = { last: streak.last, days: streak.days };
  if (isoDay(streak.rest)) clean.rest = streak.rest;
  return clean;
}

/**
 * Drops each of the three progress extras unless it is the shape its own future ticket needs (#903's table):
 * `last` (#936), `sprint` (#911), `crown` (#932). Round 3 review: rebuilds each entry from `TopicProgress`'s
 * known fields rather than spreading `v` — `stars`/`best`/`plays`/`hits`/`tries` pass through unvalidated, as
 * before (this function has never type-checked them), but an unrelated key can no longer ride along unbounded.
 * Round 4 review, three more gaps in the same threat model: `out` was a plain object literal, so a `progress`
 * entry keyed `__proto__` (a real own string key once `JSON.parse` has made it one, as `importSave()` does)
 * silently reassigned `out`'s own prototype instead of becoming an entry — closed structurally by building
 * `out` with `Object.create(null)`, so no key spelling can ever reach a prototype; a non-record `v` used to
 * pass through verbatim instead of being dropped like every sibling malformed shape in this file, now just
 * dropped; and the key itself (`id`) had no length or count cap, unlike every value field this file clamps —
 * now an over-length id is dropped and the map stops accepting entries past `MAX_PROGRESS_ENTRIES`.
 */
export function sanitizeProgressExtras(progress: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  let n = 0;
  for (const [id, v] of Object.entries(progress)) {
    if (n >= MAX_PROGRESS_ENTRIES) break;
    if (id.length > MAX_FIELD_LEN || !isRecord(v)) continue;
    const entry: Record<string, unknown> = { stars: v.stars, best: v.best, plays: v.plays };
    if ('hits' in v) entry.hits = v.hits;
    if ('tries' in v) entry.tries = v.tries;
    if (isoDay(v.last)) entry.last = v.last;
    if (fin(v.sprint) && (v.sprint as number) >= 0) entry.sprint = v.sprint;
    if (v.crown === true) entry.crown = true;
    out[id] = entry;
    n++;
  }
  return out;
}

/**
 * Every v5 field's own guard, run unconditionally by storage.ts's `sanitizeTypes()` on every load (#903
 * review) — `toV5` below only ever runs on the one-time v4 → v5 hop, so without this a save already at v5,
 * the ordinary and permanent state once a device has migrated once, carried a hand-edited or Restore-pasted
 * slips/log/settings/streak.rest/progress extra straight through unsanitized: the exact gap `sanitizeTypes`'s
 * own #363/#795/#171 comments each closed for `dojo`/`spent`/`name`. Present-only, like `sanitizeTypes`'s
 * other checks: a genuinely *missing* key still defaults through the caller's own `{ ...DEFAULT, ...s }`
 * merge, so this only ever touches a key that already exists. Mutates `clean` in place, matching every other
 * check in that function.
 */
export function sanitizeV5Fields(clean: Record<string, unknown>): void {
  if ('slips' in clean) clean.slips = sanitizeSlips(clean.slips);
  if ('log' in clean) clean.log = sanitizeLog(clean.log);
  if ('settings' in clean) clean.settings = sanitizeSettings(clean.settings);
  if ('ks2' in clean) clean.ks2 = sanitizeKs2(clean.ks2);   // #1054
  if (isRecord(clean.streak)) clean.streak = sanitizeStreakRest(clean.streak as Record<string, unknown>);
  if (isRecord(clean.progress)) clean.progress = sanitizeProgressExtras(clean.progress as Record<string, unknown>);
}

/**
 * v4 → v5 (#903): every agreed new field in one additive step, so parallel feature branches stop colliding on
 * `SAVE_VERSION`. `slips`/`log`/`settings` are new top-level keys; `streak`/`progress` already exist and keep
 * their shape, only gaining the optional extras above. Nothing existing is reshaped — and by the time this
 * step runs, `sanitizeV5Fields` above has already cleaned a present-but-malformed field of any version, so
 * this step's own job is only to fill in the three keys a pre-v5 blob never had at all.
 */
export function toV5(s: Record<string, unknown>): Record<string, unknown> {
  // A missing streak/progress must stay missing here too, so the { ...DEFAULT, ...s } merge in migrate() still
  // fills it in — setting either to `undefined` explicitly (rather than omitting the key) would instead
  // override that default with a real `streak: undefined` property, which is what sanitizeTypes already
  // deletes a wrong-typed streak/progress down to.
  const out: Record<string, unknown> = { ...s, slips: sanitizeSlips(s.slips), log: sanitizeLog(s.log), settings: sanitizeSettings(s.settings) };
  if (isRecord(s.streak)) out.streak = sanitizeStreakRest(s.streak as Record<string, unknown>);
  if (isRecord(s.progress)) out.progress = sanitizeProgressExtras(s.progress);
  return out;
}

/**
 * The KS2 save fields (#1054), every one under a single `ks2` key so parallel KS2 tickets never collide on
 * `SAVE_VERSION`. This adds no readers and no writers: each owning ticket adds its own.
 * `save(patch)` replaces whole top-level keys, so a writer must pass the whole object —
 * `{ ks2: { ...d.ks2, bestSpeed } }`, never `{ ks2: { bestSpeed } }`.
 */
export interface Ks2Fact { right: number; wrong: number; slow: number; last?: string; day?: string; locked?: true }
export interface Ks2Check { date: string; score: number; missed: string[] }
export interface Ks2Save {
  schoolYear?: YearId; facts: Record<string, Ks2Fact>; checks: Ks2Check[]; words: Record<string, string>;
  bestSpeed?: number; checkDate?: string;
}
export const DEFAULT_KS2: Ks2Save = { facts: {}, checks: [], words: {} };
const FACT_KEY = /^(\d{1,2})×(\d{1,2})$/;
const isFactKey = (k: unknown): k is string => {
  const m = typeof k === 'string' ? FACT_KEY.exec(k) : null;
  return !!m && +m[1] >= 2 && +m[1] <= 12 && +m[2] >= 2 && +m[2] <= 12;
};
const MAX_CHECKS = 10, MAX_MISSED = 25, MAX_WORDS = 200;
function sanitizeFacts(v: unknown): Record<string, Ks2Fact> {
  const out: Record<string, Ks2Fact> = Object.create(null);
  if (!isRecord(v)) return out;
  for (const [k, f] of Object.entries(v)) {
    if (!isFactKey(k) || !isRecord(f) || !count(f.right) || !count(f.wrong) || !count(f.slow)) continue;
    const e: Ks2Fact = { right: f.right, wrong: f.wrong, slow: f.slow };
    if (typeof f.last === 'string' && /^[rsw]{0,3}$/.test(f.last)) e.last = f.last;
    if (isoDay(f.day)) e.day = f.day;
    if (f.locked === true) e.locked = true;
    out[k] = e;
  }
  return out;
}
function sanitizeChecks(v: unknown): Ks2Check[] {
  if (!Array.isArray(v)) return [];
  const out: Ks2Check[] = [];
  for (const c of v) {
    if (out.length >= MAX_CHECKS) break;
    if (!isRecord(c) || !isoDay(c.date) || !count(c.score) || c.score > 25) continue;
    out.push({ date: c.date, score: c.score, missed: (Array.isArray(c.missed) ? c.missed : []).filter(isFactKey).slice(0, MAX_MISSED) });
  }
  return out;
}
function sanitizeWords(v: unknown): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (!isRecord(v)) return out;
  let n = 0;
  for (const [w, r] of Object.entries(v)) {
    if (n >= MAX_WORDS) break;
    if (/^[A-Za-z]{1,20}$/.test(w) && typeof r === 'string' && /^[rw]{1,3}$/.test(r)) { out[w] = r; n++; }
  }
  return out;
}
/** Filters `ks2` through its guards, filling each missing sub-field with its default; runs on every load. */
export function sanitizeKs2(v: unknown): Ks2Save {
  const r = isRecord(v) ? v : {};
  const out: Ks2Save = { facts: sanitizeFacts(r.facts), checks: sanitizeChecks(r.checks), words: sanitizeWords(r.words) };
  if (typeof r.schoolYear === 'string' && YEARS.some(y => y.id === r.schoolYear)) out.schoolYear = r.schoolYear as YearId;
  if (fin(r.bestSpeed) && r.bestSpeed > 0 && r.bestSpeed <= 60) out.bestSpeed = r.bestSpeed;
  if (isoDay(r.checkDate)) out.checkDate = r.checkDate;
  return out;
}
/** v5 → v6 (#1054): additive — `ks2` is filtered, `settings.timeX` defaults; nothing is reshaped. */
export const toV6 = (s: Record<string, unknown>): Record<string, unknown> =>
  ({ ...s, ks2: sanitizeKs2(s.ks2), settings: sanitizeSettings(s.settings) });
