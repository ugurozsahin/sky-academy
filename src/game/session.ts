// Mission / endless session controller. Pure game logic (no DOM) so it can be unit-tested.
import type { Difficulty, Question, Topic, YearInfo } from '../curriculum';
import { shuffle } from '../curriculum/util';
import { MODES, type Mode, type ModeCtx, type ModeSpec } from './modes';

// mission = 5 staged waves with lives · endless = Sky Storm, ramps until lives run out · sprint = 60-second time attack, no lives
// boss = Boss Battle: every correct slice hits Hammer Man, every slip heals him; KO him before your lives run out
export type { Mode } from './modes';   // the mode names live in modes.ts alongside their behaviour table (#26)
export const SPRINT_SECONDS = 60;
export const BOSS_HP = 8;
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
}
export interface SessionResult { mode: Mode; won: boolean; score: number; stars: number; stageStars: number[]; correct: number; attempts: number; bestCombo: number; questions: number; coins: number }

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
export interface SessionOpts { mode: Mode; year: YearInfo; topic?: Topic; pool?: Topic[]; rng?: () => number; stages?: number; seconds?: number; bossHp?: number }

export class Session {
  stage = 1; index = 0; score = 0; combo = 0; bestCombo = 0; lives: number;
  correct = 0; attempts = 0; stageCorrect = 0; stageAttempts = 0; stageStars: number[] = [];
  current: Question | null = null; currentTopic: Topic | null = null; seqIndex = 0; waiting = false; ended = false; questionsAsked = 0;
  byTopic: Record<string, { hits: number; tries: number }> = {};   // per-topic tally (pool modes feed Sensei's weakest-topic ranking)
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
  private get ctx(): ModeCtx { return { year: this.o.year, stage: this.stage, questionsAsked: this.questionsAsked, sequence: !!this.current?.sequence, slow: !!this.current?.slow, enraged: this.enraged }; }
  get perStage() { return this.o.year.perStage; }
  get secondsLeft() { return Math.ceil(this.timeLeft / 1000); }
  get difficulty(): Difficulty { return this.spec.difficulty(this.ctx); }
  get speed() { return this.spec.speed(this.ctx); }
  /** Boss with 3 HP or fewer fights faster. */
  get enraged() { return this.spec.boss && this.bossHp > 0 && this.bossHp <= 3; }
  /** A slip lets the boss recover one HP (never above max). */
  private bossHeal() {
    if (!this.spec.boss || this.ended) return;
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

  /** Bubble labels for the current question (sequence letters incl. duplicates + decoys). */
  labelsFor(q: Question): string[] {
    if (!q.sequence) return q.options;
    const decoys = q.options.filter(o => !q.sequence!.includes(o));
    return shuffle(this.rng, [...q.sequence.slice(this.seqIndex), ...decoys]);
  }
  nextQuestion() {
    if (this.ended) return;
    const topic = this.pickTopic(); this.currentTopic = topic;
    let q = topic.gen(this.difficulty, this.rng);
    // avoid immediate repeats
    for (let i = 0; i < 5 && this.current && q.prompt === this.current.prompt && q.answer === this.current.answer; i++) q = topic.gen(this.difficulty, this.rng);
    this.current = q; this.seqIndex = 0; this.waiting = false; this.questionsAsked++;
    this.ev.onQuestion(q, { stage: this.stage, index: this.index, total: this.perStage, speed: this.speed, labels: this.labelsFor(q) });
  }
  /** Re-launch the remaining letters of a spelling sequence. */
  respawn() { if (this.current) this.ev.onQuestion(this.current, { stage: this.stage, index: this.index, total: this.perStage, speed: this.speed, labels: this.labelsFor(this.current) }); }

  /** Player hit a bubble. Returns 'correct' | 'wrong' | 'step' | 'ignored'. */
  hit(label: string): 'correct' | 'wrong' | 'step' | 'ignored' {
    const q = this.current; if (!q || this.waiting || this.ended) return 'ignored';
    if (q.sequence) {
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
    const isTarget = q.sequence ? label === q.sequence[this.seqIndex] : label === q.answer;
    if (!isTarget) return;
    this.waiting = true; this.attempts++; this.stageAttempts++; this.combo = 0; this.tally(false);
    this.ev.onMiss(q); this.bossHeal();
    if (!this.o.year.gentle) this.loseLife();
  }
  /** Wave finished (all bubbles gone). Decide what happens next. */
  waveEnd() {
    if (this.ended) return;
    if (!this.waiting) { // nothing decided (e.g. only decoys fell) – for sequences relaunch remaining letters
      if (this.current?.sequence) { this.respawn(); return; }
      this.waiting = true; this.attempts++; this.stageAttempts++; this.tally(false); this.ev.onMiss(this.current!); this.bossHeal(); if (!this.o.year.gentle) this.loseLife(); if (this.ended) return;
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
  }
  private markWrong(label: string) {
    const q = this.current!; this.waiting = true; this.attempts++; this.stageAttempts++; this.combo = 0; this.tally(false);
    this.ev.onWrong(q, label); this.bossHeal();
    this.loseLife();
  }
  private tally(hit: boolean) {
    const id = this.currentTopic?.id; if (!id) return;
    const t = this.byTopic[id] ??= { hits: 0, tries: 0 }; t.tries++; if (hit) t.hits++;
  }
  private loseLife() {
    if (!this.spec.hasLives) return;                    // no lives in a sprint: a slip only costs time
    this.lives = Math.max(0, this.lives - 1); this.ev.onLives(this.lives);
    if (this.lives === 0) this.end(false);
  }
  /** Called by the UI after feedback delay to move on. */
  advance() {
    if (this.ended) return;
    if (!this.spec.staged) { this.nextQuestion(); return; }
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
  end(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    const total = this.stageStars.reduce((s, x) => s + x, 0);
    const acc = this.attempts ? this.correct / this.attempts : 0;
    // End-stars and coins come from the mode's own rules in modes.ts (coins reads back the stars just computed).
    const end = { won, score: this.score, correct: this.correct, accuracy: acc, stageStarsTotal: total, stages: this.stages, stars: 0 };
    const stars = this.spec.stars(end);
    const coins = this.spec.coins({ ...end, stars });
    this.ev.onEnd({ mode: this.o.mode, won, score: this.score, stars, stageStars: this.stageStars, correct: this.correct, attempts: this.attempts, bestCombo: this.bestCombo, questions: this.questionsAsked, coins });
  }
}
