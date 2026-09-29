// Switching to a profile and adding one (#20).
import { currentIndex, PROFILE_IDS, readItem, readTombstones, saveKeyFor, slotState, writeIndex, writeTombstones, type ProfileId } from './profile-index';
import { leaveProfile, rereadProfile, state } from './state';
/**
 * The two ways a switch can be refused, told apart the same way `addProfile`'s `AddProfileResult` are
 * (#401 item 5). `pickOutcome` used to get a bare `boolean` here and collapse both into the one sentence
 * about the browser, which told a family whose card had simply gone stale (a second tab deleted the slot
 * mid-render) that their browser could not save — the wrong fault for the wrong reason.
 *
 * - `'unknown'` — `id` is not one of this device's profiles any more. Only a second tab or a delete landing
 *   between the picker drawing the card and the tap reaches this; nothing in this build offers a stale id on
 *   purpose.
 * - `'store'` — the index was not kept: a switch the store refuses would put the child back on their
 *   sibling's game at the next launch, and on a store that refuses this write the new profile could not be
 *   saved either.
 *
 * The caller says which, rather than the session pretending (the `buyItem`/`equipItem` rule, #151).
 */
export type SetActiveResult = { ok: true } | { ok: false; why: 'unknown' | 'store' };
/**
 * Switch the active profile. See `SetActiveResult` for what a refusal means.
 *
 * **Re-selecting the child who is already active is not a switch and writes nothing** (#380 review B1). It
 * used to: the index was rewritten with the value it already held, so on a store that refuses writes every
 * card on the launch picker was refused — the child's own included — and since the launch picker draws no
 * back control, the device that used to boot to the sky map and play unsaved could no longer reach the game
 * at all. Nothing needs persisting to hand a child back their own game, so nothing is attempted.
 *
 * **This session is unchanged on a refusal; the store is not guaranteed to be.** `writeIndex` promises only
 * that it is not holding this index, not that the key is untouched — on a partially-working store the
 * `setItem` may have landed and the read-back disagreed. Read its paragraph before relying on the stronger
 * reading; a refusal did once say "nothing changes" outright, and that outlived the narrowing (#330 round 3, N5).
 *
 * **Both arms end in `rereadProfile`, and that is the fix for a whole shape of bug rather than one path**
 * (#380 review round 5, B2). Round 4 taught the `idx.active === id` arm to keep a cached save the store has
 * refused, and left `leaveProfile()` on the arm below it — where the index *did* change. But the index naming
 * a different child does not mean *this session* is playing one: a second tab moving `active` to Bo is exactly
 * the case round 4 was about, and Ada tapping her own card then took the write path and had her unsaved coins
 * dropped with `true` returned and `isWriteFailing()` cleared. Which arm ran decides what is *written*;
 * whether the session changes child is `rereadProfile`'s question either way, asked of `cacheProfile` rather
 * than of the index.
 */
export function setActiveProfile(id: ProfileId): SetActiveResult {
  const idx = currentIndex();
  if (!idx.ids.includes(id)) return { ok: false, why: 'unknown' };
  if (idx.active !== id && !writeIndex({ ...idx, active: id })) { state.writeFailed = true; return { ok: false, why: 'store' }; }
  rereadProfile(id);
  return { ok: true };
}
/**
 * The two ways adding a profile can be refused, told apart (#335 item 2). `null` carried both, and the picker
 * has to say two different things: `'full'` is "four ninjas is the most" — a sentence about this family —
 * while `'store'` is "this browser will not let the game save", a fault the child cannot do anything about.
 * `writeIndex`'s catch is the only place that knows the difference, and a `'store'` refusal now sets
 * `writeFailed` here too, the way `save()` already does, so `isWriteFailing()` can recover it afterwards
 * (#384 item 2) — it used to discard it, and `parents.ts:35`'s sentence stayed quiet through a refused add
 * or switch until the next ordinary `save()` set the latch for an unrelated reason.
 *
 * A result object rather than a widened string union: `ProfileId` is itself a string literal union, so
 * `'full' | ProfileId` would need `isProfileId()` at every call site to be read at all.
 */
