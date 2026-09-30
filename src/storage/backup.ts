// The save as a code the grown-up can copy to another device, and the way back in.
import { SAVE_VERSION, type RawSave } from './shape';
import { saveKeyFor } from './profile-index';
import { sessionProfile, state } from './state';
import { migrate } from './migrate';
import { load } from './store';
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
  if (state.readOnly) {
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
  state.cache = next;   // `sessionProfile()` above has already latched `cacheProfile` to `id`
  // #232 review: only lift the protection if the replacement actually landed. If setItem threw, the newer
  // blob is still on disk — clearing the latch here would let the next ordinary save() relabel it, which is
  // #232 restored through this very line. (The swallowed catch and the unconditional `true` are older
  // faults, tracked in issue 266, and are not widened here.)
  if (wrote) state.readOnly = false;
  return true;
}
