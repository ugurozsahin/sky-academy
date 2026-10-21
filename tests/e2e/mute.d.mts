// Types for `./mute.mjs` (#2148), so the e2e fixture, the unit rail and the scripts' callers can import it.
import type { BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from '@playwright/test';

/** What `launchSilent` hands back: a page's context stays open until `close()`, unlike `Browser.newPage`. */
export interface SilentBrowser {
  newContext(options?: BrowserContextOptions): Promise<BrowserContext>;
  newPage(options?: BrowserContextOptions): Promise<Page>;
  close(): Promise<void>;
}
export declare const MUTE_ARGS: readonly string[];
export declare function muteSpeech(): void;
export declare function launchSilent(chromium: BrowserType, options?: LaunchOptions): Promise<SilentBrowser>;
