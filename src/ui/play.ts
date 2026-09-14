import { avatarById, praiseLine, SENSEI, SENSEI_LINES, senseiLine, VILLAIN } from '../avatars';
import { topicsFor, type Question, type Topic, type YearInfo } from '../curriculum';
import { Arena } from '../game/arena';
import { type Mode, type SessionResult } from '../game/session';
import { MODES } from '../game/modes';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';   // #32: test-only time compression
import { Tracer } from '../game/tracing';
import { addCoins, load, recordAccuracy, recordBossWin, recordDojo, recordEndless, recordSprint, recordTopic, recordTraining, save, touchStreak, wallet } from '../storage';
import { equippedItem } from '../game/shop';
import { canHear, haptic, say, sfx, sliceFx } from '../audio';
import { $, esc, render } from './dom';
import { screenScope, stickersHTML } from './screen';
import { createHud } from './hud';
import { BOMB, createPlaySession } from './play-session';   // #36: the Session callbacks live in play-session.ts
import { pauseHTML, resultsHTML, stageClearHTML } from './overlays';
import { resultMedal, resultHeading } from './results';
import { dojoRowsHTML } from './memory';
import { drawCertificate, deliverCertificate, type CertInfo } from './certificate';
import type { PlayHooks } from './hooks';

export interface PlayOpts { year: YearInfo; topic?: Topic; mode: Mode; pool?: Topic[] }   // pool + mission = Sensei training over the weakest topics

