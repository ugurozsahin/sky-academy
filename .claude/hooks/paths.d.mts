// Declarations for paths.mjs (#271). The export names are held equal to the .mjs by tests/unit/declarations.test.ts.
export type ProtectedKind = 'marker' | 'claude' | 'root';
export declare const OWNER_MARKER: string;
export declare const canonical: (path: string) => string;
export declare const projectDir: (root?: string) => string;
export declare const PROTECTED_SPELLING: RegExp;
export declare const protectedKind: (spelled: string, base: string) => ProtectedKind | null;
