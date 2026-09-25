/**
 * The one decision point for 3-D (#713 decision 2, `.claude/rules/three.md`): `threeEnabled()` = built with
 * three ∧ not `?three=off` ∧ the grown-ups' setting ∧ device capability. Every mount point asks it before it
 * downloads anything, and falls back to today's 2-D rendering when it says no — so with the flag off the game
 * is what `main` draws today, pixel for pixel.
 *
 * Pure and injectable: every input arrives in a `ThreeEnv`, and `readEnv()` is the only place the browser is
 * read. A unit test drives each layer on its own without a DOM.
 *
 * Imports nothing from `src/` outside `src/three/`: a mount module is reached by a dynamic `import()` and
 * becomes its own chunk, and `scripts/bundle-single.mjs` can only inline a chunk that reaches back into
 * nothing. That is also why the grown-ups' setting is read straight off `localStorage` here rather than
 * through `src/storage.ts`, which writes it — `tests/unit/three.test.ts` pins the two spellings of the key. The
 * setting's type is the one `src/storage.ts` declares; only the value is spelt twice.
 */
import type { ThreeSetting } from '../../storage';   // a type import is erased, so the chunk boundary below holds
export type { ThreeSetting };
/** Device-wide, not per profile: it answers "can this tablet manage 3-D", not "who is playing". */
export const THREE_SETTING_KEY = 'sna:three';
/** `navigator.deviceMemory` (GiB, Chromium and Android WebView only) below this reads as a low-end tablet. */
export const MIN_DEVICE_MEMORY = 2;
/** Vite replaces this at build time, so `VITE_THREE=off` folds every `if (BUILT_WITH_THREE)` branch away. */
export const BUILT_WITH_THREE = import.meta.env.VITE_THREE !== 'off';

export interface ThreeEnv {
  built: boolean;               // the three chunk exists in this build at all
  search: string;               // `location.search` — `?three=off` wins, for tests and for a stuck device
  setting: ThreeSetting;        // the grown-ups screen's choice
  webgl2: boolean;              // a WebGL2 context can be created
  deviceMemory: number | null;  // GiB where the browser exposes it, null where it does not (Safari)
  reducedMotion: boolean;       // `prefers-reduced-motion: reduce` — the style is idle motion, so none
}

/** The stored value, or `auto` for anything else — a blank slot, an old spelling, a hand-edited string. */
export const parseSetting = (raw: unknown): ThreeSetting => raw === 'on' || raw === 'off' ? raw : 'auto';
/** `?three=off` in the query string. Only `off` exists: a test that wants the flag on runs on a capable browser. */
export const queryOff = (search: string): boolean => new URLSearchParams(search).get('three') === 'off';

/** Whether the device can carry 3-D at all: the `auto` setting's answer. */
export function capable(env: Pick<ThreeEnv, 'webgl2' | 'deviceMemory' | 'reducedMotion'>): boolean {
  if (!env.webgl2 || env.reducedMotion) return false;
  return env.deviceMemory === null || env.deviceMemory >= MIN_DEVICE_MEMORY;
}

export function threeEnabled(env: ThreeEnv = readEnv()): boolean {
  if (!env.built || queryOff(env.search)) return false;
  if (env.setting === 'off') return false;
  // `on` is the grown-up overruling the memory and motion gates, never the absence of WebGL2 — nothing can draw without it.
  if (env.setting === 'on') return env.webgl2;
  return capable(env);
}

/** What `readEnv()` reads; typed as the subset so a test can hand it a plain object. */
export interface BrowserLike {
  location?: { search: string };
  localStorage?: { getItem(k: string): string | null };
  navigator?: { deviceMemory?: number };
  matchMedia?: (q: string) => { matches: boolean };
  document?: { createElement(tag: 'canvas'): { getContext(id: 'webgl2'): unknown } };
}

let webgl2Probe: boolean | null = null;
/**
 * One context, created once and released at once — a browser caps live GL contexts, and this is a question,
 * not a renderer. Memoised for the page's life, so a `null` context during a GPU-process restart reads as
 * "no WebGL2" until the next load: that is said once in the console, because it is the one reason a device
 * shows 3-D after a reload and not before.
 */
export function probeWebgl2(w: BrowserLike): boolean {
  if (webgl2Probe !== null) return webgl2Probe;
  let why = 'no WebGL2 context';
  try {
    const gl = w.document?.createElement('canvas').getContext('webgl2') as { getExtension?(n: string): { loseContext(): void } | null } | null | undefined;
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
    webgl2Probe = !!gl;
  } catch (e) { webgl2Probe = false; why = `the probe threw: ${String(e)}`; }
  if (!webgl2Probe) console.warn(`3-D: ${why}; staying 2-D until the next load`);
  return webgl2Probe;
}
/** Test seam: the probe is memoised for the page's life, and a test needs each answer fresh. */
export const resetProbe = () => { webgl2Probe = null; };

/**
 * The probe runs only when every cheaper layer has passed: `?three=off` is the hatch for a device whose GPU
 * process crash-loops on context creation, so it must not poke that device to find out. An env that a cheaper
 * layer already refused therefore reports `webgl2: false` without having asked.
 */
export function readEnv(w: BrowserLike = globalThis as BrowserLike): ThreeEnv {
  let stored: string | null = null;
  try { stored = w.localStorage?.getItem(THREE_SETTING_KEY) ?? null; } catch { /* a blocked store reads as auto */ }
  const search = w.location?.search ?? '', setting = parseSetting(stored);
  const cheapNo = !BUILT_WITH_THREE || queryOff(search) || setting === 'off';
  return {
    built: BUILT_WITH_THREE,
    search,
    setting,
    webgl2: cheapNo ? false : probeWebgl2(w),
    deviceMemory: typeof w.navigator?.deviceMemory === 'number' ? w.navigator.deviceMemory : null,
    reducedMotion: w.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}
