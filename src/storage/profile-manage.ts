// The grown-ups' two profile controls: rename and delete (#20 slice 3).
import type { RawSave } from './shape';
import { currentIndex, readItem, readTombstones, saveKeyFor, writeIndex, writeTombstones, type ProfileId, type ProfileIndex } from './profile-index';
import { leaveProfile, sessionProfile, state } from './state';
import { load, save } from './store';
import { isMigratable } from './migrate';
import { cleanName } from './name';
import { futureSaveIn } from './profile-card';
/**
 * Why a rename was refused, as a value the grown-ups screen can turn into a sentence (#20 slice 3, the
 * `AddProfileResult` shape). The accepted arm carries the name **as stored**, trimmed and truncated, because
 * that — not what was typed — is what the row must redraw with.
 *
 * - `'unknown'` — not a profile on this device. A stale row, or a second tab that deleted the slot.
 * - `'no-save'` — the slot exists but holds nothing this build can read, so there is no name to change.
 *   Distinct from `'unknown'` on purpose: the family can act on it (that child plays first), and the
 *   grown-ups list therefore offers no rename on an unplayed row rather than showing a refusal.
 * - `'future'` — the slot holds a save a **newer build** wrote, on either side of the two paths below. Split
 *   out of `'store'` (#420 review note 4): conflating them is what `readOnly`'s own paragraph forbids, because
 *   the remedies are opposites — this one needs the other device or an update, and `'store'` needs private
 *   browsing off or space freed. Neither ever fixes the other. **Checked before `'blank'`** (#431 review,
 *   type-design-analyzer): a slot this build cannot touch at all is refused on that alone, whatever the
 *   grown-up typed or left empty — a name that will never be looked at is not worth a second refusal reason.
 *   `canRenameCard` never offers the input on a `future` row in the first place, so the combination has no
 *   route from the screen; only a direct call can reach it.
 * - `'blank'` — a name of only spaces. `hasName` (`avatar.ts`) delegates to this same `cleanName`.
 * - `'store'` — the browser would not keep it, the same fault `STORE_HINT` describes on the picker.
 */
export type RenameProfileResult = { ok: true; name: string } | { ok: false; why: 'unknown' | 'no-save' | 'future' | 'blank' | 'store' };
/** The refusal reasons, derived from the result type rather than restated (#420 review note 3). A `Record` over
 *  a hand-written copy of the union only errors at its *index* site and catches a **removed** arm nowhere at
 *  all, because the union was then written out three times and one copy was checked. */
export type RenameRefusal = Extract<RenameProfileResult, { ok: false }>['why'];
/**
 * The name the store is actually holding for a slot, or null when it holds nothing readable — the read-back
 * both rename paths end on (#420 review B3, B4).
 *
 * `writeIndex` has read back since #330 and the sibling rename did from the start; the session's own path did
 * not, and `save()` sets `writeFailed` only when `setItem` **throws**. A store that accepts the call and keeps
 * nothing is the other half of "the write did not land": the rename reported `ok`, the heading and the map
 * pill both changed because they read `cache`, `saveNote()` stayed quiet because `writeFailed` was false, and
 * at the next launch the old name was back with nothing to explain it.
 */
