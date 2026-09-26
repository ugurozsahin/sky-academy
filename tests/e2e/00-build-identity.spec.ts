import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #123: `reuseExistingServer: true` on a fixed port let a reviewer running two worktrees silently attach to
 * the WRONG build — the served app came from whichever checkout's `vite preview` happened to start first,
 * while the spec file came from wherever the run was invoked. No error, a pass or a fail that is evidence
 * about a different tree. `playwright.config.ts` now derives the preview port from `process.cwd()` so two
 * different checkouts (mostly) cannot collide on the same port any more — but "mostly" is not "cannot", and
 * even a single checkout can serve a stale build if `vite preview` was left running from before the last
 * `npm run build`. This test is the loud check for both: run first (file name sorts before every other e2e
 * spec), it fails hard and says exactly why rather than letting 50-odd unrelated tests fail mysteriously
 * downstream, which is the failure mode #123 recorded actually happening.
 *
 * The comparison is the service-worker cache name `scripts/build-sw.mjs` already computes from the build's
 * own contents (`sna-<12 hex>`, `dist/sw.js`) — it changes whenever any precached file differs in name, size
 * or bytes, so two builds with the same cache name are the same build for every purpose this check needs.
 */
test('the e2e server is serving the build on disk here, not a leftover from another checkout (#123)', { tag: '@smoke' }, async ({ page, baseURL }) => {
  const distSwPath = join(process.cwd(), 'dist', 'sw.js');
  let localSw: string;
  try {
    localSw = readFileSync(distSwPath, 'utf8');
  } catch {
    throw new Error(`${distSwPath} is missing — run \`npm run build\` before the e2e suite (it writes dist/sw.js).`);
  }
  const local = localSw.match(/sna-[0-9a-f]{12}/)?.[0];
  expect(local, `${distSwPath} has no sna-<hash> cache name — was it written by scripts/build-sw.mjs?`).toBeTruthy();

  const res = await page.request.get(`${baseURL}/sw.js`);
  expect(res.ok(), `the preview server at ${baseURL} did not serve /sw.js at all`).toBeTruthy();
  const served = (await res.text()).match(/sna-[0-9a-f]{12}/)?.[0];
  expect(served, `${baseURL}/sw.js has no sna-<hash> cache name`).toBeTruthy();

  expect(
    served,
    `served build is "${served}" but dist/ here is "${local}" (#123): the preview server ` +
      `(reuseExistingServer: true) is answering with a DIFFERENT build than the one just made in this ` +
      `checkout — likely a leftover \`vite preview\` from another run or an earlier build never rebuilt. ` +
      `Kill any stray \`vite preview\` process and re-run \`npm run build\` before re-running e2e.`,
  ).toBe(local);
});
