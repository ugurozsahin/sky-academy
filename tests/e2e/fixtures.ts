import { test as base, expect } from '@playwright/test';
import { muteSpeech } from './mute';

/** `test` whose every page has its speech engine at volume 0 (#1460). A test's own `captureSpeech` stub registers later and wins. */
export const test = base.extend({
  context: async ({ context }, use) => { await context.addInitScript(muteSpeech); await use(context); },
});
export { expect };
