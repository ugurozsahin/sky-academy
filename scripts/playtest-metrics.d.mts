// Types for the play-pack metrics (see scripts/playtest-metrics.mjs, #2205), so tests/unit/playtest-pack.test.ts can import it.
export interface PackJob { year: string; game: string; catalogue: boolean }
/** One per-frame sample of a live bubble: `[t ms, id, label, y px, r px, vy px/s]`. */
export type Sample = [t: number, id: number, label: string, y: number, r: number, vy: number];
export interface Span { min: number; max: number }
export interface Flight {
  id: number; label: string; r: number; launchMs: number; apexMs: number | null; apexY: number | null;
  enterMs: number | null; leaveMs: number | null; reachMs: number | null; afterSpeechMs: number | null; endedBy: 'fell' | 'wave over'; entrySpeedPxS: number | null;
}
export interface BubbleBrief { label: string; aboveCardMs: number; entrySpeedPxS: number | null }
export interface FlightSummary {
  bubbles: Flight[]; launched: number; bubbleRadiusPx: number | null; launchToApexMs: Span | null; aboveCardMs: Span | null;
  answerAboveCardMs: number | null; afterSpeechMs: Span | null; slowestBubble: BubbleBrief | null; fastestBubble: BubbleBrief | null;
}
/** A line the page spoke: when `speak()` was called, and when it started, ended or was cut off (performance.now ms). */
export interface Spoken { text: string; at: number; start: number | null; end: number | null; error: string | null; cut?: number; voice?: string | null }
export interface Screen {
  H: number; card: { top: number; bottom: number; width: number; height: number } | null; speakVisible: boolean;
  prompt: string | null; answer: string | null; hasLives: boolean; hint: string | null;
  slow: boolean; wide: boolean; sequence: boolean; anyOrder: boolean; visual: string | null; lives: number; mode: string | null;
}
/** A sequence question's reach recording (#2251): `[t, id, label, y, relaunches]` samples, and each required bubble's end. */
export type ReachSample = [t: number, id: number, label: string, y: number, relaunches: number];
export interface ReachEnd { t: number; hit: boolean; dead: boolean; launched: boolean; relaunches: number }
export interface ReachRecording { on?: boolean; ids: Record<number, string>; ends: Record<number, ReachEnd>; samples: ReachSample[]; frames: number[] }
export interface LabelReach { label: string; reachMs: number; flights: number; endedBy: 'sliced' | 'ran out' | 'wave over' }
export interface Recorded {
  screen: Screen; samples: Sample[] | null; frames: number[]; labels: string[]; promptAt: number | null; speech: Spoken | null;
  extra: Record<string, unknown>; voices?: number;
  /** performance.now() when recording stopped: a line still playing then had played at least until this. */
  collectedAt?: number;
  /** A sequence game's first question, over every flight of its required labels (#2251). */
  reach?: ReachRecording | null;
  /** Every question's line as the game's state gave it, from `promptStep` (#2250). */
  lines: PromptRow[];
}
export declare const KEYPAD_PACKS: PackJob[];
export declare function plannedPacks(cat: { games: Record<string, { years: Record<string, unknown> }> }, filter?: { year?: string | null; only?: string[] | null }): PackJob[];
export declare function parseArgs(argv: string[]): { base?: string; out?: string; year: string | null; only: string[] | null };
export declare function countWords(text: string | null | undefined): number;
export declare function flightMetrics(samples: Sample[], o: { H: number; cardBottom: number; answer?: string | null; speechEnd?: number | null }): FlightSummary;
export declare const FRAME_CLAMP_MS: number;
export interface FrameStats { count: number; maxGapMs: number; clean: boolean }
export declare function frameStats(times: number[]): FrameStats;
/** The bubble fields the reach recorder reads: a real `Bubble` from src/game/bubbles.ts has them all. */
export interface ReachBubble { id: number; label: string; y: number; launched: boolean; hit: boolean; dead: boolean; fade?: boolean; relaunches: number }
export declare function reachStep(rc: ReachRecording, t: number, bubbles: ReachBubble[], frozen: boolean, need: string[]): void;
export declare const newReach: () => Required<ReachRecording>;
export declare function labelReach(rc: ReachRecording, o: { H: number; cardBottom: number; maxRelaunches: number }): {
  labelReachMs: { min: number; median: number; max: number } | null;
  labelReach: { maxRelaunches: number; labels: LabelReach[]; frames: FrameStats };
};
/** One question's line (#2250): `[questionsAsked, stage, prompt, has a listen line, the card shows a line (#2265)]`. */
export type PromptRow = [asked: number, stage: number, prompt: string, listen: boolean, shown: boolean];
/** The fields of the current question the recorder reads: a real `Question` from src/curriculum/types.ts has them all. */
export interface PromptQuestion { listen?: string | null; sequence?: readonly string[] | null; build?: unknown; anyOrder?: boolean | null }
export declare function promptStep(rows: PromptRow[], asked: number, st: { stage: number; prompt?: string | null } | null | undefined, q?: PromptQuestion | null): void;
/** Throws when fewer than two questions of the first row's stage were read. `voiced`: the pack's spoken prompt really started. */
export declare function promptKeys(rows: PromptRow[], o: { voiced: boolean }): { promptFixed: boolean; promptWaves: number; promptShown: boolean };
export declare const speechMode: (o: { autoplays: boolean; offered: boolean }) => 'auto' | 'tap' | 'none';
export declare const cardShare: (rect: { width: number; height: number }, view: { width: number; height: number }) => number;
export declare const ABOUT: Record<string, string>;
export declare function buildMetrics(o: {
  job: PackJob; input: 'bubbles' | 'tracing' | 'keypad'; settings: Record<string, unknown>; view: { width: number; height: number };
  seed: number; rec: Recorded; shots: { file: string; moment: string }[];
  /** `MAX_RELAUNCHES` from src/game/bubbles.ts; a sequence pack's reach cannot be read without it (#2251). */
  maxRelaunches: number;
}): Record<string, unknown>;
