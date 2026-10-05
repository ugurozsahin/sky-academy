import type { Question, Topic } from '../curriculum';
import { Tracer, traceFeedback } from '../game/tracing';
import type { Session } from '../game/session';
import { gameSpeed } from '../game/speed';
import { differentNumber, sameNumber } from '../game/typed';
import { mountKeypad, type KeypadKey } from './keypad';
import { say, sfx } from '../audio';
import { $ } from './dom';

/** How a child answers on the play screen (#1064): slice bubbles, trace a letter, or type on the number pad. */
export type PlayInput = 'bubbles' | 'tracing' | 'keypad';

/** Chosen once per screen, so it cannot depend on a mission's stage difficulty. Explicit, then the topic's, then bubbles. */
export function inputFor(o: { topic?: Topic; input?: PlayInput }): PlayInput {
  return o.input ?? testInput() ?? o.topic?.input ?? 'bubbles';
}

/** `?input=keypad` opens a keypad screen for e2e (#1119) — only at the #32 test speed, which a child can never reach. */
const testInput = (): PlayInput | undefined => gameSpeed() > 1 && new URLSearchParams(location.search).get('input') === 'keypad' ? 'keypad' : undefined;

/** The answering surface's markup: the arena canvas, the tracing pad, or the (empty) keypad mount. */
export function inputMarkup(kind: PlayInput): string {
  if (kind === 'bubbles') return '<canvas id="arena" aria-label="Game arena"></canvas>';
  if (kind === 'keypad') return '<div id="keypad"></div>';
  return '<div class="trace-wrap"><canvas id="trace"></canvas><div class="trace-btns"><button class="btn" id="tclear">Clear</button><button class="btn primary" id="tcheck">Check ✓</button></div></div>';
}

export interface TracerDeps {
  hit: (answer: string) => void;
  toast: (msg: string, kind: 'bad') => void;
  glow: string;
}

/** Mount the letter-tracing pad for one question; the caller owns (and destroys) the returned Tracer. */
export function mountTracer(q: Question, deps: TracerDeps): Tracer {
  const c = $('#trace') as HTMLCanvasElement;
  /** Toast tracing feedback and speak the same words (#895): a child who cannot yet read gets more than a toast.
   *  say() respects the read-aloud setting itself; the em dash becomes a spoken pause, not a read-aloud symbol. */
  const speakTrace = (msg: string) => { deps.toast(msg, 'bad'); say(msg.replace(' — ', ', ')); };
  const tracer: Tracer = new Tracer(c, q.answer, r => {
    if (r.pass) { sfx.correct(); deps.hit(q.answer); return; }
    const msg = traceFeedback(r, q.answer, 'stroke', tracer.strokes); if (msg) speakTrace(msg);
  }, deps.glow);
  $('#tclear').onclick = () => { sfx.tap(); tracer.clear(); };
  $('#tcheck').onclick = () => {
    const r = tracer.result(); if (r.pass) { sfx.correct(); deps.hit(q.answer); return; }
    const msg = traceFeedback(r, q.answer, 'check', tracer.strokes); if (msg) speakTrace(msg);
  };
  return tracer;
}

/** The number pad driving one play screen (#1119); `answer()`/`wrong()` are the `window.__sna` hooks' way of typing on it. */
export interface PadInput { on: boolean; next?(q: Question): void; answer(): boolean; wrong(): boolean; destroy(): void }

/**
 * Mount the keypad branch (#1064) on its `#keypad` element, or an inert one (`on: false`) on any other screen, so the screen never branches on it. ✓ sends the typed number to
 * `session.hit` exactly as a slice would — the card's own answer when it is the same number, so "1,000" and "1000" agree.
 * `session` is a thunk because the pad is built before the Session is.
 */
export function mountPad(kind: PlayInput, session: () => Session, scale: (ms: number) => number): PadInput {
  if (kind !== 'keypad') return { on: false, answer: () => false, wrong: () => false, destroy() {} };
  const live = () => { const s = session(); return !!s.current && !s.waiting && !s.ended; };
  const pad = mountKeypad($('#keypad'), { maxLen: 8, enabled: live }, v => {
    const s = session(); const q = s.current;
    if (q) s.hit(sameNumber(v, q.answer) ? q.answer : v);
    pad.clear();
  });
  const type = (text: string) => {
    if (!live()) return false;
    for (const ch of text) pad.press((ch === '-' ? '−' : ch) as KeypadKey);
    pad.press('enter'); return true;
  };
  return {
    on: true,
    next: () => { pad.clear(); session().armQuestionClock(scale); },   // the clock starts as the card does; a mode without one ignores it
    answer: () => type(session().current?.answer ?? ''),
    wrong: () => type(differentNumber(session().current?.answer ?? '')),
    destroy: () => pad.destroy(),
  };
}
