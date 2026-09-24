// The one owner of the Capacitor bridge (#699): the only file under `src/` that reads `window.Capacitor` or
// a plugin off `Capacitor.Plugins` directly — `pwa.ts` and `ui/certificate.ts` both point here instead of
// reading the global themselves (checked by the guard rail in `tests/unit/guardrails.test.ts`), so a future
// change to how the bridge is detected or accessed has one place to make it.
declare global {
  interface Window { Capacitor?: unknown }
}

interface CapBridge {
  isNativePlatform?: () => unknown;
  getPlatform?: () => unknown;
  platform?: unknown;
  Plugins?: Record<string, unknown>;
}

const bridgeOf = (w: Window & typeof globalThis): CapBridge | undefined => (w as { Capacitor?: CapBridge }).Capacitor;

/**
 * Are we inside the Android APK's Capacitor WebView? (#205, moved here from `ui/certificate.ts` by #699 so
 * every reader of the bridge shares one answer, `wireBackButton` below included.)
 *
 * Capacitor injects a `Capacitor` global into the WebView, so this needs no import and no dependency —
 * `@capacitor/core` stays a devDependency of the build, never of the bundle.
 *
 * **One rule, on the answer rather than on which accessor exists.** An earlier version asked
 * `isNativePlatform()` and otherwise read `cap.platform`, described as "the older spelling". That was
 * simply wrong: the bridge this repository actually ships
 * (`node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js`) sets `cap.getPlatform`
 * and `cap.isNativePlatform` and **no `cap.platform` at all**, so the fallback guarded a shape Capacitor
 * never produces, and a bump that renamed `isNativePlatform` would have restored the silent no-op the
 * comment claimed to prevent. Worse, `isNativePlatform: () => undefined` — a bridge mid-startup — took
 * the *first* branch and returned `undefined` from a function declared `boolean`.
 *
 * So: collect whatever the bridge answers, and treat native as the default unless something says
 * otherwise. The asymmetry is deliberate and is the same one the `catch` below argues for — a browser
 * wrongly shown the full-screen view has seen its certificate; a WebView wrongly sent to `<a download>`
 * has a button that does nothing, which is the bug.
 */
export function isNativeShell(w: Window & typeof globalThis = window): boolean {
  try {
    // The read is inside the `try` too: a getter-based polyfill — exactly the case the catch describes —
    // used to throw straight past this function and toast "Could not make the certificate" for one that
    // had drawn perfectly.
    const cap = bridgeOf(w);
    if (!cap) return false;
    const answers = [
      typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : undefined,
      typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined,
      cap.platform,                        // not in the shipped bridge; kept only for other embeddings
    ];
    // A definite YES wins outright, and it has to: the two accessors CAN disagree, and the shipped bridge
    // can only ever disagree in one direction. `isNativePlatform` is a hard-coded `() => true` in a file
    // that is injected on native only, while `getPlatform()` re-derives from `win.androidBridge` on every
    // call and answers 'web' whenever that interface is not on the window *at that moment* — Capacitor's
    // own code treats this as reachable, guarding `if (getPlatformId(win) === 'android')` before it
    // installs `postToNative`. So `[true, 'web']` is the half-started Android shell, and a veto rule read
    // it as a browser: the swallowed `<a download>` on exactly the runtime this exists for. It also made
    // the function absurd — a bridge SAYING it is native scored lower than one saying nothing at all.
    if (answers.some(a => a === true || (typeof a === 'string' && a !== 'web'))) return true;
    return !answers.some(a => a === false || a === 'web');
  } catch {
    return true;
  }
}

/**
 * A named plugin off the injected bridge (#110), or `undefined` when it has not registered — or there is no
 * bridge at all. `ui/certificate.ts`'s Filesystem/Share access and `wireBackButton`'s own App lookup both
 * read plugins through here rather than `Capacitor.Plugins` directly.
 */
export function plugin<T>(name: string, w: Window & typeof globalThis = window): T | undefined {
  try {
    return bridgeOf(w)?.Plugins?.[name] as T | undefined;
  } catch {
    return undefined;
  }
}

interface AppPlugin { addListener(event: 'backButton', cb: () => void): void }

/**
 * Registers the hardware/gesture back button on the Android APK (#699). `@capacitor/android` on its own
 * leaves every back press to the Android default — finish the activity — because back-press handling lives
 * entirely in the `@capacitor/app` plugin: with no JS listener it calls `webView.goBack()` when possible and
 * otherwise does nothing, and with a listener it defers to JS entirely instead. So this decides: a screen on
 * our own history stack (`history.state?.screen`, the same entry `main.ts`'s own `up()` already reads) steps
 * back through the ordinary `popstate` handler — the identical path the in-game Back button takes, so there
 * is one back logic, not two — and the root (the sky map, nothing on the stack) sends the app to the
 * background (`minimize`) rather than killing the process; the caller must never wire that to `exitApp()`.
 *
 * `bridge`, `history` and `minimize` are all taken as arguments, so the three shapes below are proved in
 * Vitest without a device: no `App` plugin on the bridge (a browser, the PWA, or an APK that failed to sync
 * it) registers nothing; a screen on the stack calls `history.back()` once; the root calls `minimize()` once.
 */
export function wireBackButton(env: {
  bridge: Window & typeof globalThis;
  history: Pick<History, 'back'> & { readonly state: unknown };
  minimize: () => void;
}): void {
  const app = plugin<AppPlugin>('App', env.bridge);
  if (!app || typeof app.addListener !== 'function') return;
  app.addListener('backButton', () => {
    const screen = (env.history.state as { screen?: string } | null)?.screen;
    if (screen) env.history.back(); else env.minimize();
  });
}
