// Mission / endless session controller. Pure game logic (no DOM) so it can be unit-tested.
import type { Difficulty, Question, Topic, YearInfo } from '../curriculum';
import { shuffle } from '../curriculum/util';
import { MODES, type Mode, type ModeCtx, type ModeSpec } from './modes';
import type { AnswerTally } from '../storage';
import type { Slip } from '../save-records';
export { repeatKey } from './repeat-key';
import { repeatKey } from './repeat-key';

// mission = 5 staged waves with lives · endless = Sky Storm, ramps until lives run out · sprint = 60-second time attack, no lives
// boss = Boss Battle: every correct slice hits Hammer Man, every slip heals him; KO him before your lives run out
export type { Mode } from './modes';   // the mode names live in modes.ts alongside their behaviour table (#26)
export const SPRINT_SECONDS = 60;
export const BOSS_HP = 8;
/** Missed questions kept on a finished `SessionResult` (#878) — newest last, de-duplicated by `repeatKey`. */
export const MISSES_CAP = 20;
export interface SessionEvents {
  onQuestion: (q: Question, info: { stage: number; index: number; total: number; speed: number; labels: string[] }) => void;
  onCorrect: (q: Question, points: number, combo: number) => void;
  onWrong: (q: Question, hitLabel: string) => void;
  onMiss: (q: Question) => void;                        // correct bubble fell / sequence not finished
  onProgress: (label: string, done: number, total: number) => void;   // sequence step
  onLives: (lives: number) => void;
  onStageClear: (stage: number, stars: number, accuracy: number) => void;
  onTime?: (secondsLeft: number) => void;               // sprint clock, once per whole second
  onBoss?: (hp: number, max: number, kind: 'hit' | 'heal') => void;   // boss health changed
  onEnd: (r: SessionResult) => void;
  /**
   * A staged mission's LAST question was just decided (#484) — fired synchronously, in the same call as
   * `hit()`/`fall()`/`waveEnd()`, well before `advance()` is even reached (the UI defers that for the
   * outcome-reveal pacing) and long before the child could click "Next" on the stage-clear overlay `advance()`
   * eventually shows. `onEnd` still fires later, at its normal display-driven time, with an equal
   * `SessionResult` — this is only so a UI can commit the payout (coins, Sensei accuracy, the certificate…)
   * the instant it is decided rather than risk losing it to a quit in either of those two windows.
   */
  onCommit?: (r: SessionResult) => void;
}
/** One entry in `SessionResult.misses` (#878): `picked` is the label a wrong slice actually chose, and `null`
 *  means the question was missed outright — the target bubble fell, or the wave ended with nothing decided. */
export interface Miss { topic: string; q: Question; picked: string | null }
/** `SessionResult.misses` → the shape a grown-ups "Recent slip" is stored as (#938; `at` is stamped by
 *  `recordGameEnd()` itself, from its own `now`, not read here). `q.listen ?? q.prompt` so a spoken-only
 *  card still reads as text; a fallen bubble's `null` pick becomes `''` (#903's `Slip.picked` is never null).
 *  `misses` is newest-*last* (`recordMiss`'s own doc, just above) — reversed here the same way `fixDeck`
 *  reverses it, so what `recordGameEnd` prepends is newest-first, matching every other reader of `Slip`. */
export const missSlips = (misses: readonly Miss[]): Omit<Slip, 'at'>[] =>
  [...misses].reverse().map(m => ({ topic: m.topic, prompt: m.q.listen ?? m.q.prompt, answer: m.q.answer, picked: m.picked ?? '' }));
export interface SessionResult { mode: Mode; won: boolean; score: number; stars: number; stageStars: number[]; correct: number; attempts: number; bestCombo: number; questions: number; coins: number; incomplete?: boolean; misses: Miss[] }

/**
 * The three-star bar, from an accuracy in 0..1 — the **one** definition (#397 review round 2, B2).
 *
 * It was written out here and copied into `duelStars()`, and the copy was justified by a guard that did not
 * exist: moving these thresholds left both the copy and its test green, so the two scales could drift apart
 * silently. That is the one outcome that must not happen, because the certificate album lists duel and mission
 * rows together with the same three glyphs and nothing tells a child that one was rated on a different scale.
 * One exported function is what makes the claim true — a rail could only have noticed the drift afterwards.
 *
 * Both boundaries are inclusive; `tests/unit/session.test.ts` pins them as a table, which is the only thing
 * standing between these numbers and an accidental edit.
 */
