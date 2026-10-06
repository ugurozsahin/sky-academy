// Device-wide settings (#904, moved out of storage.ts's own #714 ratchet cap) — today just the 3-D pictures
// control, with room for #905/#906/#907/#940 to each add their own device-wide setting alongside it.
// `storage.ts` re-exports every name here, so no importer's path changes. This module never imports back from
// `storage.ts` — the dependency runs the other way — so the read below is its own two-line try/catch rather
// than storage's own private `readItem`, the same contract.
const readItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };

/* ─── 3-D: the grown-ups' setting (#714) ───────────────────────────────────────────────────────────────────
 * Device-wide, not part of a profile's save: it answers "can this tablet manage 3-D", so it survives a profile
 * switch and a `reset()`, and it is not in the save code. The key is spelt again in
 * `src/three/mount/enabled.ts`, which reads it without importing this module (its chunk must reach back into
 * nothing — the comment there says why; the type is imported from `storage.ts`, which re-exports it from
 * here); `tests/unit/three.test.ts` exercises the two spellings against the same stored value. */
export type ThreeSetting = 'auto' | 'on' | 'off';
const THREE_KEY = 'sna:three';
export const THREE_SETTINGS: readonly ThreeSetting[] = ['auto', 'on', 'off'];
export function threeSetting(): ThreeSetting {
  const raw = readItem(THREE_KEY);
  return raw === 'on' || raw === 'off' ? raw : 'auto';
}
/** `auto` is the default, so it is stored as the absence of a value rather than a third spelling. Returns whether
 *  the store now holds `v`: a refused write (private mode, quota) leaves the device on its previous answer, and
 *  the control that asked must paint that answer, not the tap (silent-failure review of #714). */
export function setThreeSetting(v: ThreeSetting): boolean {
  try { if (v === 'auto') localStorage.removeItem(THREE_KEY); else localStorage.setItem(THREE_KEY, v); } catch { /* fall through to the read */ }
  return threeSetting() === v;
}

/* ─── Rest prompt: the grown-ups' "Suggest a break" setting (#940) ───────────────────────────────────────────
 * Device-wide like the 3-D setting: a break rule belongs to the grown-up's device, not a child's save, so it
 * survives a profile switch and is not in the export code. `off` is the default, stored as absence. */
export type RestSetting = 'off' | '10' | '20' | '30';
const REST_KEY = 'sna:rest';
export const REST_SETTINGS: readonly RestSetting[] = ['off', '10', '20', '30'];
export function restSetting(): RestSetting {
  const raw = readItem(REST_KEY);
  return raw === '10' || raw === '20' || raw === '30' ? raw : 'off';
}
/** Returns whether the store now holds `v` — a refused write leaves the previous answer, and the control paints that. */
export function setRestSetting(v: RestSetting): boolean {
  try { if (v === 'off') localStorage.removeItem(REST_KEY); else localStorage.setItem(REST_KEY, v); } catch { /* fall through to the read */ }
  return restSetting() === v;
}

/* ─── Warning beep: the grown-ups' "Beep 2 seconds before time runs out" (#1121) ─────────────────────────────
 * Device-wide like the rest: an access arrangement belongs to the tablet in the grown-up's hands. Off is the
 * default, stored as absence; on is `'on'`. */
const BEEP_KEY = 'sna:beep';
export const beepSetting = (): boolean => readItem(BEEP_KEY) === 'on';
/** Returns whether the store now holds `on` — a refused write leaves the previous answer, and the control paints that. */
export function setBeepSetting(on: boolean): boolean {
  try { if (on) localStorage.setItem(BEEP_KEY, 'on'); else localStorage.removeItem(BEEP_KEY); } catch { /* fall through to the read */ }
  return beepSetting() === on;
}
