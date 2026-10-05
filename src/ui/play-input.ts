import type { Question, Topic } from '../curriculum';
import { Tracer, traceFeedback } from '../game/tracing';
import { say, sfx } from '../audio';
import { $ } from './dom';

/** How a child answers on the play screen (#1064): slice bubbles, trace a letter, or type on the number pad. */
export type PlayInput = 'bubbles' | 'tracing' | 'keypad';

/** Chosen once per screen, so it cannot depend on a mission's stage difficulty. Explicit, then the topic's, then bubbles. */
export function inputFor(o: { topic?: Topic; input?: PlayInput }): PlayInput {
  return o.input ?? o.topic?.input ?? 'bubbles';
}

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
