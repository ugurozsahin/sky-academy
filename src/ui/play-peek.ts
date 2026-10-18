// The no-voice sentence peek (#65), split out of `createPlaySession` (#1501). A sentence is shown for
// NO_VOICE_PEEK_MS of un-paused time, then hidden: `left` is the time still to run, `since` when the current run
// started, `done` what the hide releases (the wave launch, for the first peek of a question). The pause overlay
// stops the clock (`pause(true)`) and restarts it (`pause(false)`), so a child who pauses mid-sentence finds it
// still there on resume. Nothing here writes `arena.paused`: every change calls `sync()`, which is the screen's
// one sum of reasons (play-session.ts's `syncPaused`, the single writer a guard rail names).
import type { Question } from '../curriculum';
import { scaled } from '../game/speed';
import { esc } from './dom';
import { setHint } from './hud';
import type { PlaySessionEls } from './play-session';

/** A visual equivalent of hearing a sentence once: look, remember, then build. */
export const NO_VOICE_PEEK_MS = 3000;

export interface PeekDeps {
  els: Pick<PlaySessionEls, 'prompt' | 'hint'>;
  later: (fn: () => void, ms: number) => void;       // alive-guarded timer (#35)
  mounted: () => boolean;
  current: () => Question | null;                    // the question now on the card
  held: () => boolean;                               // the pause overlay (or another hold) is open
  sync: () => void;                                  // recompute `arena.paused` from every reason
  hiddenHTML: (q: Question) => string;               // the prompt once the sentence is hidden
}

export interface Peek {
  /** True while a sentence is on the card for its look. */
  readonly active: boolean;
  /** Drop a peek without finishing it — a new question, a slice, or teardown made it moot. */
  release(): void;
  /** Show the sentence and start (or resume) its clock. `then` runs when it hides — nothing, for a repeat. */
  show(q: Question, then: (() => void) | null): void;
  /** A hold opened (stop the clock) or closed (restart it); only does anything while a peek is up. */
  pause(open: boolean): void;
}

export function createPeek(d: PeekDeps): Peek {
  let token = 0; let active = false; let left = 0; let since = 0; let done: (() => void) | null = null;
  function run(q: Question) {
    const mine = ++token; since = performance.now();
    d.later(() => {
      if (mine !== token || d.current() !== q || !d.mounted()) return;
      d.els.prompt.innerHTML = d.hiddenHTML(q);
      setHint(d.els, q.peekHint ?? 'Slice the words in order');
      const then = done; active = false; done = null;
      d.sync();
      then?.();
    }, left);
  }
  return {
    get active() { return active; },
    release() {
      if (!active) return;
      token++; active = false; done = null;
      d.sync();
    },
    show(q, then) {
      d.els.prompt.innerHTML = esc(q.listen!);
      setHint(d.els, 'Look, remember, then build it');
      active = true; left = scaled(NO_VOICE_PEEK_MS); done = then;
      d.sync();
      if (!d.held()) run(q);
    },
    pause(open) {
      const q = d.current();
      if (!active || !q) return;
      if (open) { left = Math.max(0, left - (performance.now() - since)); token++; }   // stop the clock
      else run(q);                                                                     // and restart it
    },
  };
}
