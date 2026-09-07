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

/** Whichever screen is live owns `window.__sna`; it is deleted on cleanup. */
export type SnaHooks = PlayHooks | MemoryHooks;

declare global {
  interface Window { __sna?: SnaHooks }
}
