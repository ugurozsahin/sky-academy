// Ninja Duel: two players share one question, first correct slice wins the round (#16). Pure game logic (no
// DOM/canvas), mirroring session.ts's own separation so it stays unit-testable ahead of any arena/HUD wiring.
import type { Difficulty, Question, Topic } from '../curriculum';

export type DuelPlayer = 'a' | 'b';
export const DUEL_ROUNDS = 10;

export interface DuelEvents {
  onQuestion: (q: Question, info: { round: number; total: number }) => void;
  onRoundWon: (player: DuelPlayer, q: Question) => void;              // first correct slice of the round
  onRoundMiss: (player: DuelPlayer, q: Question, label: string) => void;  // a wrong slice; the round continues
  onRoundDraw: (q: Question) => void;                                  // nobody sliced the answer before the wave ended
  onMatchEnd: (r: DuelResult) => void;
}
export interface DuelResult { winner: DuelPlayer | 'draw'; scoreA: number; scoreB: number; rounds: number }
export interface DuelOpts { topic: Topic; difficulty: Difficulty; rng?: () => number; rounds?: number }

export class Duel {
  round = 0; scoreA = 0; scoreB = 0; current: Question | null = null; roundDecided = false; ended = false;
  readonly rounds: number;
  private rng: () => number;
  constructor(public o: DuelOpts, private ev: DuelEvents) {
    this.rounds = o.rounds ?? DUEL_ROUNDS; this.rng = o.rng ?? Math.random;
  }
  start() { this.nextQuestion(); }
  private nextQuestion() {
    if (this.ended) return;
    this.round++; this.roundDecided = false;
    this.current = this.o.topic.gen(this.o.difficulty, this.rng);
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
    if (label !== q.answer) { this.ev.onRoundMiss(player, q, label); return 'wrong'; }
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
    this.ev.onMatchEnd({ winner, scoreA: this.scoreA, scoreB: this.scoreB, rounds: this.rounds });
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

/** The match-end line the duel screen shows and says. Player 1 is `a`, Player 2 is `b`. */
export function duelHeadline(r: DuelResult): string {
  return r.winner === 'draw' ? `It's a draw — ${r.scoreA} all!` : `Player ${r.winner === 'a' ? 1 : 2} wins ${Math.max(r.scoreA, r.scoreB)}–${Math.min(r.scoreA, r.scoreB)}!`;
}