function storedName(id: ProfileId): string | null {
  const raw = readItem(saveKeyFor(id));
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const n = (parsed as RawSave).name;
  return typeof n === 'string' ? n : null;
}
/**
 * Rename a profile — the first of slice 3's two grown-ups controls (#20).
 *
 * **Two paths, because renaming the child holding the device is not the same act as renaming a sibling.**
 *
 * - **This session's own profile** goes through `save()`, so the name the running game shows — the map's
 *   `#change-av` pill, the dashboard's own heading, the next certificate — changes with the store instead of
 *   at the next reload. Writing raw here would leave `cache` holding the old name and the screen lying.
 *   `readOnly` (#232) is a refusal rather than a silent success: `save()` deliberately writes nothing while
 *   it is latched, so reporting `ok` would promise a rename the store never took.
 * - **A sibling's slot** is patched raw: read, set one field, write. Deliberately *not* through `load()`,
 *   for the reason `profileCard` gives — that resolves and caches the session's profile, so it would either
 *   rename the wrong child or latch this session onto them. And deliberately not through `migrate()` either:
 *   a rename must not be the thing that rewrites a sibling's blob into this build's shape. One field changes
 *   and every other byte survives, which is also what makes this safe to offer for a v1 or v2 save.
 *
 * `isMigratable` gates the raw path for the same reason `profileCard` applies it: a blob from a newer build is
 * one this build cannot open, and stamping a name onto it is a small corruption of a save the other device
 * still reads. It answers `'no-save'` — honest about the outcome, and the list never offers the control.
 *
 * **`futureSaveIn(id)` is checked once, before either path, rather than each path asking its own question
 * about "future"** (#431 review, item 1). The session path used to ask `readOnly` — a latch set only by the
 * last `load()` this session ran, so with the latch still unset (no `load()` yet this session, the exact order
 * `parentsScreen` happens not to hit) a newer-build save on the session's own slot fell through to `save()`,
 * which itself sets `readOnly` too late to stop this function reaching `'store'` instead of `'future'` — the
 * conflation `RenameProfileResult`'s own doc forbids. The sibling path asked an inline `isFutureSave(parsed)`.
 * One call against the disk bytes, ahead of the branch, answers both and cannot go stale the way a cached
 * latch can.
 *
 * **Both paths end on the same read-back** — `storedName(id) === next` — because a store that accepts
 * `setItem` and keeps nothing is the failure that cost #330 a review round, and `ok` here has to mean the store
 * is holding the new name. The session path read back nothing at all until #420 review B3; when it now fails,
 * `cache`'s name is put back, so the screen never shows a name the store refused. **Both paths now latch
 * `writeFailed` on that same failure, throw or silent drop alike** (#431 review, item 5). The sibling path
 * used to return a reason and nothing else. The session path goes through `save()`, which already latches on
 * a *throw* — but `save()`'s own `writeFailed = false` runs unconditionally whenever `setItem` does not throw,
 * so a silent drop on this path used to leave the latch clear, and could even clear a `true` a moment-earlier
 * sibling rename or delete had correctly set (silent-failure-hunter, #431 review). This function now sets it
 * itself once its own read-back disagrees, on either path — `parents.ts:35`'s "this device is not saving"
 * used to stay quiet about a refused rename, of either kind, until an unrelated write happened to set it.
 */
export function renameProfile(id: ProfileId, name: string): RenameProfileResult {
  if (!currentIndex().ids.includes(id)) return { ok: false, why: 'unknown' };
  if (futureSaveIn(id)) return { ok: false, why: 'future' };
  const next = cleanName(name);
  if (!next) return { ok: false, why: 'blank' };
  if (id === sessionProfile()) {
    const before = load().name;
    save({ name: next });
    if (!state.writeFailed && storedName(id) === next) return { ok: true, name: next };
    // `save()` only ever sets `writeFailed` from whether `setItem` *threw* — a silent drop (the call
    // accepted, the read-back disagrees) leaves it `false`, which is exactly the class this review item is
    // about (silent-failure-hunter, #431 review). Left uncorrected this would also erase a `true` some other
    // write had just latched: `save()`'s own `writeFailed = false` runs unconditionally on a non-throwing
    // `setItem`, so a session rename against a silently-dropping store could clear the very latch a sibling
    // rename or a delete had set moments earlier, even though this write failed too.
    state.writeFailed = true;
    // Nothing landed, so nothing may look as though it had: `cache` is what the heading and the map pill
    // read, and `save()` has already put the new name in it (#420 review B3). Assigned rather than saved —
    // a second write on a store that just refused one buys nothing and could refuse in its turn.
    state.cache = { ...load(), name: before };
    return { ok: false, why: 'store' };
  }
  const key = saveKeyFor(id);
  const raw = readItem(key);
  if (!raw) return { ok: false, why: 'no-save' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, why: 'no-save' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, why: 'no-save' };
  if (!isMigratable(parsed as RawSave)) return { ok: false, why: 'no-save' };
  const blob = JSON.stringify({ ...(parsed as RawSave), name: next });
  try { localStorage.setItem(key, blob); } catch { state.writeFailed = true; return { ok: false, why: 'store' }; }
  if (storedName(id) === next) { state.writeFailed = false; return { ok: true, name: next }; }
  state.writeFailed = true;
  return { ok: false, why: 'store' };
}
/**
 * Why a delete was refused, and what the caller must do when it was not (#20 slice 3).
 *
 * - `'unknown'` — not a profile on this device, as for a rename.
 * - `'last'` — it is the only profile left. See `deleteProfile` for why that is refused here rather than
 *   handled.
 * - `'future'` — the slot holds a save a **newer build** wrote (#420 review B2). `renameProfile` has refused
 *   that since it was written, on the grounds that a rename must not stamp this build's shape onto a save the
 *   other device still reads; a delete destroys it outright, which is the same argument with more at stake,
 *   and this function inherited none of the guard. Worse, `profileCard` blanks such a save, so the row drew
 *   ＋ / "Ninja 2" / "Not started yet" beside a Remove button and invited the tap: reachable by an APK
 *   rollback, a sideloaded older build (`docs/ANDROID.md`) or a stale service worker — #232's whole scenario.
 * - `'store'` — the store did not keep the change, and then **nothing has been deleted**: the ordering below
 *   is what buys that promise.
 * - `'orphaned'` — the one outcome where the tap did change something and it is not what was asked (#420
 *   review round 2, B2). The store kept the save's bytes *and* refused to take the index back, so the child is
 *   no longer listed while their game is still on the device. It has its own arm because `'store'`'s sentence
 *   is "nothing was removed", and here something was: a family told that would be told a falsehood about their
 *   own device.
 * - `'stranded'` — every profile this removal would leave is a `'future'` save (#446): a build newer than this
 *   one wrote every remaining slot, so the device would be left with nobody this build can read, and the first
 *   thing it does with nobody readable is send the family to the first-run wizard over a store `readOnly`
 *   latches — `onboarded()` reports `false` for a slot this build cannot open. That wizard cannot be completed:
 *   nothing typed into it is ever kept. `'last'` already refuses deleting the *only* profile for exactly this
 *   reason; this is the same refusal for the case `'last'` cannot see, where other slots exist but none of them
 *   are ones this build can play.
 *
 * `self` on the accepted arm is "this session was playing the child who has just gone", and it is the storage
 * layer's answer because `cacheProfile` is the only thing that knows: the index's `active` is a different
 * question, and a second tab makes the two disagree on purpose (`sessionProfile`). A caller that got `self`
 * must leave the screen it is on — the save behind it no longer exists.
 *
 * There is deliberately **no `active`** on that arm (#420 review note 2). It had no consumer: `parents.ts`
 * reads `self` and `main.ts`'s `relaunch()` re-derives where to go from the index, which is the one place that
 * rule lives. A second copy of the destination is a second rule to keep in step.
 */
