// Persistent player state (localStorage). Small, versioned, safe on failure.
import { applyEvent, dojoFor, freshDojo, type DojoEvent, type DojoOutcome, type DojoState } from './game/dojo';
import { balance, buy, equip, type ItemKind, type Wallet } from './game/shop';
import { TOPICS, YEARS, type YearId } from './curriculum';
import { AVATARS, VILLAIN } from './avatars';
export interface TopicProgress { stars: number; best: number; plays: number; hits?: number; tries?: number }   // hits/tries = lifetime slices (missions + Sensei training)
/**
 * One earned certificate, kept as **data rather than a PNG** (#205): `certFromStored()` in `ui/certificate.ts`
 * turns it back into the `CertInfo` that `drawCertificate()` draws, so a stored certificate costs a few dozen
 * bytes instead of ~300 KB of base64 in localStorage, and it redraws in whatever the certificate looks like
 * today. Before this, a certificate existed only for as long as the results overlay was open: a child on a
 * device where no save route works (the Android WebView — the bug this issue opened with) had no way back to it.
 */
export interface StoredCert {
  id: string;             // the mission it was earned for: `<year id>:<topic id>`, or `<year id>:sensei` for training
  name: string;           // the child's name at the time — the certificate says who it was awarded to
  avatar: string | null;  // avatar id, resolved through avatarById() when redrawn, so a missing one still draws
  year: string;           // year *title* as it appears on the certificate ("Year 1"); the id lives in `id`
  title: string;          // mission title ("Number bonds"), or "Sensei training"
  stars: number; score: number; correct: number; attempts: number;
  date: string;           // ISO day (yyyy-mm-dd), drawn as the award date
  training?: boolean;
}
export interface SaveData {
  v: 3;
  name: string;
  avatar: string | null;
  year: YearId;
  sound: boolean;
  speech: boolean;
  voice: 'unknown' | 'yes' | 'no';   // last observed TTS result; probed again on the next launch (#65)
  progress: Record<string, TopicProgress>;
  endless: Record<string, number>;   // year -> best score
  sprint: Record<string, number>;    // year -> best Ninja Sprint score
  boss: Record<string, number>;      // year -> Hammer Man knock-outs
  memory: Record<string, number>;    // year -> Memory Match boards completed
  training: Record<string, number>;  // year -> Sensei training sessions completed
  coins: number;                     // ninja coins earned (lifetime)
  stickers: string[];                // unlocked sticker ids
  streak: { last: string; days: number };   // daily play streak (ISO date)
  tutorialSeen: boolean;             // the "slice the bubble" demo hand has done its job
  dojo: DojoState;                   // Daily Dojo challenges (progress resets each day)
  spent: number;                     // coins spent in the shop (#6) — balance = coins − spent, stickers still unlock from lifetime coins
  owned: string[];                   // bought shop item ids
  equipped: Partial<Record<ItemKind, string>>;   // equipped item per kind (missing = the free default)
  certs: StoredCert[];               // certificates earned, most recently filed first (#205)
  onboarded: boolean;                // the first-run wizard (#67) has been completed or skipped past
}
export const SAVE_VERSION = 3 as const;   // bump when the stored shape changes; add the step to MIGRATIONS below
const KEY = 'sna:v1';                       // stable localStorage slot (its `v1` is historical; `raw.v` drives migration)
const DEFAULT: SaveData = { v: SAVE_VERSION, name: '', avatar: null, year: 'reception', sound: true, speech: true, voice: 'unknown', progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {}, coins: 0, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''), spent: 0, owned: [], equipped: {}, certs: [], onboarded: false };

