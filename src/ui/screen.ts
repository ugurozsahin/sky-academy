// Shared scaffolding for the full-screen game screens (play + memory). These were copy-pasted between the two
// screens (#35): the alive-guarded timer helper, the #toast helper, teardown, and the "new sticker" markup.
import { AVATARS, VILLAIN } from '../avatars';
import { hush } from '../audio';
import { $, esc, stars } from './dom';

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
    dispose() { alive = false; timers.forEach(clearTimeout); hush(); delete window.__sna; },   // hush() also voids the voice probe (#65)
  };
  return scope;
}

/** The end-of-run results modal, shared by the play overlays and the memory screen (#35). Both screens
 *  used to copy-paste this shell (hero, medal, heading, star row, stat grid, coin row, Play again / Islands
 *  buttons); it now lives here once and the callers fill the slots that actually differ between modes. */
export interface ResultsModalParts {
  ko?: string;             // pre-rendered K.O. banner (boss win only), else the slot is empty
  heroExtra?: string;      // extra classes on `.hero-big` (e.g. ` sad`, ` sensei`), including a leading space
  glow: string; img: string; name: string; headline: string;   // the speaker card
  medal: string; heading: string;
  stars?: number;          // star count for the `big-stars` row; omit to hide it (endless has no stars)
  stats: string;           // inner HTML of the `.statgrid` — the three <div><b>…</b><small>…</small></div> cells
  coins: number; pills?: string;   // the coin gain, then any trailing pills (new-best, day-streak)
  dojoRows: string; stickerHTML: string;   // rendered by the caller (need other modules)
  cert?: boolean;          // show the 🎓 certificate button (play missions only)
}
export function resultsModal(p: ResultsModalParts): string {
  return `
      <div class="modal results">
        ${p.ko ?? ''}
        <div class="hero-big${p.heroExtra ?? ''}" style="--glow:${p.glow}"><img src="${p.img}" alt="${p.name}"><div class="speech">${esc(p.headline)}</div></div>
        <div class="medal">${p.medal}</div>
        <h2>${p.heading}</h2>
        ${p.stars !== undefined ? `<div class="big-stars">${stars(p.stars)}</div>` : ''}
        <div class="statgrid">${p.stats}</div>
        <div class="coin-row"><span class="coin-gain">+${p.coins} 🪙</span>${p.pills ?? ''}</div>
        ${p.dojoRows}
        ${p.stickerHTML}
        ${p.cert ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this mission">🎓 Certificate</button></div>' : ''}
        <div class="row nav"><button class="btn primary big" id="again">Play again</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
}

/** The "New sticker!" unlock cards for the avatars freshly earned this game — shown on both results modals. */
export function stickersHTML(fresh: string[]): string {
  return fresh.map(id => {
    const a = AVATARS.find(x => x.id === id);
    return `<div class="unlock" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${a ? a.img : VILLAIN.img}" alt=""></span><b>New sticker!</b><small>${a ? a.name : VILLAIN.name}</small></div>`;
  }).join('');
}
