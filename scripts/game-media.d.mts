// Types for the Pages media script (see scripts/game-media.mjs, #2203), so tests/unit/game-media.test.ts can import it.
export interface Shown { years: string[]; games: string[] }
export interface MediaPlan { ids: string[]; publish: string[]; withheld: string[] }
export declare const CONCURRENCY: number;
export declare function loadShown(cat?: unknown): Promise<Shown>;
export declare function mediaPlan(cat: unknown, shown: Shown): MediaPlan;
export declare function checkFile(base: string, path: string, published: boolean): Promise<string[]>;
export declare function checkMedia(base: string, plan: Pick<MediaPlan, 'publish' | 'withheld'>): Promise<string[]>;
