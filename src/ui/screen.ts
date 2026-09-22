// Shared scaffolding for the full-screen game screens (play + memory). These were copy-pasted between the two
// screens (#35): the alive-guarded timer helper, the #toast helper, teardown, and the "new sticker" markup.
import { AVATARS, VILLAIN } from '../avatars';
import { hush } from '../audio';
import { $, esc, stars } from './dom';

export interface ScreenScope {
  /** Run `fn` after `ms`, but only while the screen is still alive AND not held; the timer is tracked for
   *  teardown, and `holdTimers(true)` stops its clock with the rest of the screen's beats. */
  later(fn: () => void, ms: number): void;
  /**
   * An overlay opened (`true`) or closed: freeze every pending `later()` beat, or re-arm it with the time it
   * had still to run (#301).
   *
   * The screens already paused their *arena* on an overlay; their **timers** kept running, so a pause pressed
   * inside the ~1 s outcome hold let `clearWave` fire, the wave end, the round advance, and the next question
   * render, speak and spawn its wave — all behind the overlay, with `launchAt` in the past. On resume the child
   * found a wave already flying at a question they had never been shown. The fix belongs here rather than in
   * either screen because both had the same shape and neither could hold a timer it had handed to the browser.
   *
   * Remaining time, not a restart: a beat 900ms into a 1000ms hold has 100ms left, and re-arming it at 1000ms
   * would stretch every pause into an extra hold. Idempotent in both directions — two `true`s in a row must
   * not re-measure what is already frozen and lose the first freeze's remainder.
   */
  holdTimers(open: boolean): void;
  /** Show the `#toast` message with an optional class, auto-hiding after `ms`. */
  toast(text: string, cls?: string, ms?: number): void;
  /** Whether the screen is still mounted (false once `dispose()` has run). */
  readonly alive: boolean;
  /** Tear down the shared scaffolding: stop pending timers, cancel speech, drop the `window.__sna` hooks.
   *  A screen with extra resources (an arena, a tracer, an interval) disposes those alongside this call. */
  dispose(): void;
}

/** One pending `later()`: the browser handle, what to run, and when it is due, so a hold can measure what is
 *  left of it. `due` is re-based on every re-arm, so it is always "due at" and never "was due at". */
interface Beat { id: number; fn: () => void; due: number; }

/** Build the per-screen scaffolding. One `alive` flag + beat list backs `later`, `holdTimers`, `toast` and
 *  `dispose`. */
export function screenScope(): ScreenScope {
  let alive = true;
  let held = false;
  // Kept as a set rather than an array because a beat is removed when it fires, and a screen that runs for ten
  // stages arms hundreds: the old array only ever grew, and a hold would have had to walk every dead handle.
  const beats = new Set<Beat>();
  // `performance.now()` and not `Date.now()`: this measures an interval, and a wall clock that a device
  // adjusts mid-pause would hand back a negative remainder or a minute-long one.
  const now = () => performance.now();
  const arm = (b: Beat, ms: number) => {
    b.due = now() + ms;
    b.id = window.setTimeout(() => { beats.delete(b); if (alive) b.fn(); }, ms);
  };
  const scope: ScreenScope = {
    get alive() { return alive; },
    later(fn, ms) {
      const b: Beat = { id: 0, fn, due: 0 };
      beats.add(b);
      // Armed frozen if the screen is already held — a beat scheduled from inside a held screen (a toast raised
      // by the overlay itself) must not be the one thing still running behind it.
      if (held) b.due = ms; else arm(b, ms);
    },
    holdTimers(open) {
      if (open === held) return;
      held = open;
      for (const b of beats) {
        if (open) { clearTimeout(b.id); b.due = Math.max(0, b.due - now()); }   // `due` now holds the REMAINDER
        else arm(b, b.due);
      }
    },
    toast(text, cls = '', ms = 1300) {
      const el = $('#toast'); el.textContent = text; el.className = `toast show ${cls}`;
      scope.later(() => el.classList.remove('show'), ms);
    },
    // hush() also voids the voice probe (#65)
    dispose() { alive = false; for (const b of beats) clearTimeout(b.id); beats.clear(); hush(); delete window.__sna; },
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
        <div class="scroll">
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
        </div>
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
