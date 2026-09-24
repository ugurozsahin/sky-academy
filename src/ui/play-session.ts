// The play screen's Session callbacks, split out of play.ts (#36). `playScreen()` was one long closure, and
// its biggest tenant was the object handed to `new Session(...)`: the question beat (stage pill, prompt,
// visual, wave spawn), the outcome beat, the sprint clock and the boss reactions, mixed in with the screen's
// markup, overlays and test hooks. That object now lives here together with the small mutable state only it
// touches — the outcome beat's `lastOutcome` / `revealUntil` / `waveId`, the mission segments, the font gate
// and the previous life count — so play.ts keeps what the rest of the screen owns.
//
// This is wiring, not rules: every rule still comes from session.ts, modes.ts, hud.ts and the OUTCOME table
// below, exactly as before the move. The pieces the screen builds *after* the session (the arena, the
// `window.__sna` hooks) are read through the function-valued deps, so the order in play.ts is unchanged.
import { cheerLine, type Avatar } from '../avatars';
import { STAGE_NAMES, type Question } from '../curriculum';
import type { Arena, WaveOpts } from '../game/arena';
import type { DojoOutcome } from '../game/dojo';
import { Session, type SessionOpts, type SessionResult } from '../game/session';
import { scaled } from '../game/speed';   // #32: test-only time compression
import { canHear, haptic, onVoiceStateChange, say, sfx } from '../audio';
import type { CertInfo } from './certificate';
import { $, esc } from './dom';
import { fontReady } from './font';   // #44: the canvas bakes in whatever face is loaded — wait for Fredoka
import { hintText, promptHTML, promptMode, stageHTML, type Hud, type Outcome } from './hud';
import { renderVisual } from './visuals';
import { createSolidSlot, type ArtFrame, type SolidArtState, type SolidState } from './solid';   // #684: the lazy three.js solid on a 3-D Shapes card

/** The TNT bubble villain modes mix into a wave: it costs a life and never counts as a wrong answer (#48). */
export const BOMB = '💣';

/**
 * The spawn options for one question's wave, shared between this screen and `tests/unit/sim.test.ts`'s
 * scenarios (#126). Before this, every scenario hand-wrote its own copy of this shape — matched by prose
 * ("the same text as the screen's") rather than by the compiler — and had already drifted: the `wide`
 * derivation below had no test coverage at all, and a hardcoded `wide: true` stayed accidentally correct only
 * because the one scenario using it happens to ask a question where `q.wide` is also true. `labels` is
 * `info.labels` before any villain-mode TNT bubble is mixed in — `onQuestion` below does that itself, since
 * it is specific to the real screen and no scenario exercises it here.
 */
export function waveOptsFor(q: Question, info: { labels: string[]; speed: number }, seqIndex: number): WaveOpts {
  return { labels: info.labels, speed: info.speed, wide: !!q.wide || info.labels.some(l => l.length > 3), ordered: q.sequence?.slice(seqIndex) };
}

/**
 * Every write a finished game produces (coins, the Daily Dojo move, Sensei's accuracy, the certificate, the
 * daily streak) — handed from `commitResult()` to `showResults()` rather than a second one recomputing them,
 * which would pay the game twice (#484, mirroring #375/#441's `MatchPayout` for Ninja Duel).
 */
export interface ResultPayout {
  newBest: boolean; dojo: DojoOutcome; fresh: string[]; streak: number; cert: CertInfo | null;
  /** Whether `cert`'s write actually reached the store (#470) — see `play.ts`'s `commitResult()`. `cert`
   *  itself stays what was earned regardless; only this says whether the album kept it. */
  certSaved: boolean;
}

/** The HUD elements the callbacks write to — play.ts owns them and passes its own `els` straight in. */
export interface PlaySessionEls {
  score: HTMLElement; stage: HTMLElement; prompt: HTMLElement; vis: HTMLElement; hint: HTMLElement; qcard: HTMLElement;
  speak: HTMLElement;                 // the 🔊 button: relabelled or hidden with the prompt mode (#65)
}

