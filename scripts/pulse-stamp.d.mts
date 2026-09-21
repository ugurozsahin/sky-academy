/** Minute-truncated UTC, the format every pulse body opens with: `2026-09-21T12:39Z`. */
export declare const stamp: (at?: Date | number | string) => string;
export declare const STAMP_RE: RegExp;
/** The epoch ms the body's opening stamp names, or `null` when it opens with no readable one. */
export declare function readStamp(body: string): number | null;
/** Signed minutes the stamp runs ahead of the write that carried it; negative is healthy. */
export declare function driftMinutes(body: string, writtenAt: string | number | Date): number | null;
export declare const AHEAD_TOLERANCE_MIN: number;
export declare function check(body: string, writtenAt: string | number | Date):
  { ok: boolean; drift: number | null; reason: string };
