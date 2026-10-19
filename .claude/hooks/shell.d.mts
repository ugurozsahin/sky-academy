// Declarations for shell.mjs (#271). The export names are held equal to the .mjs by tests/unit/declarations.test.ts.
export type Statement = { words: string[]; redirects: { op: string; target: string }[] };
export declare function parse(cmd: string): Statement[];
export declare const base: (word: string) => string;
export declare function commands(cmd: string): Statement[];
export declare const runsAt: (words: string[], tool: string) => number[];
