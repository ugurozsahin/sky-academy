import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
// The cloud dev container ships Chromium at a fixed path and blocks `playwright install`; a GitHub runner
// (and a laptop) has its own download under ~/.cache/ms-playwright. Point at the bundled binary only when it
// is really there, or CI launches nothing and every e2e test fails (#74 review). PW_CHROMIUM overrides both.
const bundled = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM || (existsSync(bundled) ? bundled : undefined);
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,   // #32: the suite now runs at 4× (tests/e2e set window.__SNA_FAST), so a flake is a real race to fix, not to silently retry
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
