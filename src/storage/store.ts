// Reading and writing the active profile's save: load, save, reset.
import { DEFAULT, type RawSave, type SaveData } from './shape';
import { saveKeyFor } from './profile-index';
import { dropSessionState, sessionProfile, state } from './state';
import { isFutureSave, migrate } from './migrate';
export function load(): SaveData {
  const id = sessionProfile();
  if (state.cache) return state.cache;
  try {
    const raw = localStorage.getItem(saveKeyFor(id));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Only a *newer* blob is protected. An unreadable `v` is still refused as data (migrate returns the
    // default) but writes resume, so the next save() replaces the corrupt blob and the device recovers.
    state.readOnly = !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && isFutureSave(parsed as RawSave);
    state.cache = raw ? migrate(parsed) : { ...DEFAULT };
  }
  catch { state.readOnly = false; state.cache = { ...DEFAULT }; }
  return state.cache!;
}
export function save(patch: Partial<SaveData> = {}): SaveData {
  state.cache = { ...load(), ...patch };
  // #232: the blob on disk is newer than this build, or carries a version we cannot read. The session keeps
  // working against `cache`; writing would relabel it as our shape and make the loss permanent. Not an
  // attempted write, so it does not touch `writeFailed` either way (#151) — this function only ever sets that
  // flag from an actual `setItem` call, immediately below (`writeIndex`'s callers set it their own way, #384).
  if (state.readOnly) return state.cache;
  try { localStorage.setItem(saveKeyFor(sessionProfile()), JSON.stringify(state.cache)); state.writeFailed = false; }
  catch { state.writeFailed = true; /* private mode, WebView storage disabled, full quota (#151) */ }
  return state.cache;
}
export function reset() { const id = sessionProfile(); dropSessionState(); try { localStorage.removeItem(saveKeyFor(id)); } catch { /* ignore */ } }   // the refused blob is gone, so the latch goes with it (#232); writeFailed is a last-attempt signal, not a diagnosis, so a deliberate fresh start gives it the same benefit of the doubt — the very next save() call sets it again if the browser still refuses (#151)
