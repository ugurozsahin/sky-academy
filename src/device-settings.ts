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