/* ─── Profiles: siblings on one device (#20 slice 1 — storage only, no UI) ──────────────────────────────────
 *
 * One save per profile, plus a tiny index saying which profiles exist and which is active. `load()` and
 * `save()` keep their signatures and act on the **active** profile, so no caller in the game changes.
 *
 * **Profile 1 keeps `sna:v1` — nothing is copied and nothing is dropped.** The issue sketched a migration
 * that writes the existing save to a new key, verifies the read-back, then removes the old one; not moving it
 * at all reaches the same end ("the existing save becomes profile 1, losing nothing") with no crash window to
 * order correctly and no quota failure that could strand a child between two keys. It also keeps `sna:v1`
 * meaning what it already means everywhere outside this file — `tests/e2e/viewport.spec.ts`'s seed,
 * `scripts/flow-*.mjs`'s screenshot flows, and four unit suites all address it by name. The cost is one
 * asymmetric key, which `saveKeyFor` states in a line.
 */
export type ProfileId = 'p1' | 'p2' | 'p3' | 'p4';
/** The four fixed slots — the owner's cap (in session, 2026-09-19). Fixed rather than generated so a corrupt
 *  index can be rebuilt by *probing* the store (four `getItem`s) instead of enumerating it — `localStorage`
 *  enumeration is the one part of the API the Capacitor WebView and the test shim do not agree on.
 *  `as const satisfies` rather than a `: readonly ProfileId[]` annotation, which widens the tuple and takes
 *  `length` back to `number` (#330 review N2). */
export const PROFILE_IDS = ['p1', 'p2', 'p3', 'p4'] as const satisfies readonly ProfileId[];
/** Derived, never declared: `addProfile` caps by running out of slots, so a hand-written number here was a
 *  second truth that could disagree with the first — set it to 3 and the module hands out a fourth slot and
 *  then refuses the index it just wrote (#330 review N2). */
export const MAX_PROFILES = PROFILE_IDS.length;
const INDEX_KEY = 'sna:profiles';
/** Profile 1 is the save that is already on the device; the rest hang off the same slot name. */
export const saveKeyFor = (id: ProfileId) => (id === 'p1' ? KEY : `${KEY}:${id}`);
export interface ProfileIndex { v: 1; active: ProfileId; ids: ProfileId[] }

const isProfileId = (x: unknown): x is ProfileId => PROFILE_IDS.includes(x as ProfileId);
const readItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
/** The stored index, or null when there is none, it is not ours, or it is not self-consistent. Deliberately
 *  strict: `ids` must be distinct known slots, within the cap, and must contain `active`. */
function readIndex(): ProfileIndex | null {
  const raw = readItem(INDEX_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { v, active, ids } = parsed as { v?: unknown; active?: unknown; ids?: unknown };
  // `v` drives something or it is not worth storing — the #38 incident this repository still keeps a rail for
  // ("the save had a version field and a versioned key but neither drove anything"). An index from a build
  // that put more on it — slice 2 wants per-profile names and avatars there — must not be relabelled v1 and
  // then stripped of those fields by the next `setActiveProfile` spread. Refusing routes it to the safe
  // `defaultIndex` probe instead (#330 review N1).
  if (v !== 1) return null;
  // No explicit `ids.length > MAX_PROFILES` clause: the two checks on the next line already bound it, because
  // distinct members of a four-member union cannot number more than four. It was here as a belt, and a belt no
  // input can ever reach is a line no test can hold — the #330 review found it green under deletion, and it
  // is green under deletion for the same reason a comment cannot be tested (#330 review, item 1 and N2).
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (!ids.every(isProfileId) || new Set(ids).size !== ids.length) return null;
  if (!isProfileId(active) || !ids.includes(active)) return null;
  return { v: 1, active, ids: ids as ProfileId[] };
}
/**
 * What the store says when the index is missing or unreadable: **profile 1, active**, plus any other slot that
 * actually holds a save. A corrupt index must not present a child with a blank game — their save is still
 * under its own key — and it must not orphan a sibling's either, which is why this probes rather than
 * returning `['p1']` flat. Nothing is written here on purpose: a blob we merely failed to parse is not
 * overwritten until a real profile action (`setActiveProfile`, `addProfile`) asks for one.
 */
function defaultIndex(): ProfileIndex {
  const ids = PROFILE_IDS.filter(id => id === 'p1' || holdsSave(id));
  return { v: 1, active: 'p1', ids };
}
/** Whether a slot holds something this module could have written. A bare `!== null` counted any foreign blob
 *  under our key — `sna:v1:p3 = 'garbage'` invented a phantom profile that loaded as `DEFAULT` and consumed
 *  one of the four slots for good (#330 review, 02:36Z). Shape only, like `migrate()`'s own front door. */
function holdsSave(id: ProfileId): boolean {
  const raw = readItem(saveKeyFor(id));
  if (!raw) return false;
  try { const parsed: unknown = JSON.parse(raw); return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed); }
  catch { return false; }
}
const currentIndex = (): ProfileIndex => readIndex() ?? defaultIndex();
/**
 * Persist an index. False when the store did not keep it, and then nothing about the profiles has changed.
 *
 * It **reads the key back** rather than trusting that `setItem` returned: a store that throws is only half of
 * "the write did not land". A store that accepts the call and keeps nothing — the shape the issue's own
 * migration sketch guarded against with "verify it reads back" — used to return true here, so `addProfile()`
 * reported a new profile that the next `currentIndex()` knew nothing about: the new child onboarded straight
 * over their sibling's save, in the sibling's slot, and neither child had a game left (#330 review, 02:36Z).
 */
