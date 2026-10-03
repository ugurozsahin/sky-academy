// The rest prompt's clock (#940): visible minutes since the game opened, or since the line was last shown.
// Pure apart from the injected clock; a reload starts at zero and hidden time is never counted.
import type { RestSetting } from '../device-settings';

/** One calm line, no streaks, coins or losses (ICO Children's Code, Standard 5). */
export const REST_LINE = 'Great training! Time for a little break — stretch, have a drink, and come back later.';

/** Whether `elapsedMs` of visible play has reached the grown-up's setting. `off` is never due. */
export function restDue(elapsedMs: number, setting: RestSetting): boolean {
  return setting !== 'off' && elapsedMs >= Number(setting) * 60_000;
}

export interface RestClock { show(visible: boolean): void; elapsed(): number; reset(): void }

/** `now` is injected so the unit test needs no real clock. `show(true|false)` is told when the page becomes visible or hidden. */
export function createRestClock(now: () => number, visibleAtStart = true): RestClock {
  let banked = 0, since: number | null = visibleAtStart ? now() : null;
  return {
    show(visible) {
      if (visible && since === null) since = now();
      else if (!visible && since !== null) { banked += Math.max(0, now() - since); since = null; }
    },
    elapsed: () => banked + (since === null ? 0 : Math.max(0, now() - since)),
    reset() { banked = 0; if (since !== null) since = now(); },
  };
}

/** The game's one clock, started when this module loads; `main.ts` tells it when the page is hidden or shown. Nothing persists it. */
export const restClock: RestClock = createRestClock(Date.now, typeof document === 'undefined' || document.visibilityState === 'visible');
