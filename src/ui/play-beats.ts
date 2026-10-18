// The play screen's beat helpers, split out of play.ts (#1503, mirroring #896's play-results.ts and #36's
// play-session.ts): the tracer mount, the first-play tutorial, the Hammer Man taunt, the question-card repeat
// and the stage-clear cue, wired to the screen through one deps object rather than living in playScreen()'s
// own closure. #138: the tutorial hold, its auto-hide, the taunt and the cue are game beats, so they go
// through scaled() exactly as they did up there.
import { praiseLine, tutorialLine, VILLAIN, type Avatar } from '../avatars';
import type { ScreenScope } from './screen';
import type { Question } from '../curriculum';
import type { Session } from '../game/session';
import type { Tracer } from '../game/tracing';
import { scaled } from '../game/speed';   // #32: test-only time compression
import { say, sfx } from '../audio';
import { load } from '../storage';
import { $ } from './dom';
import { mountTracer } from './play-input';
import { stageClearHTML } from './overlays';
import type { PlaySession } from './play-session';

export interface PlayBeatsDeps {
  /** Thunks, not the objects: `session` and `playSession` are assigned after this factory runs, and every beat fires long after. */
  session: () => Session; playSession: () => PlaySession;
  d: Parameters<typeof tutorialLine>[0] & { name: string }; yearId: Parameters<typeof tutorialLine>[1]; av: Avatar;
  els: { qcard: HTMLElement; overlay: HTMLElement };
  later: ScreenScope['later']; toast: ScreenScope['toast'];
}

export function createPlayBeats(x: PlayBeatsDeps) {
  const { d, av, els, later, toast } = x;
  let tracer: Tracer | null = null;
  function startTrace(q: Question) { tracer?.destroy(); tracer = mountTracer(q, { hit: a => x.session().hit(a), toast, glow: av.glow }); }
  /** First-play demo: show the animated hand over the arena; returns how long to hold the first wave (ms). */
  function showTutorial(): number {
    const t = $('#tutorial'); if (!t || !t.hidden) return 0;
    if (load().tutorialSeen || x.session().questionsAsked > 1) return 0;   // only ever before the very first wave
    t.hidden = false; say(tutorialLine(d, x.yearId));
    later(hideTutorial, scaled(9000));            // never block play for long, even if the child just watches
    // #138: the hold before the first wave is a game beat too. Shortening it at speed is safe now that the
    // font gate is explicit (#44's gatedSpawn) rather than resting on 1800 ms happening to exceed the cap.
    return scaled(1800);
  }
  function hideTutorial() { const t = $('#tutorial'); if (t) t.hidden = true; }
  /** Repeat the prompt (tap the question card, or the 🔊 button): aloud, or — on a device that cannot be
   *  heard — the hidden sentence is shown again (#65). Never a no-op on a silent device (the #205 rule). */
  function repeatPrompt() {
    const q = x.session().current; if (!q) return;
    if (!x.playSession().repeat()) say(q.say ?? q.prompt, true);
    els.qcard.classList.remove('pulse'); void els.qcard.offsetWidth; els.qcard.classList.add('pulse');
  }
  function showTaunt() {
    const t = $('#taunt'); if (!t) return;
    t.textContent = VILLAIN.taunt[Math.floor(Math.random() * VILLAIN.taunt.length)];
    t.hidden = false; later(() => (t.hidden = true), scaled(1400));   // #138
  }
  function showStageClear(stage: number, st: number, acc: number) {
    const ps = x.playSession(); const s = x.session();
    ps.hold(true);                                // #65: the one writer of arena.paused is play-session's syncPaused()
    const line = praiseLine(av, d.name); say(line);
    els.overlay.hidden = false;
    els.overlay.innerHTML = stageClearHTML({ glow: av.glow, img: av.img, name: av.name, line, stage, stages: s.stages, starCount: st, acc, score: s.score });
    $('#next').addEventListener('click', () => { sfx.tap(); els.overlay.hidden = true; ps.hold(false); s.nextStage(); });
  }
  return { startTrace, showTutorial, hideTutorial, repeatPrompt, showTaunt, showStageClear, tracer: () => tracer };
}