function writeIndex(next: ProfileIndex): boolean {
  const blob = JSON.stringify(next);
  try { localStorage.setItem(INDEX_KEY, blob); } catch { return false; }
  return readItem(INDEX_KEY) === blob;
}
/** The profiles on this device, in slot order. One profile is the normal case and costs no stored key. */
export const profileIds = (): ProfileId[] => currentIndex().ids;
/** Whose game `load()` and `save()` are reading and writing. */
export const activeProfile = (): ProfileId => currentIndex().active;
/**
 * The profile **this session is playing as** — resolved once, from the index, when the save is first read.
 *
 * It is deliberately not `activeProfile()` re-asked per call. `cache`, `readOnly` and `writeFailed` are
 * session state; the index is shared, and two tabs on one origin share `localStorage` while keeping separate
 * module state. Re-resolving meant a switch in one tab redirected the other tab's next write: one ordinary
 * `save()` wrote the child who was playing into their sibling's key, and `reset()` deleted the sibling's save
 * instead of theirs — no throw, no latch, nothing for the grown-ups screen to report (#330 review, 02:36Z).
 *
 * A tab that keeps playing keeps writing to its own child's slot, which is what a child still holding the
 * device means; an in-page switch goes through `setActiveProfile`/`addProfile`, which clear this so the next
 * read resolves afresh. So `activeProfile()` (the store's answer, and what slice 2's picker draws) and this
 * (the session's) can disagree in a second tab, and that disagreement is the point rather than a gap.
 */
function sessionProfile(): ProfileId { return cacheProfile ?? (cacheProfile = activeProfile()); }
/** Forget the cached save, the profile it belongs to, and both write latches — they describe the profile we
 *  are leaving, not the one we are joining (#232's read-only latch and #151's failed-write flag are each
 *  about one blob). */
function dropSessionState() { cache = null; cacheProfile = null; readOnly = false; writeFailed = false; }
/**
 * Switch the active profile. False — and nothing changes — when `id` is not one of this device's profiles, or
 * when the index could not be written: a switch the store refuses would put the child back on their sibling's
 * game at the next launch, and on a store that refuses this write the new profile could not be saved either.
 * The caller says so rather than the session pretending (the `buyItem`/`equipItem` rule, #151).
 */
export function setActiveProfile(id: ProfileId): boolean {
  const idx = currentIndex();
  if (!idx.ids.includes(id) || !writeIndex({ ...idx, active: id })) return false;
  dropSessionState();
  return true;
}
/**
 * Add a profile and make it active, returning its id — or null when the device is at `MAX_PROFILES` or the
 * index could not be written. The new profile starts on `DEFAULT`, so the caller runs the normal onboarding.
 */
export function addProfile(): ProfileId | null {
  const idx = currentIndex();
  const free = PROFILE_IDS.find(id => !idx.ids.includes(id));
  if (!free || !writeIndex({ v: 1, active: free, ids: [...idx.ids, free] })) return null;
  dropSessionState();
  return free;
}

