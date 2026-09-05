import { defineConfig, devices } from '@playwright/test';
const executablePath = process.env.PW_CHROMIUM || (process.platform === 'linux' ? '/opt/pw-browsers/chromium' : undefined);
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,   // headless software rendering makes bubble timing occasionally flaky
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