export type DeleteProfileResult = { ok: true; self: boolean } | { ok: false; why: 'unknown' | 'last' | 'future' | 'stranded' | 'store' | 'orphaned' };
/** As `RenameRefusal`, derived rather than restated (#420 review note 3). */
export type DeleteRefusal = Extract<DeleteProfileResult, { ok: false }>['why'];
/**
 * Remove a profile and its save — the second of slice 3's grown-ups controls (#20).
 *
 * **The last profile is refused, and that is a deliberate narrowing of the issue's sketch.** #20's slice 3
 * says deleting the active profile "returns to the picker (or to onboarding if it was the last one)", which
 * reads as deleting the only profile being allowed. But that is already a control on the same screen —
 * "Start again" — and that one asks a grown-up to type `RESET` before it clears anything, and offers an undo
 * afterwards. A second route to the same end, two taps and no typed word, would quietly weaken the guard
 * `RESET_WORD` exists to be (`parents.ts`). So the destination the issue asks for is reached through the
 * control that already guards it, and this one refuses with `'last'`. Refused **here** rather than by the
 * list not drawing the button, because "there is exactly one way to wipe this device" is a property of the
 * store, and a rail on a disabled button only pins the current screen.
 *
 * **The index is written before the bytes are removed**, and the two are not interchangeable:
 *
 * - Index first means a refused write has changed nothing at all — the save is still there and the family
 *   still sees the child, which is what `'store'` promises. `writeIndex`'s own paragraph narrows that to
 *   "the store is not holding this index"; that caveat applies here too.
 * - Bytes first would put the failure the other way round: a `removeItem` that landed followed by an index
 *   write that did not leaves a listed profile whose save is gone, reported as a failure. Losing a sibling's
 *   progress is the worse of the two outcomes, so it is the one the ordering rules out.
 *
 * **And the bytes are read back, not assumed gone** (#420 review B2/B4). The producible fault needs no throw
 * at all — a store that accepts `removeItem` and keeps the bytes — and this is the function making the
 * strongest promise to a family: the modal says "It cannot be undone". Without the read-back the row vanished,
 * the message said the child was removed, and every byte was still there, with two silent consequences.
 * `addProfile` probes `holdsSave`, so the slot was never reusable and the ＋ card eventually answered "four
 * ninjas is the most" to a family that could see two; and `defaultIndex()` probes it too, so a later lost index
 * brought the removed child back with their full save, after they had been told it could not be undone.
 *
 * When the bytes survive, the index is **put back** and the answer is `'store'`, so the tap changed nothing
 * the family can see and nothing they were promised.
 *
 * **That restoring write can itself be refused, and its answer is read rather than discarded** (#420 review
 * round 2, B2). It is the likelier half of the pair, not the unlikely one: the blob it writes is strictly
 * *longer* than the one the store just accepted, so a quota band exists that takes the shorter and refuses the
 * longer. Then the child really is delisted with their bytes intact, and that is `'orphaned'` — not `'store'`,
 * whose sentence is "nothing was removed".
 *
 * **And it does not heal, which the first version of this paragraph claimed it would.** Once the slot is out of
 * `ids`, `deleteProfile` answers `'unknown'` for it and nothing in the UI can reach the bytes, while
 * `addProfile`'s `holdsSave` probe skips that slot for good: the family is capped a ninja short and will
 * eventually be told "four ninjas is the most" with three on screen. Only losing the index recovers it, because
 * `defaultIndex()` probes the slots — the same path that makes the child reappear.
 *
 * It is still the recoverable direction, and that is why the index is written first rather than the bytes
 * removed first: the save exists throughout. Removing the bytes first would put the failure the other way
 * round — a save destroyed and the child still listed — and losing a sibling's progress is the worse of the
 * two.
 *
 * **No `writeFailed` pre-check, unlike `addProfile`.** That one refuses under the latch because adding
 * switches away from the child holding the device, whose unsaved coins live only in `cache` (#380 round 5,
 * B2). Deleting a *sibling* leaves this session untouched, and deleting the playing child is a grown-up
 * asking for exactly that blob to go. The index write still fails on its own if the store is refusing, and
 * then `'store'` is the answer.
 *
 * **Every `'store'`/`'orphaned'` refusal latches `writeFailed`, and a clean delete clears it** (#431 review,
 * item 5). This function used to return a reason and touch nothing else, so `parents.ts:35`'s "this device is
 * not saving progress" stayed quiet about a refused delete — the index write refusing, or the rollback that
 * follows a kept-bytes refusal failing in its turn — until an unrelated ordinary `save()` happened to set the
 * latch for a different reason. `addProfile`/`setActiveProfile` already latch on their own `writeIndex` calls;
 * this one did not.
 */