/** Everything the callbacks need from the screen around them. Function-valued where the screen builds it later. */
export interface PlaySessionDeps {
  training: boolean;                  // Sensei training: each question names its own topic in the card title
  tracing: boolean;                   // tracing missions have no arena — the tracer answers instead of a wave
  villain: boolean;                   // villain modes mix a TNT bubble into every third wave
  av: Avatar;                         // the child's ninja: cheer lines and the float-text colour
  els: PlaySessionEls;
  hud: Hud;                           // the hud.ts writers, already bound to those elements
  hold: { correct: number; wrong: number; miss: number };   // unscaled outcome holds (ms) — see play.ts's HOLD
  /** The arena, or null in a tracing mission; built after the session, hence a function. */
  arena: () => Arena | null;
  /** False once this screen has been torn down — never spawn a wave into a dead screen. */
  mounted: () => boolean;
  later: (fn: () => void, ms: number) => void;              // alive-guarded timer (#35)
  /** Freeze/re-arm every pending `later()` beat while an overlay holds the screen (#301) — `scope.holdTimers`. */
  holdTimers: (open: boolean) => void;
  toast: (text: string, cls?: string, ms?: number) => void;
  startTrace: (q: Question) => void;
  showTutorial: () => number;
  showTaunt: () => void;
  showStageClear: (stage: number, stars: number, acc: number) => void;
  /**
   * The writes a finished game makes — every `record*()` call, run synchronously the moment the game is
   * decided (#484). `showResults()` used to make them itself, from inside the overlay's own scope-bound
   * timer: a quit between the game ending and that timer firing (Pause → Islands, or the Android back
   * button) ran `dispose()`, which cancelled it — coins, the Daily Dojo move, Sensei's accuracy, the
   * certificate and the streak all lost, with no toast or log to say so, in every mode but Ninja Duel.
   */
  commitResult: (r: SessionResult) => ResultPayout;
  showResults: (r: SessionResult, payout: ResultPayout) => void;
}

export interface PlaySession {
  /** The live session. The screen still owns it: the hooks, the results screen and the arena all read it. */
  readonly session: Session;
  /** The arena's wave-end beat: let the outcome finish showing, then take a breath before the next question. */
  waveEnd(): void;
  /**
   * One of the screen's overlays (pause, stage clear, results) opened (`true`) or closed. The arena is paused
   * while an overlay OR a sentence peek holds it, and a peek's clock stops while an overlay is open — so a
   * child who pauses mid-peek finds the sentence still there on resume, with the rest of its time to run (#65).
   *
   * `beats` is false for a hold that NEVER LIFTS — the results overlay (PR #474 review, B1). Freezing the
   * screen's beats (#301) is right for pause and stage clear, which both reopen; after the results hold a
   * frozen beat has no resume to be re-armed by, so it sat in the set unarmed until `dispose()` threw it
   * away, in silence. That cost the sticker jingle and left every results toast pinned over the modal.
   */
  hold(open: boolean, beats?: boolean): void;
  /**
   * The child tapped the card or 🔊. On a device that speaks the screen reads the line again; on one that
   * cannot, a hidden sentence is shown again for the peek time. Returns true when it was handled here, so
   * the button is never a no-op on a silent device (the #205 rule).
   */
  repeat(): boolean;
  /** The rotating solid on the card (#684), for the `window.__sna.solid()` hook. */
  solid(): SolidState | null;
  /** The solid drawn inside a 3-D Shapes bubble, for the arena's `labelArt` (#684). */
  bubbleArt(label: string, colour: string, phase: number): Readonly<ArtFrame> | null;
  /** Which solids have a baked spin sheet, and how many bubble frames drew one — the `solidArt()` hook. */
  solidArt(): SolidArtState | null;
  /** Stop the voice-capability subscription and any peek when the play screen is replaced. */
  dispose(): void;
}

