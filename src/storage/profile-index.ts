// Which profiles exist on this device and where each one's save lives: the index, the four slots and the tombstones.
const KEY = 'sna:v1';                       // stable localStorage slot (its `v1` is historical; `raw.v` drives migration)
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
/** The four fixed slots — the owner's cap (in session, 2026-09-19). Fixed rather than generated so a corrupt
 *  index can be rebuilt by *probing* the store (four `getItem`s) instead of enumerating it — `localStorage`
 *  enumeration is the one part of the API the Capacitor WebView and the test shim do not agree on.
 *  `as const` rather than a `: readonly ProfileId[]` annotation, which widens the tuple and takes `length`
 *  back to `number` (#330 review N2). */
export const PROFILE_IDS = ['p1', 'p2', 'p3', 'p4'] as const;
/** Derived from the list, not declared beside it: a union written separately is a second truth, and adding
 *  `'p5'` to it alone type-checks `saveKeyFor('p5')` while `isProfileId('p5')` stays false — an addressable
 *  slot nothing can ever reach (#330 round 2, N4). */
export type ProfileId = typeof PROFILE_IDS[number];
/** Derived, never declared: `addProfile` caps by running out of slots, so a hand-written number here was a
 *  second truth that could disagree with the first — set it to 3 and the module hands out a fourth slot and
 *  then refuses the index it just wrote (#330 review N2). */
export const MAX_PROFILES = PROFILE_IDS.length;
const INDEX_KEY = 'sna:profiles';
/**
 * Slots a delete has taken back, kept outside the index itself (#431 review, item 4) so the record survives
 * the one thing it exists to survive: a **second tab**, still caching the deleted child, running its own
 * ordinary `save()` moments later and writing a whole cached blob straight back to `saveKeyFor(id)` — the
 * write path never asks the index whether its profile still exists. Without this, that resurrected blob does
 * two things nobody asked for: `addProfile`'s free-slot probe (`slotState(id) === 'empty'`) sees `'save'` and
 * skips the slot for good, capping the family a ninja short with three visible; and if the index is ever lost,
 * `defaultIndex()`'s recovery probe (`holdsSave`) sees the same bytes and brings the deleted child back —
 * after the modal said it could not be undone. Both readers are taught to skip a tombstoned id below;
 * `addProfile` also clears the entry and the stray bytes once it reuses the slot, so the record never grows
 * past `PROFILE_IDS.length` and a slot freed this way starts the next child with nothing inherited.
 *
 * **This closes the delete half only.** The rename half of the same race — tab B's `save()` writing the old
 * name back over a sibling rename tab A just made — is the raw-write design itself: there is no index entry
 * to remove and no slot to skip, only a blob two tabs disagree about, and neither tab knows the other wrote.
 */
const TOMBSTONES_KEY = 'sna:profiles:tombstones';
/** Profile 1 is the save that is already on the device; the rest hang off the same slot name. */
export const saveKeyFor = (id: ProfileId) => (id === 'p1' ? KEY : `${KEY}:${id}`);
/** Not exported: nothing outside this file reads the shape of the stored index directly, only through
 *  `profileIds()`/`activeProfile()` (#401 item 4). `ids` is `readonly` for the same reason `profileIds()`
 *  itself is (#335 item 5) — every value here is a caller's copy of parsed state, never a live array a write
 *  goes through. */
export interface ProfileIndex { v: 1; active: ProfileId; ids: readonly ProfileId[] }

const isProfileId = (x: unknown): x is ProfileId => typeof x === 'string' && (PROFILE_IDS as readonly string[]).includes(x);
export const readItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };

/** The stored index, or null when there is none, it is not ours, or it is not self-consistent. Deliberately
 *  strict: our `v`, and `ids` must be distinct known slots containing `active`. */
