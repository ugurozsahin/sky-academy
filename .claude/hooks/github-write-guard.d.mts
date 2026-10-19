// Declarations for github-write-guard.mjs (#271). The export names are held equal to the .mjs by tests/unit/declarations.test.ts.
export type GuardInput = Record<string, unknown>;
export declare const ownerMarker: (input: GuardInput) => string | null;
// Frozen at runtime (a rail holds that); typed mutable so a test can prove the freeze by trying to write.
export declare const REQUIRED_LINES: { key: string; why: string }[];
export declare const requiredLines: (input: GuardInput) => string | null;
export declare const heartbeatAppend: (input: GuardInput) => string | null;
export declare const frozenLabel: (input: GuardInput) => string | null;
export declare const filePath: (input: GuardInput, root?: string) => string | null;
export declare const BRANCH_PATTERN: string;
export declare const prHead: (input: unknown) => string | null;
export declare const check: (input: unknown, root?: string) => string | null;
