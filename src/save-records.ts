// New v5 save fields (#903) — kept out of storage.ts, which is at its #714 ratchet cap. Also holds the
// field-check infrastructure storage.ts's own CERT_FIELDS/DUEL_FIELDS used to define locally (`Fields`,
// `checkFields`, `str`, `fin`, `strOrNull`, `count`), moved here for the same reason and imported back.
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

/** Device-wide play settings kept in the save rather than `sna:three` (#940 keeps that one separate). */
export interface Settings { slow: boolean }
export const DEFAULT_SETTINGS: Settings = { slow: false };
export const sanitizeSettings = (v: unknown): Settings =>
  isRecord(v) && typeof v.slow === 'boolean' ? { slow: v.slow } : { ...DEFAULT_SETTINGS };

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
 */
export function sanitizeProgressExtras(progress: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, v] of Object.entries(progress)) {
    if (!isRecord(v)) { out[id] = v; continue; }
    const entry: Record<string, unknown> = { stars: v.stars, best: v.best, plays: v.plays };
    if ('hits' in v) entry.hits = v.hits;
    if ('tries' in v) entry.tries = v.tries;
    if (isoDay(v.last)) entry.last = v.last;
    if (fin(v.sprint) && (v.sprint as number) >= 0) entry.sprint = v.sprint;
    if (v.crown === true) entry.crown = true;
    out[id] = entry;
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
