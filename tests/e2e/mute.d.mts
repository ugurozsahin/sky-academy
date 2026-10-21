// Types for `./mute.mjs` (#2148), so the e2e fixture, the unit rail and the scripts' callers can import it.
import type { Browser, BrowserType, LaunchOptions } from '@playwright/test';

export declare const MUTE_ARGS: string[];
export declare function muteSpeech(): void;
export declare function launchSilent(chromium: BrowserType, options?: LaunchOptions): Promise<Pick<Browser, 'newContext' | 'newPage' | 'close'>>;