export function deleteProfile(id: ProfileId): DeleteProfileResult {
  const idx = currentIndex();
  if (!idx.ids.includes(id)) return { ok: false, why: 'unknown' };
  const rest = idx.ids.filter(x => x !== id);
  if (!rest.length) return { ok: false, why: 'last' };
  // Before the index write, so a refusal changes nothing at all — the same reason `addProfile` checks the
  // store before writing (#380 round 5, B2).
  if (futureSaveIn(id)) return { ok: false, why: 'future' };
  // #446: `rest` surviving in the index is not the same as `rest` being playable. A slot this build cannot
  // read answers `onboarded: false` (`profileCard`/`load()`'s own rule), which sends the family to the
  // first-run wizard over a store `readOnly` latches shut — the wizard nothing typed into it ever keeps.
  if (rest.every(futureSaveIn)) return { ok: false, why: 'stranded' };
  const self = id === sessionProfile();
  const next: ProfileIndex = { v: 1, active: idx.active === id ? rest[0] : idx.active, ids: rest };
  if (!writeIndex(next)) { state.writeFailed = true; return { ok: false, why: 'store' }; }
  try { localStorage.removeItem(saveKeyFor(id)); } catch { /* the read-back below is what decides, not the throw */ }
  if (readItem(saveKeyFor(id)) !== null) {
    const restored = writeIndex(idx);
    state.writeFailed = !restored;
    return { ok: false, why: restored ? 'store' : 'orphaned' };
  }
  state.writeFailed = false;
  // The bytes are confirmed gone by the read-back above — the one moment this function knows a delete truly
  // landed, as opposed to a refusal it is about to roll back. Tombstoned here, not on every refusal arm, so a
  // failed or rolled-back delete never marks a slot the family can still see (#431 review, item 4).
  // The delete itself still reports success either way — the tombstone is hardening on a kept promise, not the
  // promise itself — but a refusal here is a real store fault like every other write in this file, so it
  // latches `writeFailed` rather than passing silently (#690 review round 2).
  if (!writeTombstones([...readTombstones(), id])) state.writeFailed = true;
  // Only the *session's* profile going takes the session with it. A second tab that is playing someone else
  // keeps its cache and both latches even though `active` moved here — `sessionProfile()` is latched to that
  // child, so their writes still land in their own slot. This is `rereadProfile`'s rule (#380 round 5, B2)
  // asked of `cacheProfile` rather than of the index, for the same reason.
  if (self) leaveProfile();
  return { ok: true, self };
}