/** A visual equivalent of hearing a sentence once: look, remember, then build. */
export const NO_VOICE_PEEK_MS = 3000;
/** The 🔊 button's labels per prompt mode; `read` hides it — the words are already on the card. */
const SPEAK_LABEL = {
  hear: { aria: 'Read the question aloud', title: 'Tap the card to hear it again' },
  peek: { aria: 'Show the sentence again', title: 'Tap the card to see it again' },
} as const;

// #36: onCorrect/onWrong/onMiss each carried a copy of the same closing beat — remember the outcome, mark
// the mission segment, spotlight the answer under the card, freeze the wave for the hold — and differed
// only in the rules below, so a fourth outcome is now a row rather than a fourth copy of the body.
// `advance` is the no-arena (tracing) fallback; 0 is the miss path, where the session has already moved on.
// #138: every scheduled beat in this file goes through scaled() — the outcome holds, the inter-question gap,
// the tracing `advance` below, the results floor and the breath after it. The one exception is deliberate and
// a guard rail would be wrong to touch it: `revealUntil - performance.now()` is real time still owed on a
// hold that was already scaled when it began, so scaling it a second time would cut short the pause a child
// sees. (The beats play.ts still owns — the tutorial hold, the taunt, the results cue — are scaled there.)
// #490: being an absolute wall is also why a PAUSE does not shift it, unlike the wave's own launchAt (arena.ts,
// fixed there). A pause that outlasts the remaining reveal makes all three readers below compute a negative
// `revealUntil - now()`, never a hang: each already floors it (`Math.max(0, …)` / `Math.max(scaled(900), …)`),
// so the effect is the reveal reading as already over the moment the pause lifts — early by at most the floor
// each reader already carries, not stuck. Left this way rather than shifted: the wave's clock decides what a
// child SEES fly, so a collapsed stagger is visible; a slightly-early internal deadline here is not.
const OUTCOME = {
  correct: { seg: 'good', taunt: false, hold: 'correct', advance: 900 },
  wrong: { seg: 'bad', taunt: true, hold: 'wrong', advance: 1200 },
  miss: { seg: 'bad', taunt: true, hold: 'miss', advance: 0 },
} as const;