// A raw blob read back from storage: JSON of unknown shape (any past version, or hand-edited). Migrations walk it.
type RawSave = Record<string, unknown>;
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
    onboarded: typeof s.onboarded === 'boolean' ? s.onboarded : !!s.avatar,
  }),
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
  for (const k of ['stickers', 'owned'] as const) {
    if (k in clean && !Array.isArray(clean[k])) delete clean[k];
  }
  for (const k of ['coins', 'spent'] as const) {
    if (k in clean && typeof clean[k] !== 'number') delete clean[k];
  }
  // #171 review: the object/array/number branches above missed every primitive-typed field — `name` most of
  // all, since it is the one field a person freely types into the Restore box. `nameScreen()`'s `esc(d.name)`
  // (`dom.ts`) and `hasName(d.name)` (`.trim()`) both throw on a non-string, and `migrate({ v: 1, name: 123
  // })` used to hand that straight through: no branch here checked it, so a wrong-typed `name` is exactly as
  // reachable as the `progress`/`streak`/`dojo` cases above, on a screen every first-run wizard can reach.
  for (const k of ['name', 'year'] as const) {
    if (k in clean && typeof clean[k] !== 'string') delete clean[k];
  }
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

let cache: SaveData | null = null;
/** Which profile `cache`, `readOnly` and `writeFailed` are about — see `sessionProfile()`. */
let cacheProfile: ProfileId | null = null;
/**
 * Set when `load()` read a blob from a **newer build** (#232). While it is set the session runs on defaults
 * and `save()` writes nothing, so the stored blob survives: a child whose tablet is on a newer build keeps
 * their progress even after the phone has opened the save. Refusing *and resetting* would have been two
 * lines, but it throws away a save the other device still reads.
 *
 * Deliberately **not** set for an unreadable `v` — see `isFutureSave` for why that case resets instead.
 * Every read of the save while this is set is reporting state that is not the child's: `exportSave()` has to
 * know that (it moves the stored blob instead), and the dashboard eventually should too (issue 266).
 */
let readOnly = false;
/**
 * Whether this session is running on defaults over a stored save it refused to touch (#232).
 *
 * Exported because the refusal is otherwise **silent**: the child plays, nothing persists, and nothing says so.
 * That is the right trade for a newer save — the alternative destroys a save their other device still reads —
 * but it is a state a grown-up should eventually be told about, and this is the hook a "your progress is not
 * being saved" notice would read. That notice is #232's own related item and is not built here.
 */
export const isReadOnlySave = () => readOnly;
/**
 * Set by `save()` when its own `localStorage.setItem` just threw — private browsing, a WebView with DOM
 * storage disabled, or a full quota (#151). Distinct from `isReadOnlySave()`: that one refuses to write
 * *deliberately*, to protect a newer save already on disk, and its remedy is "update this device"; this one
 * is the browser refusing an ordinary write, and its remedy is "this browser will not let the game save".
 * Conflating them would send a grown-up to update an app that already writes fine, or wait for a device
 * update that will never fix a private-browsing tab.
 *
 * Reflects only the *last* attempted write, the same way `readOnly` reflects only the last `load()` — a caller
 * that wants to know whether *this* save landed checks it immediately after calling `save()`, before anything
 * else can write again.
 */
