// Mission / endless session controller. Pure game logic (no DOM) so it can be unit-tested.
import type { Difficulty, Question, Topic, Visual, YearInfo } from '../curriculum';
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

/**
 * Which `Visual` types carry their question in a form this key can read, and which part of them does it
 * (PR #407 review, B1).
 *
 * The first cut stringified the **whole** visual, and decoration went into the card's identity: five
 * Reception generators re-roll `emoji` per draw independent of the sum, so `1 + 4 = ?` came round twice
 * running 11.75% of the time on `r-add` against 0.00% before, wearing a different sticker each time. A
 * blocklist of cosmetic field names is not enough either — `r-balance` hides its re-rolled emoji *inside* a
 * pan string (`emoji.repeat(n)`), and `y2-stats` inside a chart row's label.
 *
 * So this is an allowlist, and an absent type means **the old `(prompt, answer)` behaviour**: a visual this
 * table does not know about can never make two cards look different, only ever the same. That is the safe
 * direction — it can cost a re-roll that was not needed, never a repeat the re-roll existed to prevent.
 *
 * Only the three #390 names are here, because those are the ones where the visual *is* the question:
 * `objects` for `r-oddeven`, `sentence` for `y2-sentencetype` and `y2-tense`, `symmetry` for `y2-symmetry`.
 * Adding a type is a deliberate act, and the rails in `tests/unit/session.test.ts` measure both directions.
 */
