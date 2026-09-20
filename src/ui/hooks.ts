// The `window.__sna` test / accessibility contract (#34).
//
// This was `(window as any).__sna` in play.ts, memory.ts and `interface Window { __sna: any }` in the e2e
// spec, so renaming or dropping a hook only broke tests at runtime. The play and memory screens now build
// their hook object as a typed `PlayHooks` / `MemoryHooks`, and the e2e spec imports these types — so `tsc`
// checks the contract at the source, before the tests ever run. Keep these shapes in step with the objects
// assigned in play.ts / memory.ts and the properties the spec reads.
import type { Session } from '../game/session';
import type { Arena } from '../game/arena';
import type { Tracer } from '../game/tracing';
import type { Memory } from '../game/memory';
import type { Duel, DuelPlayer } from '../game/duel';
import type { TrailSkin } from '../game/shop';

/** A live bubble as the e2e spec reads it (a subset of arena `Bubble`). */
export interface BubbleView { label: string; x: number; y: number; r: number; vy: number }

/** Play-screen state snapshot returned by `state()`. */
export interface PlayState {
  stage: number;
  index: number;
  score: number;
  lives: number;
  ended: boolean;
  waiting: boolean;
  prompt: string | undefined;
  answer: string | undefined;
  timeLeft: number;
  bossHp: number;
  trail: TrailSkin | null;
  /** Projectiles thrown so far this screen (#48) — a swipe never throws one, a tapped TNT never does either. */
  shots: number;
}

/** The `window.__sna` hooks set by the play screen. */
export interface PlayHooks {
  session: Session;
  arena: Arena | null;
  readonly tracer: Tracer | null;
  /** Slice the correct bubble (or auto-trace the current letter); false if there is no question. */
  answer(): boolean;
  /** Slice a wrong bubble on purpose; false if none is in flight. */
  wrong(): boolean;
  /** Bubbles currently launched and not yet resolved. */
  bubbles(): BubbleView[];
  state(): PlayState;
  /** PNG data URL of the finished mission's certificate, or null. */
  certificate(): Promise<string | null>;
  /** Test-only (#32): set the game-speed multiplier that compresses the holds, gap, stagger and flight time. */
  setSpeed(k: number): void;
  /** Test-only (#32): the effective outcome holds (ms) and the current speed multiplier. */
  timing(): { speed: number; hold: { correct: number; wrong: number; miss: number } };
}

/** A memory card as the e2e spec reads it (a subset of `Card`). */
export interface MemoryCardView { pair: number; text: string; up: boolean; matched: boolean }

/** Memory-screen state snapshot returned by `state()`. */
export interface MemoryState {
  mode: 'memory';
  moves: number;
  matched: number;
  pairs: number;
  score: number;
  ended: boolean;
  waiting: boolean;
}

/** The `window.__sna` hooks set by the Memory Match screen. */
export interface MemoryHooks {
  memory: Memory;
  theme: string;
  cards(): MemoryCardView[];
  /** Turn card `i` over; false if the flip was ignored (locked, matched, already up). */
  flip(i: number): boolean;
  state(): MemoryState;
}

/** Duel-screen state snapshot returned by `state()` (#16). */
export interface DuelState {
  mode: 'duel';
  round: number; rounds: number;
  scoreA: number; scoreB: number;
  /** This round is settled — won, or drawn once the wave ended — so later slices are ignored until it clears. */
  decided: boolean;
  ended: boolean;
  prompt: string | undefined;
  answer: string | undefined;
  /** The line the card shows under the prompt — the question's own `hint` when it has one (#16 review). */
  hint: string;
  topic: string;
}

/** The `window.__sna` hooks set by the Ninja Duel screen (#16): every action names the player it is for. */
export interface DuelHooks {
  duel: Duel;
  arenas: Record<DuelPlayer, Arena>;
  /** Slice the correct bubble in player `p`'s arena; false if it is not in flight there. */
  answer(p: DuelPlayer): boolean;
  /** Slice a wrong bubble in player `p`'s arena on purpose; false if none is in flight. */
  wrong(p: DuelPlayer): boolean;
  bubbles(p: DuelPlayer): BubbleView[];
  state(): DuelState;
  setSpeed(k: number): void;
  timing(): { speed: number; hold: { won: number; draw: number } };
}

/** Whichever screen is live owns `window.__sna`; it is deleted on cleanup. */
export type SnaHooks = PlayHooks | MemoryHooks | DuelHooks;

declare global {
  interface Window { __sna?: SnaHooks }
}
