import { avatarById, praiseLine, SENSEI, SENSEI_LINES, VILLAIN } from '../avatars';
import { topicById, topicsFor, type Question, type Topic } from '../curriculum';
import { Arena, hittable } from '../game/arena';
import { missSlips, type SessionResult, type Miss, type Resume, type SessionOpts } from '../game/session';
import { MODES } from '../game/modes';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';   // #32: test-only time compression
import type { Tracer } from '../game/tracing';
import {
  isReadOnlySave, isWriteFailing, load, recordAccuracy, recordBossWin, recordCert, recordEndless, recordGameEnd, recordTraining, save, touchStreak, wallet,
} from '../storage';
import { equippedItem } from '../game/shop';
import { canHear, haptic, hush, say, sfx, sliceFx } from '../audio';
import { $, esc, render } from './dom';
import { pushBackGuard, screenScope } from './screen';
import { createHud } from './hud';
import { inputFor, inputMarkup, mountTracer } from './play-input';   // #1064: how a child answers
import { BOMB, createPlaySession, type ResultPayout } from './play-session';   // #36: the Session callbacks live in play-session.ts
import { createResultsScreen, PRACTICE_PAYOUT } from './play-results';   // #896: the results overlay lives in play-results.ts
import { recordMissionOutcome, recordSprintOutcome, type ResultCandidate } from './results';
import { pauseHTML, stageClearHTML } from './overlays';
import { certToStored, certWords, drawCertificate, type CertInfo } from './certificate';
import type { PlayHooks } from './hooks';

export type PlayOpts = Pick<SessionOpts, 'year' | 'topic' | 'mode' | 'pool' | 'weights' | 'deck' | 'practice' | 'resume' | 'legend'>;   // pool = Sensei training; resume = #931

