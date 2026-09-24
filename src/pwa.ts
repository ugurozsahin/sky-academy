// Service worker registration (#15 Part A).
//
// The worker exists so a child can play with no network — on a school iPad in a corridor, on a phone with no
// data left. It is generated into `dist/sw.js` at build time by `scripts/build-sw.mjs`; this file only turns
// it on, and only where turning it on is meaningful.
//
// THERE ARE THREE RUNTIMES, not two, and the worker belongs in exactly one of them.
//
// 1. **The web deployment** — the only place a worker earns its keep. It registers.
// 2. **The single-file build.** `scripts/bundle-single.mjs` inlines this module's code into one HTML page
//    hosted anywhere: an artifact, a `file://` page. There is no `sw.js` next to it, and on some of those
//    origins `register()` does not merely 404 but throws (opaque origin, no secure context). Gated out by the
//    manifest link, which `bundle-single.mjs` strips: a fact about the document rather than a build-time
//    flag, so the two halves cannot drift apart without a guard rail seeing it.
// 3. **The Android APK.** An earlier version of this comment said the single-file page was what shipped
//    inside the APK. That was wrong: `capacitor.config.ts` sets `webDir: 'dist'`, so the APK embeds the
//    ordinary build — manifest link, `sw.js` and all — and serves it from `https://localhost`, which is a
//    secure context. The worker would therefore register there, and it is gated out below on purpose. It
//    would gain nothing (every byte is already local, inside the app bundle) and it would cost something
//    real: that origin is byte-identical for every version of the app, so a cache that survives an APK
//    update would serve the previous release's game with no route back but clearing app data.
//    (Raised in review of #214; see docs/ANDROID.md.)

import { isNativeShell } from './native';

/** The link whose presence means "this page was served from a real deployment that has a worker beside it". */
export const MANIFEST_SELECTOR = 'link[rel="manifest"]';

export type RegisterEnv = {
  doc: Pick<Document, 'querySelector'>;
  nav: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> };
  loc: Pick<Location, 'protocol' | 'hostname'>;
  /** Whether the page is running inside the Android shell (`isNativeShell` in `./native`, #699) — this
   *  module never reads the Capacitor bridge itself. */
  nativeShell: boolean;
};

/**
 * Why registration was or was not attempted. Returned rather than logged so the decision is testable without
 * a browser — a worker silently not registering is exactly the kind of failure that gets noticed months
 * later, by a child on a train.
 */
export type RegisterOutcome = 'registered' | 'failed' | 'no-support' | 'insecure' | 'single-file' | 'native-shell';

/** A worker needs a secure context. `localhost` counts, which is what makes `vite preview` and the e2e run
 *  exercise the real thing rather than a stub. */
function secure(loc: Pick<Location, 'protocol' | 'hostname'>): boolean {
  return loc.protocol === 'https:' || loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
}

export async function registerServiceWorker(env: RegisterEnv): Promise<RegisterOutcome> {
  if (!env.doc.querySelector(MANIFEST_SELECTOR)) return 'single-file';
  if (env.nativeShell) return 'native-shell';
  if (!env.nav.serviceWorker) return 'no-support';
  if (!secure(env.loc)) return 'insecure';
  try {
    await env.nav.serviceWorker.register('sw.js', { scope: './' });
    return 'registered';
  } catch (err) {
    // A failed registration must never stop a child playing: the game works online exactly as it did before
    // any of this existed. The outcome is returned, not swallowed — `main.ts` is what decides to ignore it.
    // The error is bound rather than discarded so a breadcrumb survives in a debugger; this project has no
    // logger (`console.` appears nowhere in src/) and this PR is not the place to invent one.
    void (err as Error);
    return 'failed';
  }
}

/** The production call shape. Separated so the one line that reads real globals is the only untested line. */
export const startServiceWorker = (): Promise<RegisterOutcome> =>
  registerServiceWorker({ doc: document, nav: navigator, loc: location, nativeShell: isNativeShell() });
