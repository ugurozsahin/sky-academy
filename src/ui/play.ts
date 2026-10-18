import { avatarById, SENSEI, VILLAIN, voiced } from '../avatars';
import { topicsFor, type Topic } from '../curriculum';
import { Arena } from '../game/arena';
import type { Miss, Resume, SessionOpts } from '../game/session';
import { holdFor } from '../game/modes'; import { timeOptsFor } from '../game/time-options';
import { scaled } from '../game/speed'; import { calmReduced, playStyleAttr } from '../device-settings';   // #32: test-only time compression; #906; #907
import { answerableBy } from '../game/pools'; import { createHud, heartCount } from './hud';   // #1065: one pool rule
import { load, save, wallet } from '../storage';
import { equippedItem } from '../game/shop';
import { canHear, haptic, sfx, sliceFx } from '../audio';
import { $, esc, render } from './dom';
import { pushBackGuard, screenScope } from './screen';
import { createPlayBeats } from './play-beats'; import { inputFor, inputMarkup, mountPad, type PlayInput } from './play-input'; import { seedRng } from '../game/daily-sprint';   // #1064: how a child answers
import { BOMB, createPlaySession } from './play-session';   // #36
import { createResultsScreen } from './play-results';   // #896: the results overlay lives in play-results.ts
import { pressKey } from './key-answer'; import { pauseHTML } from './overlays';
import type { PlayHooks } from './hooks';
import { buildHooks } from './play-hooks'; import { createCommit } from './play-commit'; import { startSprintClock } from './play-clock'; import { modeFlags } from './play-flags';

export type PlayOpts = Pick<SessionOpts, 'year' | 'topic' | 'mode' | 'pool' | 'weights' | 'deck' | 'practice' | 'resume' | 'legend'>
  & { input?: PlayInput; title?: string; seed?: string };   // #924: a seed, not an rng, so a replay re-deals the same deck