export function playScreen(o: PlayOpts, goHome: () => void, replay: () => void, next: (t: Topic) => void, fix: (m: Miss[]) => void, retry: (r: Resume) => void) {
  const d = load(); const av = avatarById(d.avatar);
  const trailItem = equippedItem(wallet(), 'trail');
  const skin = trailItem?.trail;   // shop slice-trail skin (#6); undefined = the avatar's element colours
  const fx = trailItem?.fx ?? av.fx;   // a bought element trail overrides the avatar's own particle/sound effect too (#69)
  const input = inputFor(o); const tracing = input === 'tracing'; const bubbles = input === 'bubbles';
  const spec = MODES[o.mode];
  const sprint = spec.timed; const boss = spec.boss; const training = spec.staged && !!o.pool && !o.practice;
  const villainMode = spec.villain;                     // Hammer Man on screen, TNT bubbles in the mix
  const title = o.practice ? 'Fix my mistakes' : spec.staged ? (training ? 'Sensei Training' : o.topic!.title) : spec.title;
  render(`
  <section class="screen play ${tracing ? 'tracing' : ''}" style="--glow:${av.glow}">
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
  let arena: Arena | null = null; let tracer: Tracer | null = null; let paused = false;   // #884: mirrors the Pause overlay, for state()
  let lastCert: CertInfo | null = null;   // the one CertInfo actually filed (#410) — hooks read this, not a fresh certInfo() call
  const scope = screenScope();                    // #35: alive-guarded timers, the #toast helper and teardown, shared with the memory screen
  const { later, toast, holdTimers, onHidden, onBack } = scope; onHidden(() => { hush(); pauseIfLive(); }); onBack(pauseIfLive); pushBackGuard();   // #885, #887
  const hud = createHud(els, o.year.lives, canHear);   // #36: HUD writers live in hud.ts
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
  const HOLD = sprint ? { correct: 350, wrong: 1000, miss: 800 } : { correct: 1000, wrong: 1800, miss: 1500 };

  // #896: the results overlay lives in play-results.ts. `hold` is a thunk rather than `playSession` itself —
  // `playSession` is assigned just below and `showResults` is only ever called once gameplay ends, long after
  // this object is built — the same TDZ-safe pattern `mounted` below uses for `hooks`.
  const showResults = createResultsScreen({
    training, year: o.year, topic: o.topic, av, name: d.name, els, hold: (open, beats) => playSession.hold(open, beats),
    later, toast, replay, goHome, cleanup, next, fix, retry, practice: !!o.practice,
  });

  // #36: the Session callbacks — the question beat, the outcome beat, the sprint clock, the boss reactions —
  // and the state only they touch live in play-session.ts. This screen keeps the markup, the arena, the
  // overlays and the test hooks, and hands the callbacks the few things they need from up here.
  const playSession = createPlaySession({
    mode: o.mode, year: o.year, topic: o.topic, weights: o.weights, deck: o.deck, practice: o.practice, resume: o.resume, legend: o.legend, slower: d.settings.slow,
    pool: o.pool ?? (o.mode !== 'mission' ? topicsFor(o.year.id).filter(t => t.input !== 'tracing') : undefined),
  }, {
    training, tracing, villain: villainMode, av, els, hud, hold: HOLD,
    arena: () => arena,
    mounted: () => window.__sna === hooks,        // the screen the callbacks were built for is still the live one
    later, toast, holdTimers,
    startTrace, showTutorial, showTaunt, showStageClear, commitResult, showResults,
  });
  const { session, waveEnd } = playSession;
  hud.drawLives(o.year.lives); hud.drawTimer(session.secondsLeft); hud.drawHp(session.bossHp, session.bossMax);
  // Sprint clock: real elapsed time, frozen while the pause overlay (or a result) has the arena paused.
  let ticker = 0; let lastTick = 0;
  if (session.clocked) ticker = window.setInterval(() => {
    const now = performance.now();
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!arena?.paused && !session.ended) session.tick(dt);
  }, 100);

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
      trailColor: skin?.color ?? av.glow, trailCore: skin?.core, fx,
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

  function startTrace(q: Question) { tracer?.destroy(); tracer = mountTracer(q, { hit: a => session.hit(a), toast, glow: av.glow }); }
  /** First-play demo: show the animated hand over the arena; returns how long to hold the first wave (ms). */
  function showTutorial(): number {
    const t = $('#tutorial'); if (!t || !t.hidden) return 0;
    if (load().tutorialSeen || session.questionsAsked > 1) return 0;   // only ever before the very first wave
    t.hidden = false; say(SENSEI_LINES.tutorial);
    later(hideTutorial, scaled(9000));            // never block play for long, even if the child just watches
    // #138: the hold before the first wave is a game beat too. Shortening it at speed is safe now that the
    // font gate is explicit (#44's gatedSpawn) rather than resting on 1800 ms happening to exceed the cap.
    return scaled(1800);
  }
  function hideTutorial() { const t = $('#tutorial'); if (t) t.hidden = true; }
  /** Repeat the prompt (tap the question card, or the 🔊 button): aloud, or — on a device that cannot be
   *  heard — the hidden sentence is shown again (#65). Never a no-op on a silent device (the #205 rule). */
  function repeatPrompt() {
    const q = session.current; if (!q) return;
    if (!playSession.repeat()) say(q.say ?? q.prompt, true);
    els.qcard.classList.remove('pulse'); void els.qcard.offsetWidth; els.qcard.classList.add('pulse');
  }
  function showTaunt() {
    const t = $('#taunt'); if (!t) return;
    t.textContent = VILLAIN.taunt[Math.floor(Math.random() * VILLAIN.taunt.length)];
    t.hidden = false; later(() => (t.hidden = true), scaled(1400));   // #138
  }

  function showStageClear(stage: number, st: number, acc: number) {
    playSession.hold(true);                       // #65: the one writer of arena.paused is play-session's syncPaused()
    const line = praiseLine(av, d.name); say(line);
    els.overlay.hidden = false;
    els.overlay.innerHTML = stageClearHTML({ glow: av.glow, img: av.img, name: av.name, line, stage, stages: session.stages, starCount: st, acc, score: session.score });
    $('#next').addEventListener('click', () => { sfx.tap(); els.overlay.hidden = true; playSession.hold(false); session.nextStage(); });
  }
  /**
   * Every write a finished game makes (#484, mirroring #375/#441's `commitMatch` for Ninja Duel). This used to
   * run inside `showResults()`, which `onEnd` reaches only through the overlay's own scope-bound `later()` —
   * up to ~1.2 s after the game is actually decided, and both `#pause` and the arena stay live for the whole
   * wait. Quitting in that window (Pause → Islands, or the Android back button) runs `cleanup()` →
   * `scope.dispose()`, which cancels the pending call and, with it, every write below: no coins, no Daily
   * Dojo move, no Sensei accuracy, no certificate, no streak — in Mission, Training, Sprint, Boss and Endless,
   * the modes children play most. `createPlaySession`'s `onEnd` now calls this straight from `session.end()`,
   * synchronously, before the timer is even scheduled — the payout is handed to `showResults()` rather than
   * recomputed there, so the overlay can never pay the game a second time.
   */
  function commitResult(r: SessionResult): ResultPayout {
    if (o.practice) return PRACTICE_PAYOUT; let newBest = false, candidates: ResultCandidate[] = [];   // #930: a fix round writes nothing at all
    // #522 review (silent-failure-hunter): a generator throw is not a genuine finished play of this topic/mode
    // — `recordTopic`'s `plays`/`best` and `recordSprint`/`recordEndless`'s "new best" are permanent per-topic/
    // per-year history, the same kind of record `duel.ts` withholds with its own `!r.incomplete` gate on
    // `recordDuel`. A phantom `plays` increment or an unearned best score would otherwise stick around forever
    // and skew `parents.ts`'s "topics tried" count and `sensei.ts`'s weakest-topic ranking.
    if (!r.incomplete) {
      if (o.mode === 'mission' && o.topic) ({ candidates } = recordMissionOutcome(o.topic, r, !!o.legend));   // #933, #932
      else if (training) { if (r.won) recordTraining(o.year.id); }
      else if (o.mode === 'sprint') ({ newBest, candidates } = recordSprintOutcome(o.year, o.topic, r));   // #911/#912
      else if (o.mode === 'boss') { if (r.won) recordBossWin(o.year.id); }
      else if (o.mode !== 'relaxed') recordEndless(o.year.id, r.score);   // #937: a relaxed run writes no best
    }
    for (const [id, t] of Object.entries(session.byTopic)) recordAccuracy(id, t);   // every mode teaches Sensei what is hard
    const bySubject = (s: Topic['subject']) =>
      Object.entries(session.byTopic).reduce((n, [id, t]) => n + (topicById(id)?.subject === s ? t.hits : 0), 0);
    // #365: one write for the whole finished game — the dojo state and the coins it pays cannot land apart.
    const { dojo, fresh } = recordGameEnd({
      mode: r.mode, won: r.won, correct: r.correct, attempts: r.attempts, bestCombo: r.bestCombo,
      stars: r.stars, score: r.score, training,
      mathsCorrect: bySubject('maths'), writingCorrect: bySubject('writing'), slips: missSlips(r.misses), topics: Object.keys(session.byTopic),   // #938, #939
    }, r.coins);
    const dojoSaved = !isWriteFailing() && !isReadOnlySave(); const streak = touchStreak();   // #518: read before this write overwrites the flag
    const cert = certInfo(r); lastCert = cert;
    // #205: filed when it is *earned*, not when the button works. `certSaved` (#470) is read the instant
    // after that write, per `isWriteFailing()`'s own contract of reflecting only the last attempt — a refusal
    // is not offered to the child as a keepsake the album does not actually hold. `cert` itself stays what
    // was earned regardless: the `certificate()` hook below still answers that, same as before #470.
    const certSaved = cert ? fileCertificate(cert) : false;
    return { newBest, dojo, fresh, streak, cert, certSaved, dojoSaved, candidates };
  }
  /**
   * Keep the certificate this mission earned (#205), and report whether the write actually landed (#470).
   * It is filed the moment the results overlay is built, not from the 🎓 button: the bug #205 opened with is
   * a device where pressing that button does nothing at all, and the child who most needs the certificate
   * kept is the one it silently failed for.
   *
   * Routed through `certToStored()` (#544), the same helper `duel.ts` uses: every stored field, avatar
   * included, is narrowed from the one `CertInfo` (`c`) `certInfo()` already built and `drawCertificate()`
   * will later draw — never a second, independent read of the raw profile — so the album row and the printed
   * keepsake can never disagree about which ninja earned it or which day it was earned on.
   */
  function fileCertificate(c: CertInfo): boolean {
    recordCert(certToStored(c, { id: `${o.year.id}:${training ? 'sensei' : o.topic?.id ?? 'mission'}` }));
    // Both refusal paths (#470 review round 1): `isWriteFailing()` alone missed a write `save()` skipped
    // deliberately under `isReadOnlySave()`'s latch (#232) — the row was offered though the album never got it.
    return !isWriteFailing() && !isReadOnlySave();
  }
  /** Certificate details for a won mission / Sensei session (null for the other modes and lost runs). `date`
   *  is fixed here, at the moment it is earned (#410), rather than left for `certificateText()` to default —
   *  the same object is filed by `fileCertificate()` now and drawn by the 🎓 button later, and both must read
   *  the same instant rather than two calls to `new Date()` a click apart. */
  const certInfo = (r: SessionResult): CertInfo | null =>
    r.won && o.mode === 'mission'
      ? {
          name: d.name, avatar: av, year: o.year.title, title: o.topic?.title ?? 'Sensei training',
          stars: r.stars, score: r.score, correct: r.correct, attempts: r.attempts, training, date: new Date(),
        }
      : null;
  function showPause() {
    playSession.hold(true); paused = true;         // #65: pauses the arena, and stops a sentence peek's clock with it
    els.overlay.hidden = false; els.overlay.innerHTML = pauseHTML();
    $('#resume').addEventListener('click', () => { els.overlay.hidden = true; playSession.hold(false); paused = false; pushBackGuard(); });   // #887
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
  // #884: opens Pause on a live game (no overlay up, not yet ended); a stage-clear/results overlay stays as it is.
  function pauseIfLive(): boolean { if (!els.overlay.hidden || session.ended) return false; showPause(); return true; }
  $('#pause').addEventListener('click', () => { sfx.tap(); showPause(); });
  $('#speak').addEventListener('click', repeatPrompt);
  els.qcard.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; repeatPrompt(); });
  // #35: dispose() stops timers, cancels speech and drops window.__sna.
  function cleanup() {
    clearInterval(ticker); playSession.dispose(); arena?.destroy(); tracer?.destroy(); scope.dispose();
  }

  // Test / accessibility hooks — the typed PlayHooks contract (#34)
  const hooks: PlayHooks = {
    session, arena, get tracer() { return tracer; },
    answer: () => {
      const q = session.current; if (!q) return false;
      if (tracing) { tracer?.autoTrace(); return true; }
      const label = q.sequence ? session.remaining()[0] : q.answer;
      return arena!.hitLabel(label);
    },
    wrong: () => {
      const q = session.current; if (!q || !arena) return false;
      const targets = q.anyOrder ? session.remaining() : [q.sequence ? session.remaining()[0] : q.answer];
      const b = arena.bubbles.find(x => x.launched && !x.dead && !targets.includes(x.label) && x.label !== BOMB);
      return b ? arena.hitLabel(b.label) : false;
    },
    bubbles: () =>
      arena?.bubbles.filter(hittable)
        .map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy, lines: b.lines, labelState: b.labelState })) ?? [],
    state: () => ({
      stage: session.stage, index: session.index, score: session.score, lives: session.lives,
      ended: session.ended, waiting: session.waiting, prompt: session.current?.prompt,
      answer: session.current?.answer, timeLeft: session.timeLeft, questionLeft: session.questionLeft, bossHp: session.bossHp, trail: skin ?? null,
      shots: arena?.shotsThrown ?? 0, topic: session.currentTopic?.id, paused,
    }),
    // PNG data URL of the certificate for the finished mission — the one `CertInfo` actually filed (#410),
    // not a fresh `certInfo()` call: that used to hand back a certificate with its own `new Date()`, live at
    // whatever moment the hook was asked, disagreeing with the day already written to the album.
    certificate: async () => lastCert ? (await drawCertificate(lastCert)).toDataURL('image/png') : null,
    // The words `drawCertificate()` paints, read off the same filed object (#410) — mirrors `ui/duel.ts`'s
    // own `certWords` hook, so an e2e test can check the printed day against the stored one without decoding
    // a PNG.
    certWords: () => lastCert ? certWords(lastCert) : null,
    // #32: test-only time compression — set the multiplier (affects the next wave's flight/stagger and the holds).
    setSpeed: (k: number) => { setGameSpeed(k); },
    // #32: effective outcome holds (ms) and the current multiplier — the normal-speed rail asserts the base holds.
    timing: () => ({ speed: gameSpeed(), hold: { correct: scaled(HOLD.correct), wrong: scaled(HOLD.wrong), miss: scaled(HOLD.miss) } }),
    // #684: the rotating solid on a 3-D Shapes card — name, frames drawn, WebGL up — so e2e can assert it rendered without reading pixels.
    solid: () => playSession.solid(),
    solidArt: () => playSession.solidArt(),
  };
  window.__sna = hooks;
  session.start();
  return cleanup;                    // the router calls this when it leaves the screen (back button included) — see #73
}