let writeFailed = false;
export const isWriteFailing = () => writeFailed;
export function load(): SaveData {
  const id = sessionProfile();
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(saveKeyFor(id));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Only a *newer* blob is protected. An unreadable `v` is still refused as data (migrate returns the
    // default) but writes resume, so the next save() replaces the corrupt blob and the device recovers.
    readOnly = !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && isFutureSave(parsed as RawSave);
    cache = raw ? migrate(parsed) : { ...DEFAULT };
  }
  catch { readOnly = false; cache = { ...DEFAULT }; }
  return cache!;
}
export function save(patch: Partial<SaveData> = {}): SaveData {
  cache = { ...load(), ...patch };
  // #232: the blob on disk is newer than this build, or carries a version we cannot read. The session keeps
  // working against `cache`; writing would relabel it as our shape and make the loss permanent. Not an
  // attempted write, so it does not touch `writeFailed` either way (#151) — that flag is only ever set by an
  // actual `setItem` call, immediately below.
  if (readOnly) return cache;
  try { localStorage.setItem(saveKeyFor(sessionProfile()), JSON.stringify(cache)); writeFailed = false; }
  catch { writeFailed = true; /* private mode, WebView storage disabled, full quota (#151) */ }
  return cache;
}
export function recordTopic(topicId: string, stars: number, score: number) {
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  const next = { stars: Math.max(p.stars, stars), best: Math.max(p.best, score), plays: p.plays + 1 };
  save({ progress: { ...load().progress, [topicId]: next } });
}
/** Add answered questions to a topic's lifetime tally (Sensei picks the weakest topics from these). */
export function recordAccuracy(topicId: string, hits: number, tries: number) {
  if (tries <= 0) return;
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  save({ progress: { ...load().progress, [topicId]: { ...p, hits: (p.hits ?? 0) + hits, tries: (p.tries ?? 0) + tries } } });
}
/** Count a completed Sensei training session for this year. Returns the new total. */
export function recordTraining(year: string): number {
  const t = load().training; const n = (t[year] ?? 0) + 1;
  save({ training: { ...t, [year]: n } }); return n;
}
export function recordEndless(year: string, score: number) {
  const e = load().endless; if ((e[year] ?? 0) < score) save({ endless: { ...e, [year]: score } });
}
/** Ninja Sprint best per year. Returns true when `score` is a new personal best (a score of 0 never is). */
export function recordSprint(year: string, score: number): boolean {
  const s = load().sprint; if (score <= 0 || (s[year] ?? 0) >= score) return false;
  save({ sprint: { ...s, [year]: score } }); return true;
}
/** Count a Boss Battle knock-out for this year. Returns the new total. */
export function recordBossWin(year: string): number {
  const b = load().boss; const n = (b[year] ?? 0) + 1;
  save({ boss: { ...b, [year]: n } }); return n;
}
/** Count a completed Memory Match board for this year. Returns the new total. */
export function recordMemory(year: string): number {
  const m = load().memory; const n = (m[year] ?? 0) + 1;
  save({ memory: { ...m, [year]: n } }); return n;
}
/** Sticker album (#114). Order = avatars then the villain. The first three stay a fast, purely-coin win —
 * a four- or five-year-old needs a visible result in the first session or two. The other eight unlock from
 * achievements instead of more coins, because coins are a pure volume metric: a child could replay one easy
 * topic and empty the album without ever touching a second topic, a boss, or a harder year. */
// Derived from the roster (#113), not a hand-maintained parallel list: a roster rename or reorder used to
// need editing this array too, and nothing caught it if you forgot — the villain always resolves as the
// fallback for any id that has drifted out of step, so a forgotten edit here rendered a child's earned
// sticker as Hammer Man under "New sticker!" instead of failing loudly.
export const STICKER_IDS = [...AVATARS.map(a => a.id), VILLAIN.id];
export const STICKER_COST = [30, 70, 120];
export function stickersFor(coins: number): string[] {
  return STICKER_IDS.slice(0, STICKER_COST.length).filter((_, i) => coins >= STICKER_COST[i]);
}
/** A field that should be a plain `Record<string, …>`, tolerant of a hand-edited or corrupted save (#270
 * review): `importSave()` only checks `v`, so a blob like `{ v: 2, boss: null }` reaches here untouched, and
 * `Object.values()` on that throws. Every coin award now runs every achievement check, so a corruption in any
 * one field used to break only the mode that read it and now broke coin-earning app-wide; this reads as empty
 * instead, matching `wallet()`'s existing tolerance for the same class of blob.
 *
 * Exported for #95: `d.progress` is read the same unguarded way outside this file — `home.ts`'s star tally and
 * topic list, `avatar.ts`'s `masterProgress()`, `game/parents.ts`'s `parentSummary()` — and `d.progress[id]`
 * throws the moment `d.progress` itself is not an object, which a hand-edited or corrupted "Restore" paste can
 * produce (`{ v: 1, progress: null }` passes `importSave()`'s version check and is written straight through).
 * `#270` chose *accept the import, make every reader tolerant* over rejecting the blob at the door — this is
 * that same fix reaching the readers #270 did not touch. */
