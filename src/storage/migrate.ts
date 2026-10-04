// Bringing a stored blob up to the current shape: the migration ladder, the version rules and the front-door sanitiser.
import type { DojoState } from '../game/dojo';
import { sanitizeV5Fields, toV5, toV6 } from '../save-records';
import { isCert, isDuel } from './album-checks';
import { cleanName } from './name';
import { DEFAULT, SAVE_VERSION, type RawSave, type SaveData } from './shape';
/**
 * Whether a stored blob counts as having been through onboarding — **the one home of that rule** (#380
 * review B3, note 1). `MIGRATIONS[2]` derives the field when a v2 blob reaches the ladder, and `profileCard`
 * derives it for a sibling's slot the ladder never runs on; they have to answer the same thing about the
 * same bytes, and a rail comparing two copies of the expression could only ever compare their spelling.
 *
 * `typeof s.avatar === 'string'` is part of the rule, not a belt: a hand-edited `{ avatar: 7 }` is truthy
 * and is not a ninja anybody chose, and the two sites had already drifted apart on exactly that blob.
 */
export const onboardedOf = (s: RawSave): boolean =>
  typeof s.onboarded === 'boolean' ? s.onboarded : typeof s.avatar === 'string' && !!s.avatar;
// Each step upgrades a v(n) blob to v(n+1): it drops the old keys and writes the new ones, instead of leaning
// on load()'s merge, which silently keeps stale keys across a reshape. Exported for the rail in
// guardrails.test.ts that holds every version below SAVE_VERSION to having a step — a bump with no step walks
// straight past the `while` below and lands back on the merge this seam exists to replace.
export const MIGRATIONS: Record<number, (s: RawSave) => RawSave> = {
  // v1 → v2: **one step, two features.** #65 (the TTS verdict) and #205 (the certificate album) each took the
  // save to v2 in parallel branches; they are one shape change from the app's point of view, so they are one
  // step rather than a version each — a ladder that counted features would say who shipped when instead of
  // what the save looks like. The two keys are treated differently on purpose and both are deliberate:
  // `voice` is *preserved when valid* (an e2e seed, or a save restored from a newer device, carries a real
  // verdict worth keeping) and otherwise normalised, so the key never holds a verdict the detector could not
  // have written; `certs` is *filtered*, because its job is to drop anything that is not an album entry.
  1: s => ({
    ...s,
    voice: s.voice === 'yes' || s.voice === 'no' ? s.voice : 'unknown',
    certs: Array.isArray(s.certs) ? s.certs.filter(isCert) : [],
  }),
  // v2 → v3: #67's onboarding wizard needs a flag to tell "never onboarded" from "already played". A blob
  // that already has an avatar chosen was onboarded under the old single-screen flow, so it counts as done —
  // the acceptance criterion is that no existing player is sent back through the wizard by this update.
  2: s => ({
    ...s,
    onboarded: onboardedOf(s),      // the rule itself lives by `profileCard`, which has to give the same answer
  }),
  // v3 → v4: #16's duel history. `duels` is *filtered* rather than normalised, for the same reason `certs` is
  // in the v1 → v2 step above: its job is to drop anything that is not a match record, and a save written
  // before this step has no honest duel history to preserve — the matches those children played were never
  // stored, so an empty list is the truthful answer rather than a loss.
  3: s => ({
    ...s,
    duels: Array.isArray(s.duels) ? s.duels.filter(isDuel) : [],
  }),
  // v4 → v5: #903's save-format ticket, ahead of the seven register features that build on it. The step body
  // (toV5, save-records.ts) is additive: `slips`/`log`/`settings` default and are filtered, and `streak`/
  // `progress` keep their existing shape and only gain the optional extras those seven tickets will read.
  4: toV5,
  // v5 → v6: #1054's one KS2 save change — `ks2` and `settings.timeX`, additive (toV6, save-records.ts).
  5: toV6,
};

/**
 * Bring a raw stored blob up to the current SaveData shape. Drives off `raw.v`, not the key name, so a shape
 * change gets a real migration step rather than load() papering over it. Tolerant of hand-edited / corrupt data:
 * a non-object, or JSON that is not a save, falls back to a fresh default.
 */
/** A version we cannot migrate from: not a number we wrote, so the ladder has no honest starting rung (#232). */
export const UNREADABLE_VERSION = 0;
/** The shape version a raw blob is in. A blob with **no** `v` predates versioning but shares the v1 shape, so it
 *  walks every migration from 1 — reading it as *current* would skip them all and hand a reshaping step stale keys.
 *  A `v` that is *present* but not a whole number ≥ 1 (`"2"`, `null`, `{}`, `1.5`, `-3`) is a different case and
 *  used to land on 1 as well: that re-ran the whole ladder over data that had already been migrated, which is
 *  harmless for an additive step and silently destructive for a reshaping one (#232). It now reads as
 *  UNREADABLE_VERSION, which `migrate()` refuses rather than guesses at. */
