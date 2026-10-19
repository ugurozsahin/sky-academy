// Declarations for bash-guard.mjs (#271). The export names are held equal to the .mjs by tests/unit/declarations.test.ts.
export declare const forcePush: (cmd: string) => string | null;
export declare const ownerMarker: (cmd: string) => string | null;
export declare const worklogAppend: (cmd: string) => string | null;
export declare const claudeWrite: (cmd: string, root?: string) => string | null;
export declare const check: (input: { command?: unknown }, root?: string) => string | null;