export const safeRecord = <T>(x: unknown): Record<string, T> => (x && typeof x === 'object' && !Array.isArray(x)) ? x as Record<string, T> : {};
const topicsStarred = (d: SaveData) => Object.values(safeRecord<TopicProgress>(d.progress)).filter(p => (p?.stars ?? 0) > 0).length;
const islandsWithAStar = (d: SaveData) => { const p = safeRecord<TopicProgress>(d.progress); return YEARS.filter(y => TOPICS.some(t => t.year === y.id && (p[t.id]?.stars ?? 0) > 0)).length; };
const islandFullyStarred = (d: SaveData) => {
  const p = safeRecord<TopicProgress>(d.progress);
  return YEARS.some(y => { const ts = TOPICS.filter(t => t.year === y.id); return ts.length > 0 && ts.every(t => (p[t.id]?.stars ?? 0) > 0); });
};
const sumOf = (x: unknown) => Object.values(safeRecord<number>(x)).reduce((n: number, v) => n + (typeof v === 'number' ? v : 0), 0);
const totalBossWins = (d: SaveData) => sumOf(d.boss);
const totalMemoryBoards = (d: SaveData) => sumOf(d.memory);
const bestSprintAnyYear = (d: SaveData) => Object.values(safeRecord<number>(d.sprint)).reduce((best: number, v) => Math.max(best, typeof v === 'number' ? v : 0), 0);
export const TOPICS_STARRED_GOAL = 5;
export const SPRINT_STICKER_SCORE = 150;   // roughly a 3-star sprint (12+ correct) once the combo bonus is in
/** One achievement per non-coin sticker. `progress` is pure over the save, for the rewards screen's hint text
 * and progress bar; the sticker is earned once `done >= goal`. */
export interface Achievement { id: string; title: string; progress: (d: SaveData) => { done: number; goal: number } }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'terra', title: `Star ${TOPICS_STARRED_GOAL} topics`, progress: d => ({ done: Math.min(topicsStarred(d), TOPICS_STARRED_GOAL), goal: TOPICS_STARRED_GOAL }) },
  { id: 'gust', title: 'Star a topic on every island', progress: d => ({ done: islandsWithAStar(d), goal: YEARS.length }) },
  { id: 'frost', title: '3-day streak', progress: d => ({ done: Math.min(d.streak.days, 3), goal: 3 }) },
  { id: 'sol', title: '7-day streak', progress: d => ({ done: Math.min(d.streak.days, 7), goal: 7 }) },
  { id: 'shadow', title: 'Beat Hammer Man once', progress: d => ({ done: Math.min(totalBossWins(d), 1), goal: 1 }) },
  { id: 'kai', title: 'Finish a Memory Match board', progress: d => ({ done: Math.min(totalMemoryBoards(d), 1), goal: 1 }) },
  { id: 'bolt', title: `Score ${SPRINT_STICKER_SCORE}+ in Ninja Sprint`, progress: d => ({ done: Math.min(bestSprintAnyYear(d), SPRINT_STICKER_SCORE), goal: SPRINT_STICKER_SCORE }) },
  { id: 'hammer', title: 'Star every topic on one island', progress: d => ({ done: islandFullyStarred(d) ? 1 : 0, goal: 1 }) },
];
/** Every sticker the save currently qualifies for, coins and achievements together. A sticker already in
 * `d.stickers` is never dropped even when the stat behind it later falls (a streak resets to zero) — this
 * only ever adds ids on top of what is already recorded, which is what "nothing is ever taken away" means
 * for a save that earned stickers under an earlier version of this rule (#114). */