export const saveVersionOf = (s: RawSave): number => {
  if (s.v === undefined) return 1;
  return typeof s.v === 'number' && Number.isInteger(s.v) && s.v >= 1 ? s.v : UNREADABLE_VERSION;
};
/**
 * Whether the ladder can bring this blob to the current shape: a readable version, at or below ours (#232).
 *
 * A blob from a **newer** build is the case this exists for. `migrate()` used to fall straight through the
 * `while` (`3 < 2` is false) to a return that stamps `v: SAVE_VERSION` over v3-shaped data; `load()` cached
 * that and the next `save()` wrote it back, so the newer save was permanently relabelled as the older shape,
 * with whatever the newer version added sitting unrecognised and whatever it *renamed* read under its old
 * name. `importSave()` has always refused this case for the same reason — migrations only run forwards —
 * and this is `load()`'s half of the same rule.
 */
export const isMigratable = (s: RawSave): boolean => {
  const v = saveVersionOf(s);
  return v !== UNREADABLE_VERSION && v <= SAVE_VERSION;
};
/**
 * A blob from a **newer** build specifically — readable version, above ours. This is the only case the
 * read-only latch protects, and the distinction is load-bearing (review of #232's first cut).
 *
 * Both this and an unreadable `v` are refused by `isMigratable`, because neither can be brought to our shape.
 * But *not writing* is a separate decision from *not reading*, and it is only justified here: a newer blob is
 * a real save that the child's other device can still open, so overwriting it destroys progress that exists.
 * An unreadable `v` is a shape **no build ever wrote**, so there is nothing on the other side to preserve —
 * latching it would brick saving on the device for good, with no route back (`reset()` has no caller in the
 * app and `?reset` cannot be typed into a Capacitor WebView), which is strictly worse than starting clean.
 */
export const isFutureSave = (s: RawSave): boolean => {
  const v = saveVersionOf(s);
  return v !== UNREADABLE_VERSION && v > SAVE_VERSION;
};
/**
 * Drop any field `migrate()` would otherwise carry through unchanged if it is the wrong *type* (#95 review):
 * a version-valid blob like `{ v: 1, streak: null }` or `{ v: 1, dojo: null }` used to reach the merge below
 * untouched, and then `topbar()`'s `d.streak.days`, `dojoCard()`'s `dojoFor(load().dojo, …)` (`s.date` on a
 * `null` `s`), and every `record*()` writer below (`load().progress[id]` etc.) threw the moment they read it —
 * not just the two call sites (`parentSummary()`, the map's star tally) the original fix touched. Deleting the
 * bad field here, rather than guarding each reader, means a *new* call site gets this for free: every reader
 * goes through `load()` → `migrate()`, so nothing downstream needs to know this hazard exists. The deleted key
 * is filled back in from `DEFAULT` by the `{ ...DEFAULT, ...s }` merge below, exactly as a missing key already is.
 */