function readIndex(): ProfileIndex | null {
  const raw = readItem(INDEX_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  // Two halves, and only the first is load-bearing — said plainly, since the comment below deletes a clause
  // for being unreachable. `!parsed` is what stops `sna:profiles = 'null'` reaching the destructure and
  // throwing out of `activeProfile()`, `profileIds()` and `load()` alike, taking the whole recovery this
  // block exists for with it; deleting the line is red. The `typeof`/`Array.isArray` half is subsumed by
  // `v !== 1` two lines down, because no JSON array or primitive can carry a `v` at all — removing it alone
  // is green, and no fixture can make it otherwise. It stays as the parse-boundary front door, the shape
  // `migrate()` uses on the same kind of blob, rather than leaving `readIndex` depending on the version rule
  // to reject an array (#330 round 2, N1/N2).
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
  if (!Array.isArray(ids)) return null;
  if (!ids.every(isProfileId) || new Set(ids).size !== ids.length) return null;
  // `isProfileId(active)` is here to *narrow* `active` for the return, not as a belt: by this line
  // `ids.includes(active)` already refuses anything it would have caught, an empty `ids` included, since
  // nothing is a member of an empty list. Written out because the comment above deleted a clause for being
  // unreachable, and a reader is owed the reason this one that looks the same is not the same (#330 round 2).
  if (!isProfileId(active) || !ids.includes(active)) return null;
  return { v: 1, active, ids: ids as ProfileId[] };
}
/**
 * What the store says when the index is missing or unreadable: **profile 1, active**, plus any other slot that
 * actually holds a save. A corrupt index must not present a child with a blank game — their save is still
 * under its own key — and it must not orphan a sibling's either, which is why this probes rather than
 * returning `['p1']` flat. Nothing is written here on purpose: a blob we merely failed to parse is not
 * overwritten until a real profile action (`setActiveProfile`, `addProfile`) asks for one.
 *
 * **What the probe can and cannot see** (#335 items 3 and 4, stated rather than fixed). It sees a slot only
 * while that slot *holds a save*, so a profile added by `addProfile()` and never played — which deliberately
 * writes no save — is invisible to it, as is a slot after `reset()`; if the index is then lost, that child is
 * not in this list. And `readItem()` collapses "absent", "unreadable" and "the read threw" into `null`, so in
 * an environment where `getItem` itself throws — private mode, a WebView with DOM storage off, both named in
 * this file already — four configured children present here as one. Neither loses anything: the saves stay
 * under their own keys, and the same environments refuse the writes that would overwrite them. The list is
 * wrong, not the data.
 */
function defaultIndex(): ProfileIndex {
  // A tombstoned slot is skipped even when it holds a save: that save is a second tab's stale write, not a
  // profile this device still has (#431 review, item 4) — see TOMBSTONES_KEY.
  const tombstoned = readTombstones();
  // The tombstone check cannot sit inside the `||`: `id === 'p1'` short-circuited it there, so a tombstoned
  // p1 came back regardless of `holdsSave` (#690 review round 2). Gating the whole filter on it first makes it
  // apply to every slot alike, p1 included.
  const ids = PROFILE_IDS.filter(id => !tombstoned.includes(id) && (id === 'p1' || holdsSave(id)));
  return { v: 1, active: 'p1', ids };
}
/** Whether a slot is empty, holds something this module could have written, or holds bytes it cannot make
 *  sense of. `holdsSave` used to collapse the last two into one "no save" answer, and `addProfile`'s free-slot
 *  probe read that as "free" — the probe added to stop a slot being handed out twice (#330 review, 02:36Z) had
 *  a blind spot of exactly the shape it was added for (#384 item 4). No app path writes a garbled blob
 *  (`setItem` is atomic and every writer goes through `save()`), which is why this is hardening rather than a
 *  bug: nothing has been seen to reach it, only nothing stopped it either. Shape only, like `migrate()`'s own
 *  front door. */
export function slotState(id: ProfileId): 'empty' | 'save' | 'garbled' {
  const raw = readItem(saveKeyFor(id));
  if (!raw) return 'empty';
  try { const parsed: unknown = JSON.parse(raw); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? 'save' : 'garbled'; }
  catch { return 'garbled'; }
}
function holdsSave(id: ProfileId): boolean { return slotState(id) === 'save'; }
export const currentIndex = (): ProfileIndex => readIndex() ?? defaultIndex();
/**
 * Persist an index. False when the store did not keep it, and then nothing about the profiles has changed.
 *
 * It **reads the key back** rather than trusting that `setItem` returned: a store that throws is only half of
 * "the write did not land". A store that accepts the call and keeps nothing — the shape the issue's own
 * migration sketch guarded against with "verify it reads back" — used to return true here, so `addProfile()`
 * reported a new profile that the next `currentIndex()` knew nothing about: the new child onboarded straight
 * over their sibling's save, in the sibling's slot, and neither child had a game left (#330 review, 02:36Z).
 *
 * What `false` promises is exact: the store is **not** holding this index. It does not promise the key is
 * untouched. For the store this was written for — one that accepts the call and keeps nothing — the two are
 * the same. On a partially-working store the `setItem` may have landed and the read-back disagreed, or the
 * read itself thrown, and then the caller's false return sits beside a stored `active` that did change
 * (#330 round 2, N5). Rolling back would need a blob to roll back to and a write that can fail in its turn,
 * so the narrower promise is stated rather than bought.
 */
export function writeIndex(next: ProfileIndex): boolean {
  const blob = JSON.stringify(next);
  try { localStorage.setItem(INDEX_KEY, blob); } catch { return false; }
  return readItem(INDEX_KEY) === blob;
}
/** The tombstoned slots, or none of them on any hiccup at all — this record is hardening on top of a promise
 *  (`deleteProfile`) that has already been kept, so a reader that cannot make sense of it treats the device as
 *  having none, the same fail-open `readIndex` uses for a blob it does not trust. */
export function readTombstones(): readonly ProfileId[] {
  const raw = readItem(TOMBSTONES_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  return Array.isArray(parsed) ? parsed.filter(isProfileId) : [];
}
/** Read back like `writeIndex`, for the same reason: a store that accepts `setItem` and keeps nothing is not
 *  the same as one that threw, and a caller deciding whether to trust this write needs to be told which.
 *  **Whether a `false` here matters is the caller's call, not this function's** (silent-failure-hunter, #431
 *  review) — recording a tombstone on a delete that has already succeeded is hardening on top of a kept
 *  promise, so `deleteProfile` does not gate its *result* on it, the delete still reports success; but a
 *  failed record here is a real store refusal like any other, so `deleteProfile` latches `writeFailed` on it
 *  the same as every other write in this file (#690 review round 2) — silence here is what "this device is not
 *  saving progress" exists to rule out. Clearing one in `addProfile` gates the *result* too, because a
 *  tombstone that outlives the slot it was reused from has no benign fallback, unlike the stray bytes beside it. */
export function writeTombstones(ids: readonly ProfileId[]): boolean {
  const blob = JSON.stringify(ids);
  try { localStorage.setItem(TOMBSTONES_KEY, blob); } catch { return false; }
  return readItem(TOMBSTONES_KEY) === blob;
}
/** The profiles on this device, in slot order. One profile is the normal case and costs no stored key.
 *
 *  `readonly` because the array is the caller's copy of parsed state and pushing to it changes nothing —
 *  `profileIds().push('p4')` used to type-check and silently do nothing (#335 item 5). */
export const profileIds = (): readonly ProfileId[] => currentIndex().ids;
/** Whose game the **store** says is being played — what slice 2's picker draws, and where a session starts.
 *  Not necessarily whose game `load()` and `save()` are acting on: that is `sessionProfile()`, resolved once
 *  per session, and the two part company in a second tab on purpose (#330 round 2, N3). */
export const activeProfile = (): ProfileId => currentIndex().active;