export function evaluateStickers(d: SaveData): string[] {
  const earned = new Set(d.stickers);
  stickersFor(d.coins).forEach(id => earned.add(id));
  for (const a of ACHIEVEMENTS) if (a.progress(d).done >= a.progress(d).goal) earned.add(a.id);
  return STICKER_IDS.filter(id => earned.has(id));
}
/** Add coins, return newly unlocked sticker ids (coin thresholds and any achievement the same play session
 * just satisfied — every mode records its own stats before calling this, so `d` already reflects them). */
export function addCoins(n: number): string[] {
  const d = load(); const coins = d.coins + Math.max(0, n);
  const unlocked = evaluateStickers({ ...d, coins }); const fresh = unlocked.filter(id => !d.stickers.includes(id));
  save({ coins, stickers: unlocked });
  return fresh;
}
/** Certificate album cap. Far above the mission count, so it only ever trims a hand-edited or imported save. */
export const CERT_CAP = 60;
// A stored certificate has to survive a hand-edited save without taking the album down with it. Still not
// #174's full validator — it checks types, not values — but it checks **every field an entry is used
// through**, because a half-checked entry is worse than an unchecked one here: `{ id, title }` alone passed
// an earlier version of this guard, and then `fileCert`'s `c.stars > prev.stars` compared a real 3 against
// `undefined`, which is `false`, so the junk entry won every comparison and a child who had genuinely earned
// three stars could never be given that certificate. A guard that lets a partial object through does not
// merely fail to help; it manufactures a `prev` that beats everything.
const isCert = (c: unknown): c is StoredCert => {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const x = c as Record<string, unknown>;
  return typeof x.id === 'string' && typeof x.title === 'string' && typeof x.name === 'string'
    && typeof x.year === 'string' && typeof x.date === 'string'
    && [x.stars, x.score, x.correct, x.attempts].every(n => typeof n === 'number' && Number.isFinite(n));
};
/**
 * File a certificate into the album (pure). One entry per mission (`c.id`) — replaying a mission does not earn
 * a second award for it — and the entry kept is the **best** run, not simply the newest: a child who plays a
 * three-star mission again and does worse must not lose the certificate they earned, which is the one outcome
 * a reward has to rule out. Better = more stars, then a higher score; an equal run replaces the old one, so the
 * name and avatar follow a child who has since changed either. The kept entry moves to the front either way, so
 * the album reads most recently earned first. Capped at `cap`, oldest dropped.
 */
export function fileCert(list: StoredCert[], c: StoredCert, cap = CERT_CAP): StoredCert[] {
  const prev = list.find(x => x.id === c.id);
  const better = !prev || (c.stars !== prev.stars ? c.stars > prev.stars : c.score >= prev.score);
  return [better ? c : prev, ...list.filter(x => x.id !== c.id)].slice(0, Math.max(0, cap));
}
/** Every certificate earned, most recently filed first. Tolerant of a hand-edited save. */
export function certificates(): StoredCert[] { const c = load().certs; return Array.isArray(c) ? c.filter(isCert) : []; }
/** Record the certificate a won mission earned. Returns the album as it now stands. */
export function recordCert(c: StoredCert): StoredCert[] {
  const certs = fileCert(certificates(), c);
  save({ certs }); return certs;
}
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
/** Update the daily streak for a play today. Returns the streak length. */
export function touchStreak(now = new Date()): number {
  const d = load(); const t = today(now);
  if (d.streak.last === t) return d.streak.days;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const days = d.streak.last === today(y) ? d.streak.days + 1 : 1;
  save({ streak: { last: t, days } });
  return days;
}
/** Today's dojo state (rolled over to a fresh day when needed — not persisted until something is recorded). */
export function dojoToday(now = new Date()): DojoState { return dojoFor(load().dojo, today(now)); }
/** Feed a finished game to the Daily Dojo. Persists the state; the caller pays out `coins` (so sticker unlocks show). */
export function recordDojo(e: DojoEvent, now = new Date()): DojoOutcome {
  const out = applyEvent(load().dojo, e, today(now));
  save({ dojo: out.state }); return out;
}
/** The spendable part of the save. */
export function wallet(): Wallet { const d = load(); return { coins: d.coins, spent: d.spent || 0, owned: Array.isArray(d.owned) ? d.owned : [], equipped: d.equipped ?? {} }; }   // tolerant of hand-edited saves
export const coinBalance = () => balance(wallet());
/**
 * Buy (and equip) a shop item. Returns false when it is already owned, unknown or too dear — and also when the
 * purchase could not be kept (#151): the shop is the one screen that must not lie, because it takes coins.
 * Rolled back rather than left in `cache` for the rest of the session, so a false return means what it says —
 * nothing changed — instead of a purchase that plays back correctly until the next reload silently drops it.
 */
