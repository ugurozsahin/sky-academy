// Types for the screenshot script (see scripts/site-shots.mjs, #2088), so tests/unit/site-shots.test.ts can import it.
import type { Page } from '@playwright/test';

export declare const SIZES: Record<'phone' | 'desktop', { width: number; height: number }>;
export declare const MAX_BYTES: number;
export declare const SHOTS: { name: string; run: (page: Page) => Promise<unknown> }[];
export declare const shotFiles: () => string[];
export declare const isWebp: (buf: Buffer) => boolean;
export declare function gateProduct(q: string): number;
