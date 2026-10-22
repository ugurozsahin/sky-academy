// Types for the website's static server (see scripts/site-serve.mjs, #2096), for tests/site/ and tests/unit/site-e2e.test.ts.
export type Mounts = Array<[prefix: string, dir: string]>;
export declare const MOUNTS: Mounts;
export declare const TYPES: Record<string, string>;
export declare function resolvePath(urlPath: string, mounts?: Mounts): { file: string } | { redirect: string } | null;
export declare function serve(options?: { port?: number; mounts?: Mounts }): Promise<{ origin: string; close: () => Promise<void> }>;