/** Build the session and its callbacks for one play screen. */
export function createPlaySession(opts: SessionOpts, deps: PlaySessionDeps): PlaySession {
  const { els, hud, hold } = deps;
  const mission = opts.mode === 'mission';        // only missions show the stage pill and its segments
  let lastOutcome: Outcome | 'none' = 'none';
  let waveId = 0; let revealUntil = 0;
  // #484: set by `onCommit` when a staged mission's last question is decided ahead of `onEnd` — so `onEnd`
  // reuses that payout instead of committing (and so paying) the game a second time.
  let earlyPayout: ResultPayout | null = null;
  let activeQuestion: Question | null = null;
  // The peek (#65): a sentence shown for NO_VOICE_PEEK_MS of un-paused time, then hidden. `peekLeft` is the
  // time still to run, `peekSince` when the current run started, `peekDone` what the hide releases (the wave
  // launch, for the first peek of a question). `holdOpen` mirrors the pause overlay; `readThrough` marks a
  // question whose verdict arrived after its bubbles launched, so its sentence stays readable instead.
  let peekToken = 0; let peekActive = false; let peekLeft = 0; let peekSince = 0;
  let peekDone: (() => void) | null = null;
  let holdOpen = false; let readThrough = false;
  let prevLives = opts.year.lives;
  // #44: false only until Fredoka is usable (or the capped wait gives up). The first wave is held back that
  // long so its labels are measured and drawn in the real face; every wave after it spawns synchronously.
  let fontsReady = false; fontReady().then(() => { fontsReady = true; });
  const solid = createSolidSlot(() => els.vis);   // #684: three loads on the first 3-D Shapes card, never before
  // Mission progress (#55): stage name + one segment per question (green = right, red = slip, pulsing = current) + a small "3/6".
  let segStage = 0; let segs: ('good' | 'bad' | '')[] = [];
  function drawStage(stage: number, index: number, total: number) {
    if (!mission) { els.stage.textContent = `Q${session.questionsAsked}`; return; }
    if (stage !== segStage) { segStage = stage; segs = Array.from({ length: total }, () => ''); }
    els.stage.innerHTML = stageHTML(STAGE_NAMES[stage - 1] ?? `Stage ${stage}`, segs, index, total);
  }
  const markSeg = (k: 'good' | 'bad') => {
    if (mission) { segs[session.index] = k; drawStage(session.stage, session.index, session.perStage); }
  };
  const endWave = (ms: number) => {                // freeze the wave while the outcome is on screen
    const id = waveId; revealUntil = performance.now() + ms;
    deps.later(() => { if (waveId === id) deps.arena()?.clearWave('#ffffff'); }, ms);
  };
  /** The beat every outcome shares. `reveal` is what the arena spotlights: the right answer, and the wrong bubble if one was cut. */
  function settle(kind: Outcome, q: Question, reveal: { good: string; bad?: string }) {
    const rule = OUTCOME[kind];
    lastOutcome = kind; markSeg(rule.seg);
    if (rule.taunt) deps.showTaunt();
    const arena = deps.arena();
    if (!arena) { if (rule.advance) deps.later(() => session.advance(), scaled(rule.advance)); return; }   // #138: the tracing path's own beat, scaled like every other
    arena.reveal(reveal); hud.showOutcome(kind, q); endWave(scaled(hold[rule.hold]));
  }

  /** `arena.paused` has ONE writer outside arena.ts, and this is it (a guard rail counts): the screen's overlays
   *  (`hold()`) and the peek are reasons, and this is the sum of them — plus a finished game, which the results
   *  overlay pauses for good and nothing here may undo. */
  function syncPaused() {
    const arena = deps.arena();
    if (arena) arena.paused = holdOpen || peekActive || session.ended;
  }
  /** Drop a peek without finishing it — a new question, a slice, or teardown made it moot. */
  function releasePeek() {
    if (!peekActive) return;
    peekToken++; peekActive = false; peekDone = null;
    syncPaused();
  }
  /**
   * Write the line under the prompt. `own` marks the one kind that must survive a short screen: a hint the
   * card is *answered from*, which the generator declares with `hintIsData` (`types.ts`). The short-screen
   * rule (`@media (max-height: 640px)` in style.css) hides `.hint` to buy the card vertical space on a phone
   * held sideways — a fair trade for an instruction line, and not for the seven measure topics whose values
   * being compared live in `hint` and nowhere else: hidden, "Which is fuller?" sits over two coloured
   * bubbles with nothing to decide by (#328, and #65's rule that every card stays usable without read-aloud).
   *
   * **Not `!!q.hint`**, which is what the first version of this fix used. 47 of the registry's 87 topics
   * write a `hint` and only 7 of those carry data; `hint` is documented as "small instruction text", and
   * that is what the other 40 put there ("Slice the shape", "Put them in twos"). Marking all of them would
   * have given a 16px line back to every one of those cards in landscape and pushed the arena down with it
   * (`arena.topInset` below) — the space the media query exists to reclaim (PR #430 review, round 1).
   */
  function setHint(text: string, own = false) {
    els.hint.textContent = text;
    els.hint.classList.toggle('own', own);
  }
  /** Show the sentence and start (or resume) its clock. `then` runs when it hides — nothing, for a repeat. */
  function showPeek(q: Question, then: (() => void) | null) {
    els.prompt.innerHTML = esc(q.listen!);
    setHint('Look, remember, then build it');
    peekActive = true; peekLeft = scaled(NO_VOICE_PEEK_MS); peekDone = then;
    syncPaused();
    if (!holdOpen) runPeek(q);
  }
  function runPeek(q: Question) {
    const token = ++peekToken; peekSince = performance.now();
    deps.later(() => {
      if (token !== peekToken || activeQuestion !== q || !deps.mounted()) return;
      els.prompt.innerHTML = promptHTML(q, session.seqIndex);
      setHint('Slice the words in order');
      const then = peekDone; peekActive = false; peekDone = null;
      syncPaused();
      then?.();
    }, peekLeft);
  }

  /**
   * Put the prompt on the card for the device's voice verdict (#65). Returns true when a peek is holding the
   * wave back — the caller launches when it ends. `launched` says the bubbles are already up (a verdict that
   * landed mid-wave): a peek cannot start under a live wave — "hide it before the bubbles launch" is the
   * contract in types.ts — so that question reads its sentence through instead.
   */
  function renderQuestion(q: Question, launched: boolean): boolean {
    const mode = promptMode(q, canHear());
    releasePeek();
    if (mode === 'peek' && launched) readThrough = true;
    const reveal = mode === 'read' || readThrough;
    els.speak.hidden = reveal;
    if (!reveal) { els.speak.setAttribute('aria-label', SPEAK_LABEL[mode].aria); els.speak.setAttribute('title', SPEAK_LABEL[mode].title); }
    if (mode === 'peek' && !launched) return true;
    els.prompt.innerHTML = promptHTML(q, session.seqIndex, reveal);
    // Both halves: the generator says this hint is data, AND it is the hint that reached the card. The second
    // conjunct is not redundant — `hintText()` falls back to a generic instruction when `q.hint` is absent,
    // and a generator that set the flag without a hint would otherwise mark that instruction (#328).
    const line = hintText(q, { reveal, tracing: deps.tracing });
    setHint(line, !!q.hint && !!q.hintIsData);
    return false;
  }

  const session = new Session(opts, {
    onQuestion(q, info) {
      // If a miss is still being shown (the answer fell and the session moved on at once), let the child see it before the next question.
      const wait = Math.max(0, revealUntil - performance.now()); if (wait > 0) { deps.later(() => show(), wait + scaled(450)); return; } show();
      function show() {
        drawStage(info.stage, info.index, info.total);
        // Sensei: name the topic of each question
        const t = session.currentTopic;
        if (deps.training && t) $('.ttl').textContent = `${t.icon} ${t.title}`;
        activeQuestion = q; readThrough = false;
        const peek = renderQuestion(q, false);
        els.vis.innerHTML = renderVisual(q.visual);
        solid.show(q, session.currentTopic?.id);
        lastOutcome = 'none'; waveId++; els.qcard.classList.remove('good', 'bad');
        if (deps.tracing) { say(q.say ?? q.prompt); deps.startTrace(q); return; }
        const bomb = deps.villain && session.questionsAsked > 3 && session.questionsAsked % 3 === 0 && !q.sequence;
        const waveOpts = waveOptsFor(q, info, session.seqIndex);
        const labels = bomb ? [...waveOpts.labels, BOMB] : waveOpts.labels;
        // #138: a spawn can be queued — behind the tutorial hold, or behind the font gate — and the session
        // can move on while it waits, so it must check that its own question is still the one on screen.
        // Without this, a wave that was superseded lands on top of the wave that replaced it: spawnWave()
        // empties the array first, so the child is left holding the PREVIOUS question's bubbles — asked one
        // question and handed another's answers. It was only ever reachable because the tutorial hold was
        // 1.8 s of real time, longer than anything that raced with it; scaling that hold (play.ts) shortened
        // the gap and the race came out. The rAF is checked too — it is a second deferral, and the frame
        // after a queued spawn is exactly when a fast session moves on. Same idiom as endWave, other end.
        const myWave = waveId;
        const spawn = () => {
          if (waveId !== myWave) return;                                 // superseded while we waited
          const arena = deps.arena()!;
          say(q.say ?? q.prompt);
          requestAnimationFrame(() => {
            if (waveId !== myWave) return;
            arena.topInset = els.qcard.getBoundingClientRect().bottom + 6;
            arena.spawnWave({ ...waveOpts, labels });
          });
        };
        const demo = deps.showTutorial();           // first ever play: animated hand first, bubbles a moment later
        // #44: the very first wave waits for Fredoka. A bubble's label size is fitted once at spawn (#28) and
        // every frame draws it with fillText, so a wave launched before the font lands is measured against the
        // fallback face and then changes shape in mid-air while the child is reading it. Only the first wave
        // pays: fontReady() caches, and `fontsReady` keeps every later spawn synchronous, exactly as before.
        // The tutorial branch goes through the same gate (review of #139): `demo` is the child's first ever
        // play, the one launch certain to have a cold font cache, and it used to be waved through on nothing
        // but the coincidence that showTutorial()'s 1800 ms happens to exceed the 1200 ms cap.
        const gatedSpawn = () => {
          if (fontsReady) { spawn(); return; }
          // Through `later(..., 0)` and not straight out of the promise (PR #474 review, B2). `mounted()` is
          // the only guard a raw continuation has and it does not read the hold, so a pause pressed inside
          // this gate — up to the 1200ms cap, on a cold font cache — let `say()` speak the question behind
          // the overlay and `spawnWave` land with `launchAt` already past. That is #301 word for word, in the
          // one place the fix did not reach. A 0ms beat defers rather than drops: frozen at 0 remaining and
          // re-armed at 0 on resume, so the wave goes up when the child comes back rather than never.
          // `scaled(0)` rather than a bare `0`: it is 0 either way, and #138's rail is right that a beat belongs
          // on the scaled clock — this one is a "next task", not a wait, and says so by going through it.
          fontReady().then(() => deps.later(() => { if (deps.mounted()) spawn(); }, scaled(0)));   // never into a torn-down screen
        };
        const launch = () => { if (demo) deps.later(gatedSpawn, demo); else gatedSpawn(); };
        if (peek) showPeek(q, launch); else launch();   // #65: the peek owns the launch — it runs when the sentence hides
      }
    },
    onCorrect(q, points, combo) {
      sfx.correct(); els.score.textContent = String(session.score);
      const c = cheerLine(deps.av); deps.toast(combo >= 3 ? `${c} Combo ×${combo}` : c, 'good', scaled(hold.correct) + 300);
      const arena = deps.arena();
      if (arena) arena.floatText(arena.W / 2, arena.topInset + 40, `+${points}`, deps.av.glow);
      // a finished sequence spotlights its last letter; everything else spotlights the answer itself
      settle('correct', q, { good: q.sequence ? q.sequence[q.sequence.length - 1] : q.answer });
    },
    onWrong(q, hit) {
      sfx.wrong(); haptic('wrong'); deps.toast('Not quite!', 'bad', scaled(hold.wrong));
      settle('wrong', q, { good: q.sequence ? q.sequence[session.seqIndex] : q.answer, bad: hit });
    },
    onMiss(q) {
      sfx.miss(); deps.toast('Missed!', 'bad', scaled(hold.miss));
      settle('miss', q, { good: q.sequence ? q.sequence[session.seqIndex] : q.answer });
    },
    onProgress(label, done, total) {
      releasePeek();
      sfx.slice();
      const arena = deps.arena();
      // the next word is earned: bring it up now instead of making the child wait for its batch
      if (done < total) arena?.rush(session.current!.sequence![done]);
      const q = session.current!;
      els.prompt.innerHTML = promptHTML(q, done, promptMode(q, canHear()) === 'read' || readThrough);
      if (arena) arena.floatText(arena.W / 2, arena.topInset + 40, label, deps.av.glow);
      // queued, never interrupting: sliced letters arrive faster than they can be spoken, and a plain say()
      // cuts each one off to start the next, so the child hears fragments instead of the word (#40)
      if (done < total) say(label, false, { queue: true });
    },
    onLives(n) { hud.drawLives(n); if (n < prevLives) { sfx.life(); haptic('life'); } prevLives = n; },
    onStageClear(stage, st, acc) { sfx.stage(); haptic('stage'); deps.showStageClear(stage, st, acc); },
    onTime(s) { hud.drawTimer(s); if (s <= 3 && s > 0) sfx.tap(); },
    onBoss(hp, max, kind) {
      hud.drawHp(hp, max);
      const v = $('#villain'); if (!v) return;
      v.classList.remove('hit', 'heal'); void v.offsetWidth; v.classList.add(kind);
      if (kind === 'hit') { sfx.life(); if (hp > 0) deps.toast(hp <= 3 ? 'Hammer Man is wobbling!' : 'Hit!', 'good'); }
      else deps.showTaunt();
    },
    // #484 (review round 1, B1): a staged mission's last question decides the game well before `advance()`
    // even runs — `advance()` sits behind the SAME deferred `waveEnd()` below, and the last stage's own
    // `end()` is reached only from the "Next" click on the stage-clear overlay `advance()` shows. `onCommit`
    // fires synchronously at that true decision point (`session.ts`) and commits there; this reuses its
    // payout instead of committing a second time. Every other mode (Endless, Sprint, Boss, Memory Match's
    // own `commit()`) never fires `onCommit` at all, so `earlyPayout` stays null and this commits as before.
    onCommit(r) { earlyPayout = deps.commitResult(r); },
    // #138: the floor and the breath after it are game beats and scale; `revealUntil - now` is real time
    // already remaining on a hold that was itself scaled when it started, so it must NOT be scaled again.
    // #484: for every mode but a staged mission's last stage, the writes are committed here, in the same
    // synchronous call as `end()` — before the overlay's own timer is even scheduled — so a quit during the
    // wait below can only ever cancel the DRAWING of the results, never the payout itself.
    onEnd(r) {
      const payout = earlyPayout ?? deps.commitResult(r);
      earlyPayout = null;
      const wait = lastOutcome === 'none' || r.mode === 'sprint' ? 0 : Math.max(scaled(900), revealUntil - performance.now() + scaled(300));
      deps.later(() => deps.showResults(r, payout), wait);
    },
  });

  // Registered after `session` exists: `recordVoice` dispatches synchronously, and this reads the session. A
  // verdict that lands mid-peek is left alone — the sentence is on the card and the wave launches when it hides.
  const stopWatchingVoice = onVoiceStateChange(() => {
    if (activeQuestion && !session.waiting && !peekActive && deps.mounted()) renderQuestion(activeQuestion, true);
  });

  return {
    session,
    waveEnd() {   // let the outcome finish showing (the reveal may still be on screen), then a breath before the next question
      const gap = scaled(lastOutcome === 'correct' ? 450 : lastOutcome === 'none' ? 0 : 650);
      deps.later(() => session.waveEnd(), Math.max(0, revealUntil - performance.now()) + gap);
    },
    hold(open, beats = true) {
      if (open === holdOpen) return;
      holdOpen = open;
      // The screen's beats freeze with the arena (#301). The peek's own clock below already worked this way —
      // #65 stopped it so a child pausing mid-sentence found the sentence still there — and the outcome hold,
      // the inter-question gap and the results cue were the ones still running behind the overlay.
      if (beats) deps.holdTimers(open);
      if (peekActive && activeQuestion) {
        if (open) { peekLeft = Math.max(0, peekLeft - (performance.now() - peekSince)); peekToken++; }   // stop the clock
        else runPeek(activeQuestion);                                                                 // and restart it
      }
      syncPaused();
    },
    repeat() {
      const q = activeQuestion;
      if (!q || session.waiting || readThrough || promptMode(q, canHear()) !== 'peek' || !deps.mounted()) return false;
      if (!peekActive) showPeek(q, null);   // bubbles already up stay frozen while the child looks; nothing waits on it
      return true;
    },
    solid: () => solid.state(),
    bubbleArt: (label, colour, phase) => solid.bubbleArt(label, colour, phase),
    solidArt: () => solid.art(),
    dispose() { releasePeek(); stopWatchingVoice(); solid.dispose(); },
  };
}

