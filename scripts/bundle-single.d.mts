// Types for the plain-ESM single-file bundler (see scripts/bundle-single.mjs).
/** Strips from `<head>` everything that must not survive into the single-file page (#15, #214 review). */
export declare function stripHead(head: string): string;