function sanitizeTypes(s: RawSave): RawSave {
  const clean: RawSave = { ...s };
  const isRecord = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  for (const k of ['progress', 'endless', 'sprint', 'boss', 'memory', 'training', 'equipped', 'streak', 'dojo'] as const) {
    if (k in clean && !isRecord(clean[k])) delete clean[k];
  }
  // #363: `dojo` is the one key whose *interior* is read without a guard, and the guard above stops at the
  // record boundary. `dojoFor()` only rebuilds a state whose `date` is stale, so a record carrying TODAY's
  // date is handed to every reader untouched and throws on `s.streak.last`, `s.done` or `s.progress`.
  //
  // The FIRST reader is the map screen, not a game: `dojoCard()` (`ui/home.ts`) runs at boot and reads a
  // superset of what `applyEvent()` does, so the child's symptom is a blank map with nothing to start —
  // there is no save that survives boot and fails only at the end of a game. The end-of-game readers are
  // the worse landing when they are reached: in `duel.ts` the throw sits between `hold(true)` and
  // `overlay.hidden = false`, freezing both arenas with no result, and the coins just earned are never
  // written. Reachable without devtools: `importSave()` accepts any version-valid JSON, so a `dojo` of
  // `{ date: <today> }` pasted into the Restore box is enough.
  //
  // Deleting the key here puts it back through `DEFAULT`, the same route a missing key already takes, and
  // covers `dojoCard()`, every `applyEvent()` reader — `recordGameEnd()` on all three results screens since
  // #365, `recordDojo()` wherever it is next used — and every future one, which is what this
  // function's docstring above promises and what a `try/catch` per reader would not.
  if (isRecord(clean.dojo)) {
    const dj = clean.dojo as Partial<DojoState>;
    const streakOk = isRecord(dj.streak) && typeof dj.streak!.last === 'string' && typeof dj.streak!.days === 'number';
    if (typeof dj.date !== 'string' || !isRecord(dj.progress) || !Array.isArray(dj.done) || !streakOk || typeof dj.total !== 'number') delete clean.dojo;
  }
  // `certs`/`duels` join the same array check the other list fields get (#423 review item 4): each has its
  // own `Array.isArray` guard at its reader (`certificates()`, `duelHistory()`), which is why a wrong-typed
  // value here was never reachable — but every *other* array field is sanitized at this one front door
  // instead of trusting its own reader, and a non-array here reached `{...DEFAULT, ...s}` unfiltered until now.
  for (const k of ['stickers', 'owned', 'certs', 'duels'] as const) {
    if (k in clean && !Array.isArray(clean[k])) delete clean[k];
  }
  // #903 review: every v5 field's own front-door guard, present-only like the array check just above — see
  // save-records.ts's sanitizeV5Fields for why `toV5` alone was not enough.
  sanitizeV5Fields(clean);
  // #795: dropping a corrupted `spent` to 0 the way every other field falls back to DEFAULT would silently inflate the shop balance (`coins − spent`) — clamp it to (already-sanitized) `coins` instead, the worst-case assumption, and warn on both rejections so a corruption event leaves a trace.
  if ('coins' in clean && (typeof clean.coins !== 'number' || !Number.isFinite(clean.coins) || clean.coins < 0)) { console.warn(`sanitizeTypes: invalid coins (${JSON.stringify(clean.coins)}) — reset`); delete clean.coins; }
  if ('spent' in clean && (typeof clean.spent !== 'number' || !Number.isFinite(clean.spent) || clean.spent < 0)) { const cap = typeof clean.coins === 'number' && Number.isFinite(clean.coins) ? clean.coins : 0; console.warn(`sanitizeTypes: invalid spent (${JSON.stringify(clean.spent)}) — clamped to ${cap}`); clean.spent = cap; }
  // #171 review: the object/array/number branches above missed every primitive-typed field — `name` most of
  // all, since it is the one field a person freely types into the Restore box. `nameScreen()`'s `esc(d.name)`
  // (`dom.ts`) and `hasName(d.name)` (`.trim()`) both throw on a non-string, and `migrate({ v: 1, name: 123
  // })` used to hand that straight through: no branch here checked it, so a wrong-typed `name` is exactly as
  // reachable as the `progress`/`streak`/`dojo` cases above, on a screen every first-run wizard can reach.
  for (const k of ['name', 'year'] as const) {
    if (k in clean && typeof clean[k] !== 'string') delete clean[k];
  }
  // #424: a Restore code is a name a person freely typed, exactly like the wizard's field below, and the
  // `typeof` check above does not bound its length. Clamped here rather than left to `renameProfile` — a
  // name that never goes through a rename (the common case: Restore a code and just play) must not carry an
  // unbounded one into the store this check was meant to close.
  if (typeof clean.name === 'string') clean.name = cleanName(clean.name);
  if ('avatar' in clean && clean.avatar !== null && typeof clean.avatar !== 'string') delete clean.avatar;
  if ('voice' in clean && clean.voice !== 'unknown' && clean.voice !== 'yes' && clean.voice !== 'no') delete clean.voice;
  for (const k of ['sound', 'speech', 'tutorialSeen', 'onboarded'] as const) {
    if (k in clean && typeof clean[k] !== 'boolean') delete clean[k];
  }
  return clean;
}
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT };
  let s = sanitizeTypes(raw as RawSave);
  // Never stamp SAVE_VERSION over a version we could not read (#232). A fresh default is what this *session*
  // sees; keeping the stored blob intact is `save()`'s half, via the read-only latch below.
  if (!isMigratable(s)) return { ...DEFAULT };
  let v = saveVersionOf(s);
  while (v < SAVE_VERSION && MIGRATIONS[v]) { s = MIGRATIONS[v](s); v++; }
  return { ...DEFAULT, ...s, v: SAVE_VERSION };           // fill any missing keys and stamp the current version
}
