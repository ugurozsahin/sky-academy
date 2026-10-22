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
export interface Recorded {
  screen: Screen; samples: Sample[] | null; frames: number[]; labels: string[]; promptAt: number | null; speech: Spoken | null;
  extra: Record<string, unknown>; voices?: number;
}
export declare const KEYPAD_PACKS: PackJob[];
export declare function plannedPacks(cat: { games: Record<string, { years: Record<string, unknown> }> }, filter?: { year?: string | null; only?: string[] | null }): PackJob[];
export declare function parseArgs(argv: string[]): { base?: string; out?: string; year: string | null; only: string[] | null };
export declare function countWords(text: string | null | undefined): number;
export declare function flightMetrics(samples: Sample[], o: { H: number; cardBottom: number; answer?: string | null; speechEnd?: number | null }): FlightSummary;
export declare const FRAME_CLAMP_MS: number;
export declare function frameStats(times: number[]): { count: number; maxGapMs: number; clean: boolean };
export declare const speechMode: (o: { autoplays: boolean; offered: boolean }) => 'auto' | 'tap' | 'none';
export declare const cardShare: (rect: { width: number; height: number }, view: { width: number; height: number }) => number;
export declare const ABOUT: Record<string, string>;
export declare function buildMetrics(o: {
  job: PackJob; input: 'bubbles' | 'tracing' | 'keypad'; settings: Record<string, unknown>; view: { width: number; height: number };
  seed: number; rec: Recorded; shots: { file: string; moment: string }[];
}): Record<string, unknown>;