export const starsForAccuracy = (acc: number): 1 | 2 | 3 => acc >= 0.95 ? 3 : acc >= 0.7 ? 2 : 1;
export interface DeckItem { topic: Topic; q: Question }
/**
 * With `deck` set, a Session replays exactly that list of questions, in order, and never generates or re-rolls
 * one — `topic` and `pool` are ignored (#878). It ends `won: true` once the deck is exhausted (unless lives ran
 * out first), whatever the mode's own `staged` behaviour would otherwise do: a deck flattens a mission into a
 * single run, the same shape as sprint, so "Fix my mistakes" (#930) and a friend's Challenge code (#294) do not
 * each need their own end-of-run handling. That includes Boss Battle: exhausting the deck ends the run won,
 * whether or not the boss still has HP left — nothing pairs `deck` with `mode: 'boss'` today, so this is stated
 * rather than tested, the same way the rest of this comment is.
 */
export interface SessionOpts { mode: Mode; year: YearInfo; topic?: Topic; pool?: Topic[]; deck?: DeckItem[]; rng?: () => number; stages?: number; seconds?: number; bossHp?: number; practice?: boolean; slower?: boolean }

/**
 * The "Fix my mistakes" deck (#930): the 5 most recent misses, newest first — `misses` is already newest-last
 * (`recordMiss`'s own order below), so this takes the tail and reverses it. `topicById` is injected rather
 * than imported from the curriculum registry directly, so this pure function stays testable without it; a
 * miss whose topic id no longer resolves is dropped rather than crashing the deck (unreachable with today's
 * static registry, defensive only).
 */
export function fixDeck(misses: Miss[], topicById: (id: string) => Topic | undefined): DeckItem[] {
  return misses.slice(-5).reverse()
    .map(m => ({ topic: topicById(m.topic), q: m.q }))
    .filter((d): d is DeckItem => !!d.topic);
}

export class Session {
  stage = 1; index = 0; score = 0; combo = 0; bestCombo = 0; lives: number;
  correct = 0; attempts = 0; stageCorrect = 0; stageAttempts = 0; stageStars: number[] = [];
  current: Question | null = null; currentTopic: Topic | null = null; seqIndex = 0; waiting = false; ended = false; questionsAsked = 0;
  /** Bumped whenever the re-roll below exhausts its five tries and still serves a repeat — the collapsed-key
   *  signal #453 item 4 asks for, exposed the way `questionsAsked` is rather than only logged. */
  repeatGiveUps = 0;
  byTopic: Record<string, AnswerTally> = {};   // per-topic tally (pool modes feed Sensei's weakest-topic ranking)
  private deckIndex = 0;                                // o.deck only: how far through it this session is
  private misses: Miss[] = [];                          // every wrong slice / miss, de-duplicated by repeatKey (#878)
  private slicedTargets = new Set<string>();            // q.anyOrder only: targets sliced so far this question (#918)
  timeLeft: number;                                     // ms, sprint only (0 otherwise)
  bossHp: number; readonly bossMax: number;             // boss only (0 otherwise)
  private rng: () => number; readonly stages: number;
  constructor(public o: SessionOpts, private ev: SessionEvents) {
    this.lives = o.year.lives; this.rng = o.rng ?? Math.random; this.stages = o.stages ?? o.year.speeds.length;
    this.timeLeft = this.spec.timed ? (o.seconds ?? SPRINT_SECONDS) * 1000 : 0;
    this.bossMax = this.spec.boss ? (o.bossHp ?? BOSS_HP) : 0; this.bossHp = this.bossMax;
  }
  /** The behaviour table entry for this run's mode (#26). */
  get spec(): ModeSpec { return MODES[this.o.mode]; }
  private get ctx(): ModeCtx { return { year: this.o.year, stage: this.stage, questionsAsked: this.questionsAsked, sequence: !!this.current?.sequence, slow: !!this.current?.slow, slower: !!this.o.slower, enraged: this.enraged }; }
  get perStage() { return this.o.year.perStage; }
  get secondsLeft() { return Math.ceil(this.timeLeft / 1000); }
  get difficulty(): Difficulty { return this.spec.difficulty(this.ctx); }
  get speed() { return this.spec.speed(this.ctx); }
  /** Boss with 3 HP or fewer fights faster. */
  get enraged() { return this.spec.boss && this.bossHp > 0 && this.bossHp <= 3; }
  /** A slip lets the boss recover one HP (never above max). */
  private bossHeal() {
    if (!this.spec.boss || this.ended || this.o.year.gentle) return;   // a gentle year's boss never heals (#700): the fight ends on HP or lives, not a slip
    this.bossHp = Math.min(this.bossMax, this.bossHp + 1); this.ev.onBoss?.(this.bossHp, this.bossMax, 'heal');
  }
  /** Sprint clock: advance by `ms`. Emits onTime when the displayed second changes; ends the run at zero. */
  tick(ms: number) {
    if (!this.spec.timed || this.ended || ms <= 0) return;
    const before = this.secondsLeft;
    this.timeLeft = Math.max(0, this.timeLeft - ms);
    if (this.secondsLeft !== before) this.ev.onTime?.(this.secondsLeft);
    if (this.timeLeft === 0) this.end(true);
  }
  /** Player hit a bomb / trap bubble: costs a life but the question continues. */
  bomb() {
    if (this.ended || this.waiting) return;
    this.combo = 0; this.loseLife();
  }
  private pickTopic(): Topic {
    if (this.o.topic) return this.o.topic;
    const pool = this.o.pool!; return pool[Math.floor(this.rng() * pool.length)];
  }
  start() { this.nextQuestion(); }

