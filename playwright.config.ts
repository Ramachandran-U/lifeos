import { defineConfig, devices } from '@playwright/test';

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Default project — existing local e2e suites (career-strategy, voice-assistant).
      name: 'chromium',
      testIgnore: ['**/smoke.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Deploy smoke — single browser, fresh context per test, retries once.
      name: 'smoke',
      testMatch: ['**/smoke.spec.ts'],
      retries: 1,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SMOKE_BASE_URL,
        // Lock viewport so visual diffs (future) stay stable.
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: false,
      },
    },
  ],
});
