// Types for the Pages media script (see scripts/game-media.mjs, #2203), so tests/unit/game-media.test.ts can import it.
import type { Catalogue } from '../src/config/catalogue';
import type { CatalogueShown } from '../src/curriculum/catalogue-shown';
export interface MediaPlan { ids: string[]; publish: string[]; withheld: string[] }
export declare const CONCURRENCY: number;
export declare function loadShown(cat?: Catalogue): Promise<CatalogueShown>;
export declare function mediaPlan(cat: Catalogue, shown: CatalogueShown): MediaPlan;
export declare function checkFile(base: string, path: string, published: boolean): Promise<string[]>;
export declare function checkMedia(base: string, plan: Pick<MediaPlan, 'publish' | 'withheld'>): Promise<string[]>;