  /** Bubble labels for the current question (remaining sequence targets + decoys). */
  labelsFor(q: Question): string[] {
    if (!q.sequence) return q.options;
    const decoys = q.options.filter(o => !q.sequence!.includes(o));
    return shuffle(this.rng, [...this.remainingOf(q), ...decoys]);
  }
  /**
   * Targets not yet sliced for `q` — order-sensitive for an ordered sequence (spelling, a sentence), order-free
   * for an any-order card (#918): the position `seqIndex` tracks means nothing once slicing order is free, so
   * that branch instead removes whatever `slicedTargets` already holds. Takes `q` rather than reading
   * `this.current`, matching `labelsFor()`'s own parameter, so it can be called for a question that is about to
   * become current (`nextQuestion()`/`nextDeckQuestion()`) as well as for the current one (`remaining()` below).
   */
  private remainingOf(q: Question): string[] {
    if (!q.sequence) return [];
    return q.anyOrder ? q.sequence.filter(t => !this.slicedTargets.has(t)) : q.sequence.slice(this.seqIndex);
  }
  /** Targets not yet sliced on the current question, exposed for the UI/hooks (#918/#919 build on this). */
  remaining(): string[] { return this.current ? this.remainingOf(this.current) : []; }
  nextQuestion() {
    if (this.ended) return;
    if (this.o.deck) { this.nextDeckQuestion(); return; }
    const topic = this.pickTopic(); this.currentTopic = topic;
    let q: Question;
    try {
      q = topic.gen(this.difficulty, this.rng);
      // avoid immediate repeats — of the whole card, not merely of its answer (#390)
      const prev = this.current && repeatKey(this.current);
      for (let i = 0; i < 5 && prev && repeatKey(q) === prev; i++) q = topic.gen(this.difficulty, this.rng);
      if (prev && repeatKey(q) === prev) this.repeatGiveUps++;   // the key space collapsed even after five tries (#453 item 4)
    } catch (e) {
      // #444: a generator that refuses to draw (a floor rail like #433's tripped by a future curriculum
      // edit) must not leave the screen frozen mid-question — nothing else ever calls `nextQuestion()`
      // again, so `waiting` would stay stuck while the arena's rAF loop keeps it looking alive. Ending
      // through the normal path pays what was already earned; `won: false` because nothing was completed.
      console.error(`Sky Ninja Academy: "${topic.id}" question generator threw`, e);
      this.end(false, true);
      return;
    }
    this.current = q; this.seqIndex = 0; this.slicedTargets = new Set(); this.waiting = false; this.questionsAsked++;
    this.ev.onQuestion(q, { stage: this.stage, index: this.index, total: this.perStage, speed: this.speed, labels: this.labelsFor(q) });
  }
  /** `nextQuestion()` when `o.deck` is set: serve the next deck item, or end once it runs out (#878). */
  private nextDeckQuestion() {
    const deck = this.o.deck!;
    if (this.deckIndex >= deck.length) { this.end(true); return; }
    const { topic, q } = deck[this.deckIndex++];
    this.currentTopic = topic; this.current = q; this.seqIndex = 0; this.slicedTargets = new Set(); this.waiting = false; this.questionsAsked++;
    this.ev.onQuestion(q, { stage: this.stage, index: this.index, total: this.perStage, speed: this.speed, labels: this.labelsFor(q) });
  }
  /** Re-launch the remaining letters of a spelling sequence. */
  respawn() { if (this.current) this.ev.onQuestion(this.current, { stage: this.stage, index: this.index, total: this.perStage, speed: this.speed, labels: this.labelsFor(this.current) }); }

