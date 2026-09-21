/** Minute-truncated UTC, the format every pulse body opens with: `2026-09-21T12:39Z`. */
export declare const stamp: (at?: Date | number) => string;
export declare const STAMP_RE: RegExp;
/** The epoch ms the body's opening stamp names, or `null` when it opens with no readable one. */
export declare function readStamp(body: string): number | null;
/** The write time as epoch ms, or `null` when it is not an instant with an explicit zone. */
export declare function readWrite(writtenAt: string | number | Date): number | null;
/** Signed minutes the stamp runs ahead of the write that carried it; negative is healthy. */
export declare function driftMinutes(body: string, writtenAt: string | number | Date): number | null;
export declare const AHEAD_TOLERANCE_MIN: number;
export declare const OK: 0;
export declare const FINDING: 1;
export declare const CANNOT_CHECK: 2;
/** `code` is also the CLI's exit code: 0 ok, 1 a finding about the pulse, 2 the check was not made. */
export declare function check(body: string, writtenAt: string | number | Date):
  { code: 0 | 1 | 2; ok: boolean; drift: number | null; reason: string };