const VISUAL_QUESTION = {
  objects: (v: Extract<Visual, { type: 'objects' }>) => `${v.n}/${v.n2 ?? ''}`,
  sentence: (v: Extract<Visual, { type: 'sentence' }>) => v.text,
  symmetry: (v: Extract<Visual, { type: 'symmetry' }>) => v.grid.join('/'),
} satisfies Partial<{ [T in Visual['type']]: (v: Extract<Visual, { type: T }>) => string }>;
const visualKey = (v: Visual): string => {
  const f = (VISUAL_QUESTION as Record<string, ((x: Visual) => string) | undefined>)[v.type];
  return f ? f(v) : '';
};
/**
 * The identity of a card, for "do not ask the same thing twice running" (#390, widened by #412).
 *
 * `prompt` and `answer` are not enough, and neither is adding the visual: on nine topics the question is
 * carried by **text that is not the prompt**, and there is no visual at all. `measureCompare` puts the values
 * only in `hint` ("red pencil: 12 cm · blue pencil: 7 cm") and `say`; `soundQ`'s prompt is the constant
 * `🔊 Listen!` and its three keyword words — the whole question — go into `listen` and `say`. So the key
 * reduced to the answer, and the re-roll loop then refused every card whose answer matched the previous one:
 * driven through a real `Session` at d1, `r-soundhunt` repeated the target sound 0.000% of the time over 4000
 * pairs. A child who remembers the last answer was doing better than one who listens.
 *
 * `hint` and `listen` are therefore in the key — both are content wherever they are set. **`say` is not**,
 * because it is the only one of the three that carries presentation as well as content. (Not by analogy with
 * `VISUAL_QUESTION`, which round 2's N7 rightly points out runs the other way: an omitted *visual type* costs
 * a needless re-roll, which is safe, while an omitted *`Question` field* collapses two cards onto one key,
 * which is the bug — twice now. A field goes in unless it is shown to carry presentation; a visual type stays
 * out unless it is shown to carry the question.) `orderQ` speaks the numbers in their *shuffled* display order (`Slice the numbers from
 * smallest to biggest: 7, 2, 9`), which is re-shuffled per draw independently of the exercise, so folding it
 * in would put the same decoration into the card's identity that a per-draw `emoji` did. On every topic whose
 * question `say` carries, that question is also in `listen` (`soundQ`), `hint` (`measureCompare`) or the visual
 * (`y2-tense`, `y2-sentencetype`, `r-oddeven`) — **except `intervalCompare`, where `say` and `options` are the
 * only carriers** (round 3, #453 note 1: an earlier version of this sentence claimed no exception, which was
 * false for the very topic the paragraph below defers). Keying `say` would not be the fix there either, for the
 * `orderQ` reason above; #451 is.
 *
 * **But the order *within* `hint` and `listen` is presentation too** (#412 review round 1, B1), and missing
 * that was this key's own version of the same mistake: `soundQ` builds `listen` from the very
 * `shuffle(rng, words).slice(0, 3)` that `say` is built from, so three keyword words have up to six spellings
 * of one question, and a first cut that keyed the raw string served the same sound-hunt card twice running
 * 1.11% of the time — *dog, duck, dig* then *dog, dig, duck* — against 0.000% before the change. The same
 * mechanism, without the child-visible effect, is in `measureCompare`'s shuffled colour columns and
 * `y2-temp`'s two readings. So `contentList` keys a `' · '`-separated list as a **set**: the separator is this
 * repository's list separator, and those three generators are the only places it reaches a `Question`'s content
 * fields — it is also in a dozen or so UI strings, which this never sees (round 3). Normalised in the key,
 * never on the card — what the child reads is unchanged. Nothing enforces that inventory; the rails answer it
 * from the other end by normalising over four separators, so a generator switching to one of them goes red.
 *
 * **Two carriers this key does not read, and the topics that leaves uncovered** (#412 review rounds 2 and 3).
 * Both are `main`'s behaviour rather than anything #412 introduces, and both want the same remedy — a signal
 * from the generator that the field is the question, not decoration — so neither is keyed here:
 *
 * - **`options`.** #412 rules them out in its own words, because they are shuffled and re-drawn per draw, so
 *   keying them switches repeat-avoidance off for the forty-odd topics whose extra bubbles are decoys. But
 *   `intervalCompare` sets no `hint`, no `listen` and no visual, and its own comment says the bubbles *are* the
 *   durations, so `y2-duration` reduces to `(prompt, answer)`: at d2, 22 keys over 3,000 draws with 18 covering
 *   more than one comparison. **#451**.
 * - **A `visual` type `VISUAL_QUESTION` does not list.** `visualKey` returns `''` on a lookup miss, which the
 *   comment above calls the safe direction — and it is safe against *over*-discrimination, but it is silent
 *   about the cost, so say it here: `coins`, `numberline` and `chart` carry their question, and the key cannot
 *   read it. `y1-coins` at d2 gives 14 keys with 12 covering more than one spoken question, one of them holding
 *   `£1 or 20p`, `£1 or 10p` and `£1 or 2p`; `y1-line` d3 93 of 95; `y2-line` d3 25 of 32; `y2-money` d1 30 of
 *   33; `y2-stats` d2 194 of 194, the worst key covering 77 charts, where the chart *is* the question. A `word`
 *   visual, by contrast, carries `orderQ`'s shuffled display, so leaving that one unread is right. **#455**.
 *
 * `sequence` is not in the key either, which is safe only because every sequence generator encodes the order
 * in `answer` (`orderQ`'s is the joined `sequence`) — an invariant pinned in `tests/unit/curriculum.test.ts`,
 * noted here so both ends say so (round 2, N4).
 *
 * Exported so the rails in `tests/unit/session.test.ts` can measure this key against the text a child reads
 * rather than against a copy of it, in both directions: different questions never share a key, and one
 * question never takes two. Those rails normalise lists over four separators against this one, deliberately,
 * so that narrowing `contentList` goes red (round 2, B2).
 */
const contentList = (s: string) => (s.includes(' · ') ? s.split(' · ').sort().join(' · ') : s);
export const repeatKey = (q: Question) => [q.prompt, q.answer, contentList(q.hint ?? ''), contentList(q.listen ?? ''), q.visual ? `${q.visual.type}\u0000${visualKey(q.visual)}` : ''].join('\u0000');

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
    // avoid immediate repeats — of the whole card, not merely of its answer (#390)
    const prev = this.current && repeatKey(this.current);
    for (let i = 0; i < 5 && prev && repeatKey(q) === prev; i++) q = topic.gen(this.difficulty, this.rng);
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
