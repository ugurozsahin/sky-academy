// Types for the catalogue screenshot script (see scripts/game-shots.mjs, #2202), so tests/unit/game-shots.test.ts can import it.
export interface ShotJob { kind: 'game' | 'island'; id: string; year: string; thumb: string; shots: string[] }
export declare const SHOT_BYTES: number;
export declare const THUMB_BYTES: number;
export declare const THUMB_CROP: number;
export declare const THUMB_SIZE: number;
export declare const PARALLEL: number;
export declare function plannedJobs(cat?: unknown): ShotJob[];
export declare const plannedFiles: (jobs: ShotJob[]) => string[];
export declare const overCap: (files: { file: string; bytes: number; cap: number }[]) => string[];
export declare function parseArgs(argv: string[]): { base?: string; out?: string; only: string[] | null };
/** Re-encode a PNG screenshot as WebP on `page`'s canvas, optionally a centred `crop` square scaled to `side` (#2205 reuses it). */
export declare const encode: (page: import('@playwright/test').Page, png: Buffer, crop: number, side: number, quality: number) => Promise<string>;