export function playScreen(o: PlayOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const skin = equippedItem(wallet(), 'trail')?.trail;   // shop slice-trail skin (#6); undefined = the avatar's element colours
  const tracing = o.topic?.input === 'tracing';
  const spec = MODES[o.mode];
  const sprint = spec.timed; const boss = spec.boss; const training = spec.staged && !!o.pool;
  const villainMode = spec.villain;                     // Hammer Man on screen, TNT bubbles in the mix
  const title = spec.staged ? (training ? 'Sensei Training' : o.topic!.title) : spec.title;
  render(`
  <section class="screen play ${tracing ? 'tracing' : ''}" style="--glow:${av.glow}">
    ${tracing ? '' : '<canvas id="arena" aria-label="Game arena"></canvas>'}
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
      ${tracing ? '<div class="trace-wrap"><canvas id="trace"></canvas><div class="trace-btns"><button class="btn" id="tclear">Clear</button><button class="btn primary" id="tcheck">Check ✓</button></div></div>' : ''}
      <div class="toast" id="toast" aria-live="polite"></div>
      ${villainMode ? `<div class="villain${boss ? ' boss' : ''}" id="villain">${boss ? '<div class="hp" role="progressbar" aria-label="Hammer Man health"><i id="hp"></i></div>' : ''}<img src="${VILLAIN.img}" alt="Hammer Man"><span class="bubble" id="taunt" hidden></span></div>` : ''}
    </div>
    ${!tracing && !d.tutorialSeen ? `<div class="tutorial" id="tutorial" hidden aria-hidden="true"><div class="tut-sensei"><img src="${SENSEI.img}" alt=""></div><div class="tut-bubble">3</div><div class="tut-hand">☝️</div><div class="tut-text">Slice the bubble!</div></div>` : ''}
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const els = {
    lives: $('#lives'), score: $('#score'), stage: $('#stage'), prompt: $('#prompt'), vis: $('#vis'), hint: $('#hint'),
    overlay: $('#overlay'), qcard: $('#qcard'), speak: $('#speak'),
  };
  let arena: Arena | null = null; let tracer: Tracer | null = null; let lastResult: SessionResult | null = null;
  const scope = screenScope();                    // #35: alive-guarded timers, the #toast helper and teardown, shared with the memory screen
  const { later, toast } = scope;
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

  // #36: the Session callbacks — the question beat, the outcome beat, the sprint clock, the boss reactions —
  // and the state only they touch live in play-session.ts. This screen keeps the markup, the arena, the
  // overlays and the test hooks, and hands the callbacks the few things they need from up here.
  const playSession = createPlaySession({
    mode: o.mode, year: o.year, topic: o.topic,
    pool: o.pool ?? (o.mode !== 'mission' ? topicsFor(o.year.id).filter(t => t.input !== 'tracing') : undefined),
  }, {
    training, tracing, villain: villainMode, av, els, hud, hold: HOLD,
    arena: () => arena,
    mounted: () => window.__sna === hooks,        // the screen the callbacks were built for is still the live one
    later, toast,
    startTrace, showTutorial, showTaunt, showStageClear, showResults,
  });
  const { session, waveEnd } = playSession;
  hud.drawLives(o.year.lives); hud.drawTimer(session.secondsLeft); hud.drawHp(session.bossHp, session.bossMax);
  // Sprint clock: real elapsed time, frozen while the pause overlay (or a result) has the arena paused.
  let ticker = 0; let lastTick = 0;
  if (sprint) ticker = window.setInterval(() => {
    const now = performance.now();
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!arena?.paused && !session.ended) session.tick(dt);
  }, 100);

  if (!tracing) {
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
        if (viaSwipe) { (sliceFx[av.fx] ?? sfx.slice)(); haptic('slice'); }
      },
      onFall(b) { if (b.label !== BOMB) session.fall(b.label); },
      onWaveEnd: waveEnd,   // the beat lives with the callbacks (#36): it reads the outcome still being shown
    }, {
      trailColor: skin?.color ?? av.glow, trailCore: skin?.core, fx: av.fx,
      onSwish: () => sfx.swish(),
      // A tap throws the ninja's projectile: the whoosh goes with the throw, the element slice with the pop (#48).
      onThrow: () => sfx.whoosh(),
      onLand: () => { (sliceFx[av.fx] ?? sfx.slice)(); haptic('slice'); },
      // The TNT blows up under the finger — never chase it with a star, or it would burst twice and reward the hit.
      throwFor: b => b.label !== BOMB,
    });
  }

  function startTrace(q: Question) {
    tracer?.destroy();
    const c = $('#trace') as HTMLCanvasElement;
    tracer = new Tracer(c, q.answer, r => {
      if (r.pass) { sfx.correct(); session.hit(q.answer); }
      else if (tracer!.strokes >= 1 && r.outside > 0.6) toast('Stay on the dotted lines', 'bad');
    }, av.glow);
    $('#tclear').onclick = () => { sfx.tap(); tracer?.clear(); };
    $('#tcheck').onclick = () => {
      const r = tracer!.result(); if (r.pass) { sfx.correct(); session.hit(q.answer); return; }
      const missing = r.glyphs.filter(g => g < 0.55).length;   // name the letter the child skipped
      toast(
        r.outside > 0.45 ? 'Stay on the dotted lines'
          : q.answer.length > 1 && missing ? `Trace the "${[...q.answer][r.weakest]}" too — every letter!`
          : `Keep tracing — cover the whole ${q.answer.length > 1 ? 'word' : 'letter'}`,
        'bad',
      );
    };
  }
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
  function showResults(r: SessionResult) {
    playSession.hold(true);                       // the game is over: syncPaused() also reads session.ended, so nothing here can undo it
    let newBest = false;
    if (o.mode === 'mission' && o.topic) recordTopic(o.topic.id, r.stars, r.score);
    else if (training) { if (r.won) recordTraining(o.year.id); }
    else if (o.mode === 'sprint') newBest = recordSprint(o.year.id, r.score);
    else if (o.mode === 'boss') { if (r.won) recordBossWin(o.year.id); }
    else recordEndless(o.year.id, r.score);
    for (const [id, t] of Object.entries(session.byTopic)) recordAccuracy(id, t.hits, t.tries);   // every mode teaches Sensei what is hard
    const bySubject = (s: Topic['subject']) =>
      Object.entries(session.byTopic).reduce((n, [id, t]) => n + (topicsFor(o.year.id).find(x => x.id === id)?.subject === s ? t.hits : 0), 0);
    const dojo = recordDojo({
      mode: r.mode, won: r.won, correct: r.correct, attempts: r.attempts, bestCombo: r.bestCombo,
      stars: r.stars, score: r.score, training,
      mathsCorrect: bySubject('maths'), writingCorrect: bySubject('writing'),
    });
    const fresh = addCoins(r.coins + dojo.coins); const streak = touchStreak();
    const stickerHTML = stickersHTML(fresh);
    if (fresh.length || dojo.completed.length) later(() => sfx.stage(), scaled(600));   // #138
    const medal = resultMedal(r);
    const headline = training ? senseiLine(r.won, d.name)
      : r.mode === 'sprint' && newBest ? `New best, ${d.name || 'Ninja'}!`
      : r.mode === 'boss' && r.won ? `K.O.! You beat Hammer Man, ${d.name || 'Ninja'}!`
      : r.won ? praiseLine(av, d.name)
      : `Hammer Man got away this time, ${d.name || 'Ninja'}!`;
    const heading = resultHeading(r.mode, { won: r.won, training });   // from the mode table (mission distinguishes a Sensei-training win)
    const speaker = training ? SENSEI : av;   // Sensei closes a training session; the child's own ninja closes everything else
    say(headline);
    const cert = certInfo(r); lastResult = r;
    els.overlay.hidden = false;
    els.overlay.innerHTML = resultsHTML({
      mode: r.mode, won: r.won, training, glow: speaker.glow, img: speaker.img, name: speaker.name,
      headline, medal, heading, starCount: r.stars, score: r.score, correct: r.correct, attempts: r.attempts,
      bestCombo: r.bestCombo, coins: r.coins, newBest, streak, dojoRows: dojoRowsHTML(dojo), stickerHTML, cert: !!cert,
    });
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
    if (cert) $('#cert').addEventListener('click', async () => {
      sfx.tap(); const b = $('#cert') as HTMLButtonElement; b.disabled = true;
      try {
        const how = await deliverCertificate(await drawCertificate(cert), `sky-ninja-certificate-${(d.name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
        if (how === 'shared') toast('Certificate shared!', 'good');
        else if (how === 'saved' || how === 'downloaded') toast('Certificate saved!', 'good');
        else if (how === 'declined') toast('No problem — you can save it next time!', 'good');
        // 'shown' opens the full-screen view with its own save hint, so no toast
      }
      catch { toast('Could not make the certificate', 'bad'); }
      b.disabled = false;
    });
  }
  /** Certificate details for a won mission / Sensei session (null for the other modes and lost runs). */
  const certInfo = (r: SessionResult): CertInfo | null =>
    r.won && o.mode === 'mission'
      ? {
          name: d.name, avatar: av, year: o.year.title, title: o.topic?.title ?? 'Sensei training',
          stars: r.stars, score: r.score, correct: r.correct, attempts: r.attempts, training,
        }
      : null;
  function showPause() {
    playSession.hold(true);                       // #65: pauses the arena, and stops a sentence peek's clock with it
    els.overlay.hidden = false; els.overlay.innerHTML = pauseHTML();
    $('#resume').addEventListener('click', () => { els.overlay.hidden = true; playSession.hold(false); });
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
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
      const label = q.sequence ? q.sequence[session.seqIndex] : q.answer;
      return arena!.hitLabel(label);
    },
    wrong: () => {
      const q = session.current; if (!q || !arena) return false;
      const target = q.sequence ? q.sequence[session.seqIndex] : q.answer;
      const b = arena.bubbles.find(x => x.launched && !x.dead && x.label !== target && x.label !== BOMB);
      return b ? arena.hitLabel(b.label) : false;
    },
    bubbles: () =>
      arena?.bubbles.filter(b => b.launched && !b.dead && !b.hit && !b.fade)
        .map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy })) ?? [],
    state: () => ({
      stage: session.stage, index: session.index, score: session.score, lives: session.lives,
      ended: session.ended, waiting: session.waiting, prompt: session.current?.prompt,
      answer: session.current?.answer, timeLeft: session.timeLeft, bossHp: session.bossHp, trail: skin ?? null,
      shots: arena?.shotsThrown ?? 0,
    }),
    // PNG data URL of the certificate for the finished mission
    certificate: async () => {
      const c = lastResult && certInfo(lastResult);
      return c ? (await drawCertificate(c)).toDataURL('image/png') : null;
    },
    // #32: test-only time compression — set the multiplier (affects the next wave's flight/stagger and the holds).
    setSpeed: (k: number) => { setGameSpeed(k); },
    // #32: effective outcome holds (ms) and the current multiplier — the normal-speed rail asserts the base holds.
    timing: () => ({ speed: gameSpeed(), hold: { correct: scaled(HOLD.correct), wrong: scaled(HOLD.wrong), miss: scaled(HOLD.miss) } }),
  };
  window.__sna = hooks;
  session.start();
  return cleanup;                    // the router calls this when it leaves the screen (back button included) — see #73
}