  /** Player hit a bubble. Returns 'correct' | 'wrong' | 'step' | 'ignored'. */
  hit(label: string): 'correct' | 'wrong' | 'step' | 'ignored' {
    const q = this.current; if (!q || this.waiting || this.ended) return 'ignored';
    if (q.sequence) {
      if (q.anyOrder) {
        if (!q.sequence.includes(label) || this.slicedTargets.has(label)) { this.markWrong(label); return 'wrong'; }
        this.slicedTargets.add(label); this.ev.onProgress(label, this.slicedTargets.size, q.sequence.length);
        if (this.slicedTargets.size >= q.sequence.length) { this.markCorrect(); return 'correct'; }
        return 'step';
      }
      const target = q.sequence[this.seqIndex];
      if (label === target) {
        this.seqIndex++; this.ev.onProgress(label, this.seqIndex, q.sequence.length);
        if (this.seqIndex >= q.sequence.length) { this.markCorrect(); return 'correct'; }
        return 'step';
      }
      this.markWrong(label); return 'wrong';
    }
    if (label === q.answer) { this.markCorrect(); return 'correct'; }
    this.markWrong(label); return 'wrong';
  }
  /** A bubble fell off-screen without being hit. */
  fall(label: string) {
    const q = this.current; if (!q || this.waiting || this.ended) return;
    // An ordered sequence only decides on its one current letter falling — the other remaining letters are
    // on screen too (labelsFor() launches the whole remainder at once) but simply relaunch, undecided, on the
    // next wave (waveEnd()'s "nothing decided" branch). An any-order card has no "current" target, so any
    // remaining (unsliced) one falling is the same decisive miss (#918).
    const isTarget = q.sequence
      ? (q.anyOrder ? q.sequence.includes(label) && !this.slicedTargets.has(label) : label === q.sequence[this.seqIndex])
      : label === q.answer;
    if (!isTarget) return;
    this.waiting = true; this.attempts++; this.stageAttempts++; this.combo = 0; this.tally(false); this.recordMiss(q, null);
    this.ev.onMiss(q); this.bossHeal();
    if (!this.o.year.gentle) this.loseLife();
    this.maybeCommitFinalStage();
  }
  /** Wave finished (all bubbles gone). Decide what happens next. */
  waveEnd() {
    if (this.ended) return;
    if (!this.waiting) { // nothing decided (e.g. only decoys fell) – for sequences relaunch remaining letters
      if (this.current?.sequence) { this.respawn(); return; }
      this.waiting = true; this.attempts++; this.stageAttempts++; this.tally(false); this.recordMiss(this.current!, null); this.ev.onMiss(this.current!); this.bossHeal(); if (!this.o.year.gentle) this.loseLife(); if (this.ended) return;
      this.maybeCommitFinalStage();
    }
    this.advance();
  }
  private markCorrect() {
    const q = this.current!; this.waiting = true;
    this.attempts++; this.correct++; this.stageAttempts++; this.stageCorrect++; this.tally(true);
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const base = this.spec.basePoints(this.ctx);
    const points = base + (this.combo >= 3 ? Math.min(20, this.combo * 2) : 0);
    this.score += points;
    this.ev.onCorrect(q, points, this.combo);
    if (this.spec.boss) { this.bossHp = Math.max(0, this.bossHp - 1); this.ev.onBoss?.(this.bossHp, this.bossMax, 'hit'); if (this.bossHp === 0) this.end(true); }
    this.maybeCommitFinalStage();
  }
  private markWrong(label: string) {
    const q = this.current!; this.waiting = true; this.attempts++; this.stageAttempts++; this.combo = 0; this.tally(false); this.recordMiss(q, label);
    this.ev.onWrong(q, label); this.bossHeal();
    this.loseLife();
    this.maybeCommitFinalStage();
  }
  private tally(hit: boolean) {
    const id = this.currentTopic?.id; if (!id) return;
    const t = this.byTopic[id] ??= { hits: 0, tries: 0 }; t.tries++; if (hit) t.hits++;
  }
  /** Record a wrong slice (`picked` the sliced label) or a miss (`picked: null`), de-duplicated by `repeatKey` —
   *  a repeat keeps the latest entry — newest last, capped at `MISSES_CAP` (#878). */
  private recordMiss(q: Question, picked: string | null) {
    const topic = this.currentTopic?.id; if (!topic) return;
    const key = repeatKey(q);
    this.misses = this.misses.filter(m => repeatKey(m.q) !== key);
    this.misses.push({ topic, q, picked });
    if (this.misses.length > MISSES_CAP) this.misses.shift();
  }
  private loseLife() {
    if (!this.spec.hasLives || this.o.practice) return;   // no lives in a sprint: a slip only costs time; practice (#930) never loses one either
    this.lives = Math.max(0, this.lives - 1); this.ev.onLives(this.lives);
    if (this.lives === 0) this.end(false);
  }
  /** Called by the UI after feedback delay to move on. */
  advance() {
    if (this.ended) return;
    // A deck flattens the mode's own staging (#878, SessionOpts.deck's own doc) — it ends when it runs out.
    if (this.o.deck || !this.spec.staged) { this.nextQuestion(); return; }
    this.index++;
    if (this.index >= this.perStage) {
      const acc = this.stageAttempts ? this.stageCorrect / this.stageAttempts : 0;
      const stars = starsForAccuracy(acc);
      this.stageStars.push(stars);
      this.ev.onStageClear(this.stage, stars, acc);
      return; // UI calls nextStage()
    }
    this.nextQuestion();
  }
  nextStage() {
    if (this.stage >= this.stages) { this.end(true); return; }
    this.stage++; this.index = 0; this.stageCorrect = 0; this.stageAttempts = 0;
    if (this.o.year.gentle) this.lives = this.o.year.lives; else this.lives = Math.min(this.o.year.lives, this.lives + 1); // small top-up between stages
    this.ev.onLives(this.lives);
    this.nextQuestion();
  }
  /**
   * The `SessionResult` this session would end with right now, given `won` and a stage-stars list — pure,
   * no side effects, so `maybeCommitFinalStage()` below can preview it before `stageStars` itself carries the
   * final stage (#484). `end()` calls it with the real, already-mutated `this.stageStars`.
   */
  private buildResult(won: boolean, stageStars: number[], incomplete = false): SessionResult {
    // #522 review (type-design-analyzer): `incomplete` only ever means a technical failure, never a genuine
    // finish — "won but incomplete" is not a state anything should reach, but `end(won, incomplete)` is two
    // independent booleans, so nothing stops a future call site asserting it by mistake. Clamped here, once,
    // rather than trusted at every call site: a bad call degrades to a safe loss instead of shipping a win.
    const safeWon = incomplete ? false : won;
    const total = stageStars.reduce((s, x) => s + x, 0);
    const acc = this.attempts ? this.correct / this.attempts : 0;
    // End-stars and coins come from the mode's own rules in modes.ts (coins reads back the stars just computed).
    const end = { won: safeWon, score: this.score, correct: this.correct, accuracy: acc, stageStarsTotal: total, stages: this.stages, stars: 0, year: this.o.year };
    const stars = this.spec.stars(end);
    const coins = this.spec.coins({ ...end, stars });
    return { mode: this.o.mode, won: safeWon, score: this.score, stars, stageStars, correct: this.correct, attempts: this.attempts, bestCombo: this.bestCombo, questions: this.questionsAsked, coins, incomplete, misses: [...this.misses] };
  }
  /**
   * #484: the moment a staged mission's last question is decided — inside `markCorrect()`/`markWrong()`/
   * `fall()`/`waveEnd()`'s own miss branch, all synchronous, none of them behind the deferred `waveEnd()` the
   * UI schedules for pacing — preview the SAME `SessionResult` `end()` will build once `advance()` and the
   * "Next" click eventually run, and hand it to `onCommit`. Never mutates `stageStars` or `index` itself:
   * those still change exactly once, naturally, when `advance()` is actually reached, so this is a preview,
   * not a second write. Guarded on `!this.ended` so a wrong answer that also empties the last life (a LOSS,
   * not a stage clear) can never fire this with `won: true` — `loseLife()`'s own `end(false)` runs first.
   *
   * Guarded on `!this.o.deck` too (#878 review): a deck session never moves `this.stage`/`this.index` — the
   * same reason `advance()` special-cases it — so without this the guard below would depend on no `YearInfo`
   * ever setting `perStage: 1`, rather than ruling the case out directly.
   */
  private maybeCommitFinalStage() {
    if (!this.ev.onCommit || this.ended || this.o.deck || !this.spec.staged || this.stage < this.stages || this.index + 1 < this.perStage) return;
    const acc = this.stageAttempts ? this.stageCorrect / this.stageAttempts : 0;
    this.ev.onCommit(this.buildResult(true, [...this.stageStars, starsForAccuracy(acc)]));
  }
  end(won: boolean, incomplete = false) {
    if (this.ended) return;
    this.ended = true;
    this.ev.onEnd(this.buildResult(won, this.stageStars, incomplete));
  }
}
