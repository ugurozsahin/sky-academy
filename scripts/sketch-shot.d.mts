import type { Page } from '@playwright/test';
import type { Tier } from '../src/three/stage/tiers';
export declare const OUT_DIR: string;
export declare const TIERS: readonly Tier[];
export declare const PAGE: string;
export declare const READY_MS: number;
export declare function shoot(o: { page: Page; base: string; out?: string; tiers?: readonly Tier[] }): Promise<{ shots: string[]; blank: string[]; inks: Record<string, number> }>;
