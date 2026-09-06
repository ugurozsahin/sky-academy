// Mission / endless session controller. Pure game logic (no DOM) so it can be unit-tested.
import type { Difficulty, Question, Topic, YearInfo } from '../curriculum';

// mission = 5 staged waves with lives · endless = Sky Storm, ramps until lives run out · sprint = 60-second time attack, no lives
// boss = Boss Battle: every correct slice hits Hammer Man, every slip heals him; KO him before your lives run out
export type Mode = 'mission' | 'endless' | 'sprint' | 'boss';
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
    this.timeLeft = o.mode === 'sprint' ? (o.seconds ?? SPRINT_SECONDS) * 1000 : 0;
    this.bossMax = o.mode === 'boss' ? (o.bossHp ?? BOSS_HP) : 0; this.bossHp = this.bossMax;
  }
  get perStage() { return this.o.year.perStage; }
  get secondsLeft() { return Math.ceil(this.timeLeft / 1000); }
  get difficulty(): Difficulty {
    if (this.o.mode === 'mission') return this.o.year.diffs[Math.min(this.stage, this.o.year.diffs.length) - 1] ?? 3;
    if (this.o.mode === 'sprint') return this.questionsAsked < 5 ? 1 : this.questionsAsked < 12 ? 2 : 3;
    if (this.o.mode === 'boss') return this.questionsAsked < 4 ? 1 : this.questionsAsked < 9 ? 2 : 3;
    return this.questionsAsked < 8 ? 1 : this.questionsAsked < 20 ? 2 : 3;
  }
  get speed() {
    const gentle = this.o.year.gentle;
    if (this.o.mode === 'mission') { const s = this.o.year.speeds[Math.min(this.stage, this.o.year.speeds.length) - 1] ?? 3; return this.current?.sequence ? Math.max(1, s - 1) : s; }
    if (this.o.mode === 'sprint') { const s = this.o.year.speeds[1] ?? 2; return this.current?.sequence ? Math.max(1, s - 1) : s; }   // steady pace: the clock is the pressure
    if (this.o.mode === 'boss') { const s = this.o.year.speeds[this.enraged ? 2 : 1] ?? 2; return this.current?.sequence ? Math.max(1, s - 1) : s; }
    const s = this.questionsAsked < 10 ? 1 : this.questionsAsked < 25 ? 2 : 3;
    return gentle ? Math.min(2, s) : s;
  }
  /** Boss with 3 HP or fewer fights faster. */
  get enraged() { return this.o.mode === 'boss' && this.bossHp > 0 && this.bossHp <= 3; }
  /** A slip lets the boss recover one HP (never above max). */
  private bossHeal() {
    if (this.o.mode !== 'boss' || this.ended) return;
    this.bossHp = Math.min(this.bossMax, this.bossHp + 1); this.ev.onBoss?.(this.bossHp, this.bossMax, 'heal');
  }
  /** Sprint clock: advance by `ms`. Emits onTime when the displayed second changes; ends the run at zero. */
  tick(ms: number) {
    if (this.o.mode !== 'sprint' || this.ended || ms <= 0) return;
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
    return [...q.sequence.slice(this.seqIndex), ...decoys].sort(() => this.rng() - 0.5);
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
    const base = this.o.mode === 'mission' ? 10 * this.stage : this.o.mode === 'sprint' ? 10 : 10 + Math.min(20, Math.floor(this.questionsAsked / 5) * 5);
    const points = base + (this.combo >= 3 ? Math.min(20, this.combo * 2) : 0);
    this.score += points;
    this.ev.onCorrect(q, points, this.combo);
    if (this.o.mode === 'boss') { this.bossHp = Math.max(0, this.bossHp - 1); this.ev.onBoss?.(this.bossHp, this.bossMax, 'hit'); if (this.bossHp === 0) this.end(true); }
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
    if (this.o.mode === 'sprint') return;               // no lives in a sprint: a slip only costs time
    this.lives = Math.max(0, this.lives - 1); this.ev.onLives(this.lives);
    if (this.lives === 0) this.end(false);
  }
  /** Called by the UI after feedback delay to move on. */
  advance() {
    if (this.ended) return;
    if (this.o.mode !== 'mission') { this.nextQuestion(); return; }
    this.index++;
    if (this.index >= this.perStage) {
      const acc = this.stageAttempts ? this.stageCorrect / this.stageAttempts : 0;
      const stars = acc >= 0.95 ? 3 : acc >= 0.7 ? 2 : 1;
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
    const stars = this.o.mode === 'mission' ? (won ? Math.max(1, Math.round(total / this.stages)) : 0)
      : this.o.mode === 'sprint' ? (this.correct >= 12 ? 3 : this.correct >= 6 ? 2 : this.correct >= 1 ? 1 : 0)
      : this.o.mode === 'boss' ? (won ? (acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1) : 0)
      : (this.score >= 300 ? 3 : this.score >= 150 ? 2 : this.score >= 50 ? 1 : 0);
    // Ninja coins: 1 per correct answer, +5 per stage star, +20 for a completed mission, endless: score/10, sprint: +5 per star, boss: +5 per star +20 for the KO
    const coins = this.correct + total * 5 + (won && this.o.mode !== 'endless' && this.o.mode !== 'sprint' ? 20 : 0) + (this.o.mode === 'endless' ? Math.floor(this.score / 10) : 0) + (this.o.mode === 'sprint' || this.o.mode === 'boss' ? stars * 5 : 0);
    this.ev.onEnd({ mode: this.o.mode, won, score: this.score, stars, stageStars: this.stageStars, correct: this.correct, attempts: this.attempts, bestCombo: this.bestCombo, questions: this.questionsAsked, coins });
  }
}