export function playScreen(o: PlayOpts, goHome: () => void, replay: () => void, next: (t: Topic) => void, fix: (m: Miss[]) => void, retry: (r: Resume) => void) {
  const d = load(); const av = voiced(avatarById(d.avatar), d, o.year.id);
  const trailItem = equippedItem(wallet(), 'trail');
  const skin = trailItem?.trail;   // shop slice-trail skin (#6); undefined = the avatar's element colours
  const fx = trailItem?.fx ?? av.fx;   // a bought element trail overrides the avatar's own particle/sound effect too (#69)
  const input = inputFor(o); const tracing = input === 'tracing'; const bubbles = input === 'bubbles';
  const { spec, sprint, boss, training, villainMode, title } = modeFlags(o);
  render(`
  <section class="screen play ${tracing ? 'tracing' : ''}" ${playStyleAttr(av.glow)}>
    ${bubbles ? inputMarkup(input) : ''}
    <div class="hud">
      <div class="hud-top">
        <button class="icon-btn" id="pause" aria-label="Pause">⏸</button>
        ${sprint ? '<div class="timer" id="timer" aria-live="polite" aria-label="Time left"></div>' : '<div class="lives" id="lives" aria-live="polite"></div>'}
        <div class="score"><small>SCORE</small><b id="score">0</b></div>
      </div>
      <div class="qcard" id="qcard">
        <div class="qhead"><span class="pill" id="stage"></span><span class="ttl">${esc(title)}</span><button class="icon-btn speak" id="speak" aria-label="Read the question aloud" title="Tap the card to hear it again">🔊</button></div>
        <div class="prompt" id="prompt"></div>
        <div class="vis-wrap" id="vis"></div>
        <div class="hint" id="hint"></div>
      </div>
      ${bubbles ? '' : inputMarkup(input)}
      <div class="toast" id="toast" aria-live="polite"></div>
      ${villainMode ? `<div class="villain${boss ? ' boss' : ''}" id="villain">${boss ? '<div class="hp" role="progressbar" aria-label="Hammer Man health"><i id="hp"></i></div>' : ''}<img src="${VILLAIN.img}" alt="Hammer Man"><span class="bubble" id="taunt" hidden></span></div>` : ''}
    </div>
    ${bubbles && !d.tutorialSeen ? `<div class="tutorial" id="tutorial" hidden aria-hidden="true"><div class="tut-sensei"><img src="${SENSEI.img}" alt=""></div><div class="tut-bubble">3</div><div class="tut-hand">☝️</div><div class="tut-text">Slice the bubble!</div></div>` : ''}
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const els = {
    lives: $('#lives'), score: $('#score'), stage: $('#stage'), prompt: $('#prompt'), vis: $('#vis'), hint: $('#hint'),
    overlay: $('#overlay'), qcard: $('#qcard'), speak: $('#speak'),
  };
  let arena: Arena | null = null; let paused = false; const pad = mountPad(input, () => session, scaled);   // #884: mirrors the Pause overlay; #1119: the number pad
  const scope = screenScope();                    // #35: alive-guarded timers, the #toast helper and teardown, shared with the memory screen
  const { later, toast, holdTimers, onHidden, onBack } = scope; onHidden(() => playSession.hidden(pauseIfLive)); onBack(pauseIfLive); pushBackGuard();   // #885, #887
  const hud = createHud(els, heartCount(spec.hasLives, o.year.lives), canHear);   // #36: HUD writers live in hud.ts
  // Outcome beat: after a slice the wave freezes and the result is shown (✓ on the sliced bubble, or ✗ next to the glowing
  // right answer; the card fills in the answer) for `hold` ms, then a short gap before the next question. Sprint stays brisk.
  // Curriculum base holds (ms). #32: scaled(...) divides them by the test-only speed at each use site, so the
  // game a child plays holds for the full time while the e2e suite can run them several times faster.
  // #138: every scheduled beat THIS file still owns goes through scaled() — the tutorial hold before the
  // first wave and its auto-hide, the taunt, the results cue. The beats that read HOLD (the outcome holds,
  // the inter-question gap, the tracing advance, the results floor) moved to play-session.ts with #36 and
  // are scaled there. One thing here deliberately is NOT scaled, and a guard rail would be wrong to touch
  // it: the sprint ticker below samples the REAL clock — speed.ts must never speed the clock up, which is
  // the mistake this repo has made four times.
  const HOLD = holdFor(o.mode);

  // #896: the results overlay lives in play-results.ts. `hold` is a thunk rather than `playSession` itself —
  // `playSession` is assigned just below and `showResults` is only ever called once gameplay ends, long after
  // this object is built — the same TDZ-safe pattern `mounted` below uses for `hooks`.
  const showResults = createResultsScreen({
    training, year: o.year, topic: o.topic, av, name: d.name, els, hold: (open, beats) => playSession.hold(open, beats),
    later, toast, replay, goHome, cleanup, next, fix, retry, deck: o.deck, practice: !!o.practice,
  });

  const commit = createCommit({ o, d, av, training, ps: () => playSession });   // #1504: what a finished game writes
  // #1503: the beat helpers (tracer mount, tutorial, taunt, repeat, stage-clear cue) live in play-beats.ts; `session` and
  // `playSession` are assigned below, so they go in as thunks.
  const beats = createPlayBeats({ session: () => session, playSession: () => playSession, d, yearId: o.year.id, av, els, later, toast });
  const { startTrace, showTutorial, hideTutorial, repeatPrompt, showTaunt, showStageClear } = beats;
  // #36: the Session callbacks — the question beat, the outcome beat, the sprint clock, the boss reactions —
  // and the state only they touch live in play-session.ts. This screen keeps the markup, the arena, the
  // overlays and the test hooks, and hands the callbacks the few things they need from up here.
  const playSession = createPlaySession({
    mode: o.mode, year: o.year, topic: o.topic, weights: o.weights, deck: o.deck, practice: o.practice, resume: o.resume, legend: o.legend, ...timeOptsFor(o.mode, d.settings),
    rng: seedRng(o.seed), pool: o.pool ?? (o.mode !== 'mission' ? topicsFor(o.year.id).filter(t => answerableBy(t, 'mixed')) : undefined),
  }, {
    training, tracing, villain: villainMode, av, els, hud, hold: HOLD,
    arena: () => arena,
    mounted: () => window.__sna === hooks,        // the screen the callbacks were built for is still the live one
    later, toast, holdTimers,
    startTrace, startPad: pad.next, showTutorial, showTaunt, showStageClear, commitResult: commit.commitResult, showResults,
  });
  const { session, waveEnd } = playSession;
  hud.drawLives(o.year.lives); hud.drawTimer(session.secondsLeft); hud.drawHp(session.bossHp, session.bossMax);
  const stopClock = startSprintClock(session, () => !!arena?.paused || paused);   // the real clock, frozen under Pause (#1504)

  if (bubbles) {
    arena = new Arena($('#arena') as HTMLCanvasElement, {
      onHit(b, viaSwipe) {
        if (!load().tutorialSeen) { save({ tutorialSeen: true }); hideTutorial(); }
        if (b.label === BOMB) {
          if (!session.waiting && !session.ended) {
            sfx.life(); toast('TNT! Hammer Man got you', 'bad'); showTaunt();
            arena!.burst(b.x, b.y, '#ff3b1a', 30); session.bomb();
          }
          return;
        }
        const r = session.hit(b.label);
        if (r === 'ignored') return;
        if (viaSwipe) { (sliceFx[fx] ?? sfx.slice)(); haptic('slice'); }
      },
      onFall(b) { if (b.label !== BOMB) session.fall(b.label); },
      onWaveEnd: waveEnd,   // the beat lives with the callbacks (#36): it reads the outcome still being shown
    }, {
      trailColor: skin?.color ?? av.glow, trailCore: skin?.core, fx, reducedMotion: calmReduced(),
      onSwish: () => sfx.swish(),
      // A tap throws the ninja's projectile: the whoosh goes with the throw, the element slice with the pop (#48).
      onThrow: () => sfx.whoosh(),
      onLand: () => { (sliceFx[fx] ?? sfx.slice)(); haptic('slice'); },
      // The TNT blows up under the finger — never chase it with a star, or it would burst twice and reward the hit.
      throwFor: b => b.label !== BOMB, isHazard: label => label === BOMB,   // #742: TNT never re-enters play as a "free chance"
      // #684: the rotating solid inside a 3-D Shapes bubble, tinted to the bubble's complement.
      labelArt: (label, colour, phase) => playSession.bubbleArt(label, colour, phase),
    });
  }

  function showPause() {
    playSession.hold(true); paused = true;         // #65: pauses the arena, and stops a sentence peek's clock with it
    els.overlay.hidden = false; els.overlay.innerHTML = pauseHTML();
    $('#resume').addEventListener('click', () => { els.overlay.hidden = true; playSession.hold(false); paused = false; pushBackGuard(); });   // #887
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
  // #884: opens Pause on a live game (no overlay up, not yet ended); a stage-clear/results overlay stays as it is.
  function pauseIfLive(): boolean { if (!els.overlay.hidden || session.ended) return false; showPause(); return true; }
  $('#pause').addEventListener('click', () => { sfx.tap(); showPause(); }); $('#speak').addEventListener('click', repeatPrompt);
  scope.onKeys({ pause: pauseIfLive, repeat: () => els.overlay.hidden && (repeatPrompt(), true), key: k => pressKey(k, session, arena, !els.overlay.hidden || pad.on) }); // #1074
  els.qcard.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; repeatPrompt(); });
  // #35: dispose() stops timers, cancels speech and drops window.__sna.
  function cleanup() {
    stopClock(); playSession.dispose(); arena?.destroy(); beats.tracer()?.destroy(); pad.destroy(); scope.dispose();
  }

  // Test / accessibility hooks — the typed PlayHooks contract (#34), built in play-hooks.ts (#1504)
  const hooks: PlayHooks = buildHooks({ session, arena, playSession, pad, tracing, skin, HOLD, tracer: () => beats.tracer(), lastCert: commit.lastCert, paused: () => paused });
  window.__sna = hooks;
  session.start();
  return cleanup;                    // the router calls this when it leaves the screen (back button included) — see #73
}
