/** The Android package id (`appId`) in capacitor.config.ts's text. Throws when there is none. */
export declare function packageOf(configText: string): string;
/** The assetlinks.json document, or `null` when no fingerprint was supplied. Throws on a malformed one. */
export declare function assetlinks(pkg: string, raw: string | undefined): object[] | null;