export function buyItem(id: string): boolean {
  const r = buy(wallet(), id); if (!r.ok) return false;
  const before = load();
  save({ spent: r.wallet.spent, owned: r.wallet.owned, equipped: r.wallet.equipped });
  if (readOnly || writeFailed) { cache = before; return false; }
  return true;
}
/** Equip an owned item. Returns false when nothing changed, or when the choice could not be kept (#151, same
 *  reasoning as buyItem — rolled back rather than shown as equipped for a session that will forget it). */
export function equipItem(id: string): boolean {
  const w = wallet(); const next = equip(w, id); if (next === w) return false;
  const before = load();
  save({ equipped: next.equipped });
  if (readOnly || writeFailed) { cache = before; return false; }
  return true;
}
export function reset() { const id = sessionProfile(); dropSessionState(); try { localStorage.removeItem(saveKeyFor(id)); } catch { /* ignore */ } }   // the refused blob is gone, so the latch goes with it (#232); writeFailed is a last-attempt signal, not a diagnosis, so a deliberate fresh start gives it the same benefit of the doubt — the very next save() call sets it again if the browser still refuses (#151)

/**
 * The save as a code the grown-up can copy to another device (#64). Every APK the workflow builds is signed
 * with a fresh debug key, so an update has to be installed over an uninstall — which takes localStorage, and
 * the child's coins, stars and streak, with it. Until the signing key is stable this is the way progress
 * survives a reinstall, and it is the same code #20's profiles and #16's second player would move about.
 */
export function exportSave(): string {
  load();   // settles the latch against what is actually on disk before we decide what to hand over
  // #232 review: under the latch `load()` is a fresh default, so exporting it would hand the grown-up a
  // **valid** code carrying no progress — and `parents.ts` invites them to paste it into Restore on the
  // other device, which is the device holding the real save. That would destroy it through the very
  // mechanism added to protect it. The stored blob *is* the child's save, so move that instead: the newer
  // device reads it, and an older one refuses it in importSave() exactly as it refuses any newer code.
  if (readOnly) {
    try { const raw = localStorage.getItem(saveKeyFor(sessionProfile())); if (raw) return raw; } catch { /* private mode etc. */ }
  }
  return JSON.stringify(load());
}

/**
 * Restore a save from an exported code, replacing what is on this device. Returns false and changes nothing
 * when the text is not one of our codes: a stray paste must not be able to wipe a child's progress, so the
 * blob has to carry a version we know how to read. A code from a newer build is refused too — migrations
 * only run forwards, so there is nothing to bring a v2 save down to v1.
 *
 * Deliberately not routed through save(), which merges a patch over the current save: restoring is a
 * replacement, and a merge would leave the old device's keys sitting under the new ones.
 */
export function importSave(text: string): boolean {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return false; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const v = (raw as RawSave).v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return false;
  const next = migrate(raw);
  const id = sessionProfile();
  let wrote = false;
  try { localStorage.setItem(saveKeyFor(id), JSON.stringify(next)); wrote = true; } catch { /* private mode etc. */ }
  cache = next; cacheProfile = id;
  // #232 review: only lift the protection if the replacement actually landed. If setItem threw, the newer
  // blob is still on disk — clearing the latch here would let the next ordinary save() relabel it, which is
  // #232 restored through this very line. (The swallowed catch and the unconditional `true` are older
  // faults, tracked in issue 266, and are not widened here.)
  if (wrote) readOnly = false;
  return true;
}
