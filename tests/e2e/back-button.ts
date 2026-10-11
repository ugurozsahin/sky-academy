import type { Page } from '@playwright/test';
import type { DuelHooks, PlayHooks } from '../../src/ui/hooks';

/**
 * Fakes just enough of the injected Capacitor bridge (#885) to drive `main.ts`'s real `wireBackButton` call
 * through a browser, with no device: `Plugins.App` so `plugin('App', …)` registers the real listener and
 * hands back its callback as `window.__backCb`, and `getPlatform: () => 'web'` so `isNativeShell()` — read
 * elsewhere by `pwa.ts` and `certificate.ts`, neither under test here — answers exactly as it does with no
 * bridge at all, rather than flipping unrelated native-only behaviour on for the rest of the page.
 *
 * Shared by `game.spec.ts` (the play screen) and `duel.spec.ts` (the duel screen) since #1356, which lands a
 * press on each screen's `pauseIfLive()` guard. Call it before the navigation that boots the app.
 */
export async function fakeBackButton(page: Page) {
  await page.addInitScript(() => {
    (window as any).Capacitor = {
      getPlatform: () => 'web',
      Plugins: {
        App: {
          addListener: (event: string, cb: () => void) => { if (event === 'backButton') (window as any).__backCb = cb; },
          minimizeApp: () => { (window as any).__minimized = ((window as any).__minimized ?? 0) + 1; return Promise.resolve(); },
        },
      },
    };
  });
}
/** Fires the captured `backButton` callback — the hardware/gesture press itself. */
export const pressBack = (page: Page) => page.evaluate(() => (window as any).__backCb());

/**
 * What the live screen looks like the instant a back press has run (#1356). `pauseOpen` is the Pause
 * overlay's own `#resume` button — the one thing `showPause()` renders and nothing else does — and `results`
 * is the results modal, which both screens render as `.modal.results`.
 */
export interface PressSnapshot { ended: boolean; overlayHidden: boolean; paused: boolean; pauseOpen: boolean; results: boolean }
/**
 * End the game the way `how` says, press back, and read the screen — **all in one page task**, so nothing
 * scheduled can land in between: not the results overlay's own `later()` beat, not the `popstate` a
 * fall-through queues (#1356). That is what makes the `ended`-but-no-overlay window a fixed place rather
 * than a race: `session.tick(60_000)` and `duel.waveEnd()` both flip `ended` synchronously and only *schedule*
 * the results, so the press that follows them in the same task is inside the window by construction, and the
 * snapshot's `ended: true, overlayHidden: true` is the proof that it was.
 *
 * `'none'` presses on whatever is up — a results modal a test has already waited for.
 */
export const pressBackThenSnapshot = (page: Page, how: 'end-sprint' | 'end-duel' | 'none') => page.evaluate((how): PressSnapshot => {
  // `window.__sna` is typed per spec file (`PlayHooks & MemoryHooks` in game.spec.ts, `DuelHooks` in
  // duel.spec.ts), so a shared helper reads it through `any` at the boundary and names the union itself; the
  // field names below then belong to hooks.ts, not to a hand-written cast.
  const sna = (window as any).__sna as PlayHooks | DuelHooks;
  if (how === 'end-sprint') (sna as PlayHooks).session.tick(60_000);
  else if (how === 'end-duel') (sna as DuelHooks).duel.waveEnd();
  (window as any).__backCb();
  const s = sna.state();
  const overlay = document.querySelector('#overlay') as HTMLElement;
  return {
    ended: s.ended, paused: s.paused,
    overlayHidden: overlay.hidden,
    // Gated on the overlay being shown: a Resume hides the overlay but leaves the pause markup in it, so
    // presence alone would call a closed Pause open (silent-failure-hunter review).
    pauseOpen: !overlay.hidden && !!overlay.querySelector('#resume'),
    results: !!document.querySelector('.results'),
  };
}, how);
