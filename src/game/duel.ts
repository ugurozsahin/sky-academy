// Ninja Duel: two players share one question, first correct slice wins the round (#16). Pure game logic (no
// DOM/canvas), mirroring session.ts's own separation so it stays unit-testable ahead of any arena/HUD wiring.
import type { Difficulty, Question, Topic } from '../curriculum';
import type { DojoEvent } from './dojo';

export type DuelPlayer = 'a' | 'b';
export const DUEL_ROUNDS = 10;

export interface DuelEvents {
  onQuestion: (q: Question, info: { round: number; total: number }) => void;
  onRoundWon: (player: DuelPlayer, q: Question) => void;              // first correct slice of the round
  onRoundMiss: (player: DuelPlayer, q: Question, label: string) => void;  // a wrong slice; the round continues
  onRoundDraw: (q: Question) => void;                                  // nobody sliced the answer before the wave ended
  onMatchEnd: (r: DuelResult) => void;
}
/**
 * One seat's answers in a match (#16 item 5, Sensei's half): `tries` counts the **rounds that seat answered**,
 * at most one per round, and `hits` the rounds where its first answer was right.
 *
 * **One per round, not one per slice** (PR #374 review, B1). It has to be, because this feeds the same
 * lifetime `progress[id].hits/tries` counter that missions write, which `weakestTopics()` and
 * `src/ui/parents.ts` divide: a denominator in a different unit makes that ratio a number about nothing.
 * A mission question contributes exactly one try however many bubbles the child cuts — `Session.hit()` guards
 * on `waiting`, and `markCorrect()`/`markWrong()` set it *before* calling `tally()` (`src/game/session.ts`).
 * A duel round cannot be latched the same way, because a wrong slice deliberately does not end it, and one
 * arena stroke fires `onHit` for every bubble it crosses (`src/game/arena.ts`) — so swiping the whole wave,
 * the cheap and obvious play when a wrong slice costs nothing, used to add a try per bubble. Ten rounds won
 * that way read as 10/28 to a parent about a child who won ten out of ten.
 */
export interface DuelTally { hits: number; tries: number }
export interface DuelResult { winner: DuelPlayer | 'draw'; scoreA: number; scoreB: number; rounds: number; tally: Record<DuelPlayer, DuelTally> }
export interface DuelOpts { topic: Topic; difficulty: Difficulty; rng?: () => number; rounds?: number }

export class Duel {
  round = 0; scoreA = 0; scoreB = 0; current: Question | null = null; roundDecided = false; ended = false;
  /**
   * Each seat's own answers, for Sensei (#16 item 5). Kept per seat rather than as a match total because the
   * score is a race: see `duelAccuracy()` for why only one seat's is ever written to the save.
   */
  readonly tally: Record<DuelPlayer, DuelTally> = { a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } };
  /** Seats that have already answered this round — the latch that keeps `tally` one try per seat per round. */
  private answered: Record<DuelPlayer, boolean> = { a: false, b: false };
  readonly rounds: number;
  private rng: () => number;
  constructor(public o: DuelOpts, private ev: DuelEvents) {
    this.rounds = o.rounds ?? DUEL_ROUNDS; this.rng = o.rng ?? Math.random;
  }
  start() { this.nextQuestion(); }
  private nextQuestion() {
    if (this.ended) return;
    this.round++; this.roundDecided = false; this.answered.a = this.answered.b = false;
    this.current = this.o.topic.gen(this.o.difficulty, this.rng);
    // "First correct slice" has no meaning for a sequence: `answer` is the joined string, every slice would be
    // wrong and the match would drain in draws with nothing red. duelPool() keeps these out; this is the floor.
    if (this.current.sequence) throw new Error(`Ninja Duel: ${this.o.topic.id} produced a sequence question`);
    this.ev.onQuestion(this.current, { round: this.round, total: this.rounds });
  }
  /**
   * A player sliced `label`. First correct slice of the round wins it; later slices (either player, this round)
   * are ignored. Mirrors session.ts's hit()/waveEnd() split: deciding the round does not by itself advance —
   * bubbles from the same wave (including the other player's) keep flying until the wave genuinely ends, so
   * the caller advances via waveEnd() once it does, exactly as the single-player arena already does.
   */
  hit(player: DuelPlayer, label: string): 'won' | 'wrong' | 'ignored' {
    const q = this.current; if (!q || this.roundDecided || this.ended) return 'ignored';
    const right = label === q.answer;
    // Sensei's tally takes this seat's FIRST answer of the round and nothing after it (`DuelTally` has why one
    // per round is the only unit that may go into that field). Two consequences, both deliberate:
    // wrong-then-right is 0/1 here, exactly as a mission scores it, so a seat can win a round the tally counts
    // as a miss — `hits` is therefore not a second copy of the score; and a slice the round is already decided
    // by never reaches this at all, because it is evidence about how fast the other child is, not about this one.
    if (!this.answered[player]) {
      this.answered[player] = true;
      this.tally[player].tries++;
      if (right) this.tally[player].hits++;
    }
    if (!right) { this.ev.onRoundMiss(player, q, label); return 'wrong'; }
    this.roundDecided = true;
    if (player === 'a') this.scoreA++; else this.scoreB++;
    this.ev.onRoundWon(player, q);
    return 'won';
  }
  /** The wave finished: a round nobody decided is a draw, then move on to the next round (or end the match). */
  waveEnd() {
    if (this.ended) return;
    if (!this.roundDecided) { this.roundDecided = true; this.ev.onRoundDraw(this.current!); }
    this.advance();
  }
  private advance() {
    if (this.round >= this.rounds) { this.end(); return; }
    this.nextQuestion();
  }
  private end() {
    if (this.ended) return;
    this.ended = true;
    const winner: DuelPlayer | 'draw' = this.scoreA > this.scoreB ? 'a' : this.scoreB > this.scoreA ? 'b' : 'draw';
    // A snapshot, not the live counters: a `hit()` after the match ends returns 'ignored' and cannot move
    // them, but the result outlives this screen's rematch and must not be a window onto a restarted tally.
    const tally = { a: { ...this.tally.a }, b: { ...this.tally.b } };
    this.ev.onMatchEnd({ winner, scoreA: this.scoreA, scoreB: this.scoreB, rounds: this.rounds, tally });
  }
}