export type AddProfileResult = { ok: true; id: ProfileId } | { ok: false; why: 'full' | 'store' };
/**
 * Add a profile and make it active. The new profile starts on `DEFAULT`, so the caller runs the normal
 * onboarding; `why` says which refusal it got (see `AddProfileResult`).
 *
 * The free slot is probed as well as counted (#335 item 1): an index that is valid but under-reports a
 * populated slot would otherwise hand a new child a slot that already holds a sibling's save, and onboarding
 * would merge straight over it. `defaultIndex()` makes that index hard to come by — it probes the same way —
 * but `addProfile` is the one that does the damage, so it checks for itself rather than inheriting the care.
 * The consequence is that "a slot is free" here is stricter than `ids.length < MAX_PROFILES`, which is why the
 * picker asks this function instead of counting: with four slots and three profiles it can still answer
 * `'full'`, and that is the honest answer — there is nowhere to put a fourth child.
 *
 * The same caveat as `setActiveProfile` applies to the store on a `'store'` refusal.
 *
 * **A refused save is a refusal here too** (#380 review round 5, B2). Adding a profile switches away from the
 * child holding the device, so their session state goes — and under `writeFailed` that state is the only copy
 * of the game they have been playing, coins the store never accepted (#151). The index blob is ~39 bytes and
 * the save blob ~413, so a filling quota necessarily passes through a band where this write is kept and that
 * one is not: `writeIndex` returned true, `ok: true` came back, `refuse()` was never reached, and one tap on
 * "New ninja" took the playing child's name, ninja and coins with no hint, no sound and nothing spoken. It
 * also cleared the latch, so `parents.ts`'s "this device is not saving progress" — the one place a grown-up
 * could have learnt why — went quiet. A profile the store cannot save is one it cannot hand a child, so the
 * honest answer is `'store'`, checked **before** the index write — but only while `cache !== null` (#587).
 *
 * `readOnly` (#232) deliberately does not refuse: the store there is writable and the new child's save will
 * land: it is *this* child's blob that comes from a future version, and `save()` never writes it back, so the
 * session cache holds nothing disk is missing. `'full'` still comes first — there being nowhere to put a
 * fourth child is true whatever the store is doing, and the count is what the family can act on.
 *
 * **A tombstoned slot is free too, whatever `slotState` says of it** (#431 review, item 4). A second tab's
 * stale `save()` for a profile this device has since deleted can leave real bytes behind — see
 * `TOMBSTONES_KEY` — and without this the family would be capped a ninja short forever over a slot that is,
 * as far as anyone here is concerned, empty. Once claimed, the tombstone is dropped and the leftover bytes are
 * wiped before the new child ever reads from the slot, so they start on nothing inherited rather than on
 * whatever their predecessor's other tab last wrote.
 *
 * **That wipe is read back, not assumed to have landed** (PR #690 review). A store that accepts `removeItem`
 * and keeps the bytes is the exact fault `deleteProfile`'s own read-back already treats as real and
 * producible — and here it is worse than a display nit: the caller below would go on to hand this slot to a
 * brand-new child, whose very first `load()` would return the deleted sibling's name, coins and progress
 * rather than `DEFAULT`. So this refuses the whole add on a `removeItem` that did not land, the same as a
 * failed `writeTombstones` just below it, rather than proceeding onto stray bytes it cannot see are still
 * there.
 */
export function addProfile(): AddProfileResult {
  const idx = currentIndex();
  const tombstoned = readTombstones();
  const free = PROFILE_IDS.find(id => !idx.ids.includes(id) && (slotState(id) === 'empty' || tombstoned.includes(id)));
  if (!free) return { ok: false, why: 'full' };
  if (state.writeFailed && state.cache !== null) return { ok: false, why: 'store' };
  // Cleared **before** the index write, so a refusal here changes nothing at all — the same discipline as the
  // `writeFailed` precheck just above. Unlike the stray bytes a `removeItem` below also clears, a surviving
  // tombstone entry has no benign fallback: the next time the index is lost, `defaultIndex()` would skip this
  // slot forever, hiding a live profile rather than a resurrected one (silent-failure-hunter, #431 review) —
  // so this is the one tombstone write in the file that *is* gated, unlike `deleteProfile`'s.
  if (tombstoned.includes(free)) {
    try { localStorage.removeItem(saveKeyFor(free)); } catch { /* the read-back below is what decides, not the throw */ }
    if (readItem(saveKeyFor(free)) !== null) { state.writeFailed = true; return { ok: false, why: 'store' }; }
    if (!writeTombstones(tombstoned.filter(id => id !== free))) { state.writeFailed = true; return { ok: false, why: 'store' }; }
  }
  if (!writeIndex({ v: 1, active: free, ids: [...idx.ids, free] })) { state.writeFailed = true; return { ok: false, why: 'store' }; }
  leaveProfile();
  return { ok: true, id: free };
}
