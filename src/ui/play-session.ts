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
import type { Arena } from '../game/arena';
import { Session, type SessionOpts, type SessionResult } from '../game/session';
import { scaled } from '../game/speed';   // #32: test-only time compression
import { haptic, say, sfx } from '../audio';
import { load } from '../storage';
import { $, esc } from './dom';
import { fontReady } from './font';   // #44: the canvas bakes in whatever face is loaded — wait for Fredoka
import { stageHTML, type Hud, type Outcome } from './hud';
import { renderVisual } from './visuals';

/** The TNT bubble villain modes mix into a wave: it costs a life and never counts as a wrong answer (#48). */
export const BOMB = '💣';

/** The HUD elements the callbacks write to — play.ts owns them and passes its own `els` straight in. */
export interface PlaySessionEls {
  score: HTMLElement; stage: HTMLElement; prompt: HTMLElement; vis: HTMLElement; hint: HTMLElement; qcard: HTMLElement;
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
  toast: (text: string, cls?: string, ms?: number) => void;
  startTrace: (q: Question) => void;
  showTutorial: () => number;
  showTaunt: () => void;
  showStageClear: (stage: number, stars: number, acc: number) => void;
  showResults: (r: SessionResult) => void;
}

export interface PlaySession {
  /** The live session. The screen still owns it: the hooks, the results screen and the arena all read it. */
  readonly session: Session;
  /** The arena's wave-end beat: let the outcome finish showing, then take a breath before the next question. */
  waveEnd(): void;
}

// #36: onCorrect/onWrong/onMiss each carried a copy of the same closing beat — remember the outcome, mark
// the mission segment, spotlight the answer under the card, freeze the wave for the hold — and differed
// only in the rules below, so a fourth outcome is now a row rather than a fourth copy of the body.
// `advance` is the no-arena (tracing) fallback; 0 is the miss path, where the session has already moved on.
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
  let prevLives = opts.year.lives;
  // #44: false only until Fredoka is usable (or the capped wait gives up). The first wave is held back that
  // long so its labels are measured and drawn in the real face; every wave after it spawns synchronously.
  let fontsReady = false; fontReady().then(() => { fontsReady = true; });
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
    if (!arena) { if (rule.advance) deps.later(() => session.advance(), rule.advance); return; }
    arena.reveal(reveal); hud.showOutcome(kind, q); endWave(scaled(hold[rule.hold]));
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
        els.prompt.innerHTML = q.listen && !load().speech ? esc(q.listen) : promptHTML(q, session.seqIndex);
        els.vis.innerHTML = renderVisual(q.visual);
        els.hint.textContent = q.hint ?? (deps.tracing ? 'Trace over the dotted letters' : 'Tap or slice the answer');
        lastOutcome = 'none'; waveId++; els.qcard.classList.remove('good', 'bad');
        if (deps.tracing) { say(q.say ?? q.prompt); deps.startTrace(q); return; }
        const bomb = deps.villain && session.questionsAsked > 3 && session.questionsAsked % 3 === 0 && !q.sequence;
        const labels = bomb ? [...info.labels, BOMB] : info.labels;
        const spawn = () => {
          const arena = deps.arena()!;
          say(q.say ?? q.prompt);
          requestAnimationFrame(() => {
            arena.topInset = els.qcard.getBoundingClientRect().bottom + 6;
            arena.spawnWave({ labels, speed: info.speed, wide: !!q.wide || info.labels.some(l => l.length > 3), ordered: q.sequence?.slice(session.seqIndex) });
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
          fontReady().then(() => { if (deps.mounted()) spawn(); });   // never into a torn-down screen
        };
        if (demo) deps.later(gatedSpawn, demo); else gatedSpawn();
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
      sfx.slice();
      const arena = deps.arena();
      // the next word is earned: bring it up now instead of making the child wait for its batch
      if (done < total) arena?.rush(session.current!.sequence![done]);
      els.prompt.innerHTML = promptHTML(session.current!, done);
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
    onEnd(r) {
      const wait = lastOutcome === 'none' || r.mode === 'sprint' ? 0 : Math.max(900, revealUntil - performance.now() + 300);
      deps.later(() => deps.showResults(r), wait);
    },
  });

  return {
    session,
    waveEnd() {   // let the outcome finish showing (the reveal may still be on screen), then a breath before the next question
      const gap = scaled(lastOutcome === 'correct' ? 450 : lastOutcome === 'none' ? 0 : 650);
      deps.later(() => session.waveEnd(), Math.max(0, revealUntil - performance.now()) + gap);
    },
  };
}

/** The question prompt: a plain question, or the sequence so far with the letters still to come as gaps. */
function promptHTML(q: Question, done: number) {
  if (!q.sequence) return esc(q.prompt);
  const letters = q.sequence.map((l, i) => `<span class="${i < done ? 'got' : 'todo'}">${i < done ? esc(l) : '_'}</span>`).join('');
  return `<span class="seq">${letters}</span>`;
}