/**
 * The topics a duel can be played on (#16 item 4): bubble topics only — no tracing (nothing to slice) and no
 * sequence questions (spelling, sentences, Order Up), where "first correct slice" has no meaning. A topic is
 * sampled with a few seeded draws at the given difficulty: some generators mix a sequence branch in at a
 * higher difficulty (Tricky Words at 3, say), so one draw is not a verdict — `DUEL_POOL_DRAWS` are.
 */
export const DUEL_POOL_DRAWS = 8;
export function duelPool(topics: Topic[], difficulty: Difficulty = 1): Topic[] {
  return topics.filter(t => {
    if (t.input === 'tracing') return false;
    for (let seed = 1; seed <= DUEL_POOL_DRAWS; seed++) if (t.gen(difficulty, seededRng(seed)).sequence) return false;
    return true;
  });
}

/** The hand-over instruction, spoken once at the start of a match — the second child cannot read the strip. */
export const DUEL_HANDOVER = 'Ninja Duel! Hand the top half to a friend.';
/**
 * What the screen says for a question. Round 1 carries the hand-over instruction in the SAME utterance: a
 * separate `say()` before it was cancelled by the question's own line in the same click (PR #295 review).
 */
export function spokenQuestion(q: Question, round: number): string {
  const line = q.say ?? q.prompt;
  return round === 1 ? `${DUEL_HANDOVER} ${line}` : line;
}
/** A tiny deterministic rng (mulberry32) for the sample above — a constant would spin a generator that draws until distinct. */
function seededRng(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * Rounds the match decided: one correct slice each, by whichever player got there first. The one source for
 * "questions answered correctly in this match" — both the coin payout and the dojo event below read it,
 * rather than each re-deriving `scoreA + scoreB` (#349's lesson about a second formatter).
 */
export const duelCorrect = (r: DuelResult): number => r.scoreA + r.scoreB;

/**
 * Coins a finished match pays into the save (#16 item 5). The two players share one profile, so the payout
 * is for the maths the device saw, not for who won: **one coin per decided round**, which is exactly the
 * `baseCoins` rate every other mode pays for a correct answer (`src/game/modes.ts`) — a round is decided by
 * a correct slice, so `scoreA + scoreB` is the count of questions answered correctly in the match. A drawn
 * round pays nothing, and there is no match-win bonus: with one shared save a bonus would pay whoever
 * happens to hold the device rather than the child whose save it is. Maximum for a `DUEL_ROUNDS` match: 10.
 */
export function duelCoins(r: DuelResult): number {
  return duelCorrect(r);
}

/**
 * What a finished match tells the Daily Dojo (#16 item 5). Same reasoning as `duelCoins` above: the two
 * players share one profile, so the dojo is told about the maths the *device* saw, never about who won —
 * `duelCorrect()` decided rounds, which is the count of questions answered correctly in the match.
 *
 * **Six of `applyEvent()`'s fourteen challenges have no mode gate**, so what is put here is paid out on its
 * face: `correct15`/`correct20`/`correct25` (the point of this), `maths10` and `writing6` (a duel moves them
 * legitimately — see the split below), and `combo5`. Everything a duel cannot honestly report is therefore
 * reported as nothing:
 * - **`bestCombo: 0`** — `combo5` is the one un-gated challenge **whose field a duel cannot measure**: the
 *   duel screen tracks no combo at all, so any other value would pay out for something never counted.
 * - **`won: false`, `stars: 0`, `score: 0`** — a duel has no winner, no stars and no score from the shared
 *   save's point of view; the challenges that read them (`mission2`, `boss1`, `sensei1`, `stars3`,
 *   `perfect`, `storm80`) are all gated on another mode, so this is the honest value, not a dodge.
 * - **`attempts: r.rounds`** — a unit the other producers do not use: they count questions *attempted*, and
 *   a duel round with ten wrong slices and no correct one is one attempt here. Nothing reads it but
 *   `perfect`, which is mission-gated, so the difference is inert; it is recorded rather than smoothed over
 *   because the honest count of a shared question sliced by two players is not obvious.
 *
 * A duel plays one topic for the whole match, so the per-subject split is that topic's subject — which means
 * a full match can complete `maths10` (goal 10) or `writing6` (goal 6) outright, and a duel can move two of
 * the day's three challenges: its volume one and, on a day that draws one of those two, its focus one.
 */
export function duelDojoEvent(r: DuelResult, subject: Topic['subject']): DojoEvent {
  const correct = duelCorrect(r);
  return {
    mode: 'duel', won: false, correct, attempts: r.rounds, bestCombo: 0, stars: 0, score: 0,
    mathsCorrect: subject === 'maths' ? correct : 0,
    writingCorrect: subject === 'writing' ? correct : 0,
  };
}

/**
 * What a finished match teaches Sensei about the one shared profile (#16 item 5) — the per-topic `hits`/`tries`
 * tally `recordAccuracy()` adds to, which `weakestTopics()` ranks a child's practice by and the parents'
 * report shows as a percentage.
 *
 * **Only Player 1's own slices, and nothing derived from the score.** A duel is a race, so the score is not an
 * accuracy measurement and three tempting numbers are all wrong here:
 * - `duelCorrect()` (what the coins and the dojo pay on) counts the rounds *the device* got right, two children
 *   between them. Sensei's tally is a claim about one child, so a round the friend won would be recorded as the
 *   profile child answering correctly.
 * - `scoreA` alone is no better as a hit count while `rounds` is the try count: a round Player 1 never sliced,
 *   because Player 2 got there first or nobody did, would be recorded as Player 1 answering *wrongly*. A round
 *   lost on speed is not a wrong answer, and a child who knows the topic perfectly but is slower than a bigger
 *   sibling would be ranked as their weakest topic.
 * - A slice made after the round was already decided, or after this seat has already answered it, is dropped by
 *   `hit()` before the tally, so this drops evidence rather than distorting the ratio: the rounds Player 1 did
 *   not reach are not counted either way, and a round it answered counts once however many bubbles it cut.
 *
 * `hits` is **not** `scoreA`. A seat that answers wrongly and then slices the answer wins the round but tallies
 * a miss, because the first answer is what a mission would have scored (`DuelTally`).
 *
 * **Which seat is the profile's child**: Player 1 is the bottom half, and `DUEL_HANDOVER` hands the *top* half
 * (Player 2) to the friend, so the bottom seat is the one the save can claim. If the children swap halves the
 * match teaches Sensei about the friend instead — the cost of one shared profile, and the reason this records
 * one seat rather than both: Player 2's tally has no profile to go to and is deliberately thrown away.
 *
 * A match nobody sliced returns `{ hits: 0, tries: 0 }`, which `recordAccuracy()` already ignores.
 */
export function duelAccuracy(r: DuelResult): DuelTally {
  return { ...r.tally.a };   // a copy: the duel screen puts this on `window.__sna`, and the result is a record
}

/**
 * Stars for the certificate a won duel earns (#16 item 5) — Player 1's own accuracy, on the **identical bar a
 * mission stage uses** (`Session`'s `acc >= 0.95 ? 3 : acc >= 0.7 ? 2 : 1`). Reusing that bar is the whole
 * point: a star on a duel certificate has to mean what a star means on every other certificate in the album,
 * or `fileCert()`'s "keep the best run" comparison is ranking two different scales against each other.
 *
 * It reads `duelAccuracy()`'s tally rather than the scoreline for the reason #347 gave for paying no win
 * bonus: `scoreA` counts rounds the friend was *slower* on, which is not a measurement of this child's maths.
 *
 * A tally with no tries scores 1, not 3: an empty accuracy is not a perfect one. That case cannot arise from a
 * match Player 1 won — winning takes at least one hit, and every hit is also a try — so this is a floor for a
 * hand-edited or replayed result, never the live path.
 */
export function duelStars(t: DuelTally): number {
  if (t.tries <= 0) return 1;
  const acc = t.hits / t.tries;
  return acc >= 0.95 ? 3 : acc >= 0.7 ? 2 : 1;
}

/** The match-end line the duel screen shows and says. Player 1 is `a`, Player 2 is `b`. */
export function duelHeadline(r: DuelResult): string {
  return r.winner === 'draw' ? `It's a draw — ${r.scoreA} all!` : `Player ${r.winner === 'a' ? 1 : 2} wins ${Math.max(r.scoreA, r.scoreB)}–${Math.min(r.scoreA, r.scoreB)}!`;
}
