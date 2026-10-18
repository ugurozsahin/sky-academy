// Types for the plain-ESM icon generator (see scripts/pwa-icons.mjs), so tests/unit/pwa-icons.test.ts can import it.
export declare const GROUND: string;
export declare const FOCUS: number;
export declare const SAFE: number;
export declare const WEBP_QUALITY: number;
export declare const ICONS: { file: string; size: number; maskable: boolean }[];
export declare function iconPage(src: string, size: number, maskable: boolean): string;
export declare function imageSize(b: Buffer): { w: number; h: number; kind: string };
export declare function checkedBytes(file: string, size: number, bytes: Buffer): Buffer;
