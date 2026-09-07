// Shared scaffolding for the full-screen game screens (play + memory). These were copy-pasted between the two
// screens (#35): the alive-guarded timer helper, the #toast helper, teardown, and the "new sticker" markup.
import { AVATARS, VILLAIN } from '../avatars';
import { $ } from './dom';

export interface ScreenScope {
  /** Run `fn` after `ms`, but only while the screen is still alive; the timer is tracked for teardown. */
  later(fn: () => void, ms: number): void;
  /** Show the `#toast` message with an optional class, auto-hiding after `ms`. */
  toast(text: string, cls?: string, ms?: number): void;
  /** Whether the screen is still mounted (false once `dispose()` has run). */
  readonly alive: boolean;
  /** Tear down the shared scaffolding: stop pending timers, cancel speech, drop the `window.__sna` hooks.
   *  A screen with extra resources (an arena, a tracer, an interval) disposes those alongside this call. */
  dispose(): void;
}

/** Build the per-screen scaffolding. One `alive` flag + timer list backs `later`, `toast` and `dispose`. */
export function screenScope(): ScreenScope {
  let alive = true;
  const timers: number[] = [];
  const scope: ScreenScope = {
    get alive() { return alive; },
    later(fn, ms) { const t = window.setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); },
    toast(text, cls = '', ms = 1300) {
      const el = $('#toast'); el.textContent = text; el.className = `toast show ${cls}`;
      scope.later(() => el.classList.remove('show'), ms);
    },
    dispose() { alive = false; timers.forEach(clearTimeout); try { speechSynthesis.cancel(); } catch { /* ignore */ } delete window.__sna; },
  };
  return scope;
}

/** The "New sticker!" unlock cards for the avatars freshly earned this game — shown on both results modals. */
export function stickersHTML(fresh: string[]): string {
  return fresh.map(id => {
    const a = AVATARS.find(x => x.id === id);
    return `<div class="unlock" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${a ? a.img : VILLAIN.img}" alt=""></span><b>New sticker!</b><small>${a ? a.name : VILLAIN.name}</small></div>`;
  }).join('');
}
