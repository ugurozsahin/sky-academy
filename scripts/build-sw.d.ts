// Types for the plain-ESM build helper (see scripts/build-sw.mjs), so tests/unit/pwa.test.ts can import it.
import type { Dirent } from 'node:fs';

export declare function listFiles(dir: string, readdir?: (p: string, o: { withFileTypes: true }) => Dirent[]): string[];
export declare function precacheList(files: string[]): string[];
/** `name\0size\0sha256` per file, read from disk — the cache name is derived from this, not from the names. */
export declare function fingerprints(dir: string, list: string[], read?: (p: string) => Buffer | string): string[];
export declare function cacheName(prints: string[]): string;
export declare function renderSw(template: string, list: string[], prints?: string[]): string;
