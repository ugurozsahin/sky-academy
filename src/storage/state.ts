// What this session has cached of the save, and the two latches that describe it (#232, #151). One object, because a
// `let` cannot be assigned from another module and the profile, load/save and backup code all move these together.
import type { SaveData } from './shape';
import { activeProfile, type ProfileId } from './profile-index';

interface SessionState {
  cache: SaveData | null;
  /** Which profile `cache`, `readOnly` and `writeFailed` are about — see `sessionProfile()`. */
  cacheProfile: ProfileId | null;
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
  readOnly: boolean;
  /**
   * Set when a write to this device's store is refused — `save()`'s own `localStorage.setItem` throwing
   * (private browsing, a WebView with DOM storage disabled, a full quota, #151), **and, since #384 item 2,
   * `addProfile()` or `setActiveProfile()`'s `writeIndex()` call refusing either way it can**: a throw, or a
   * `setItem` that returns without error and a read-back that disagrees (`writeIndex`'s own doc, #330). Distinct
   * from `isReadOnlySave()`: that one refuses to write *deliberately*, to protect a newer save already on disk,
   * and its remedy is "update this device"; this one is the browser refusing an ordinary write, and its remedy
   * is "this browser will not let the game save". Conflating them would send a grown-up to update an app that
   * already writes fine, or wait for a device update that will never fix a private-browsing tab.
   *
   * Reflects only the *last* attempted write, the same way `readOnly` reflects only the last `load()` — a caller
   * that wants to know whether *this* write landed checks it immediately afterwards, before anything else can
   * write again.
   */
  writeFailed: boolean;
}
export const state: SessionState = { cache: null, cacheProfile: null, readOnly: false, writeFailed: false };
/**
 * Whether this session is running on defaults over a stored save it refused to touch (#232).
 *
 * Exported because the refusal is otherwise **silent**: the child plays, nothing persists, and nothing says so.
 * That is the right trade for a newer save — the alternative destroys a save their other device still reads —
 * but it is a state a grown-up should eventually be told about, and this is the hook a "your progress is not
 * being saved" notice would read. That notice is #232's own related item and is not built here.
 */
export const isReadOnlySave = () => state.readOnly;
export const isWriteFailing = () => state.writeFailed;
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
export function sessionProfile(): ProfileId { return state.cacheProfile ?? (state.cacheProfile = activeProfile()); }
/** Forget the cached save and both write latches — they describe one blob (#232's read-only latch and #151's
 *  failed-write flag), and it is about to be a different one. The profile stays: a fresh start is the same
 *  child. */
export function dropSessionState() { state.cache = null; state.readOnly = false; state.writeFailed = false; }
/**
 * The above, **and** the session's profile: only a switch makes this a different child's session.
 *
 * `reset()` deliberately does not do this. It used to, through `dropSessionState()`, and that put back the
 * whole class `sessionProfile()` exists to close: the next read re-resolved, `defaultIndex()` answers `p1`
 * unconditionally, and `parents.ts`'s "Start again" then "Undo" (`snapshot = load(); reset(); save(snapshot)`)
 * wrote the playing child's snapshot into profile 1, over a sibling, with the delete having already taken
 * their own slot — Undo reporting success the whole way (#330 round 2, item 1).
 */
export function leaveProfile() { dropSessionState(); state.cacheProfile = null; }
/**
 * Re-entering the profile the index already calls active — the child tapping their own card on the picker.
 *
 * Two genuinely different situations wear that one shape, and they are told apart by the profile *this
 * session* is playing as rather than by the one the index names:
 *
 * - **A second tab moved `active` while this session played someone else** (`cacheProfile` is a different
 *   child, or nothing has been resolved yet). That is a switch: `leaveProfile()`, so the next read resolves
 *   afresh and puts the child on the card they tapped rather than on whoever this session last cached. The
 *   latches go with it, because they describe the sibling's blob and it is about to be a different one.
 * - **The same child this session is already on.** Re-resolving would answer `id` again, so `cacheProfile`
 *   stays; only the cached blob is a question, and **it is kept whenever a latch says it diverges from disk**
 *   (#380 review round 4, B1). `cache` is then the session's only copy: under `writeFailed` the child is
 *   playing on coins no `setItem` ever accepted, and under `readOnly` on a blob `save()` deliberately never
 *   writes back (#232). Dropping it discarded that silently — the tap answered `true`, `refuse()` was never
 *   reached, and the next `load()` handed back the last blob that reached disk, or `{...DEFAULT}` and the
 *   first-run wizard on a store that had accepted nothing this session. With neither latch set, cache and
 *   disk agree, so it is dropped and the store answers the next read.
 *
 * **Both write latches stay on that second path**, which is the other difference from `leaveProfile()`: they
 * describe *this* child's blob and it is still the same blob, so a device that cannot save must go on saying
 * so (#151's failed-write flag, #232's read-only latch, `parents.ts:35`'s sentence). Clearing them would make
 * the grown-ups screen forget a real fault every time a child tapped their own card.
 */
export function rereadProfile(id: ProfileId) {
  if (state.cacheProfile !== id) { leaveProfile(); return; }
  if (!state.writeFailed && !state.readOnly) state.cache = null;
}
