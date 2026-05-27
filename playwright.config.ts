import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';
const AUTH_STORAGE = path.join(__dirname, '.auth', 'user.json');

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
    // Auth setup — signs in once, saves storage state for authenticated tests.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SMOKE_BASE_URL,
      },
    },
    {
      // Default project — existing local e2e suites (career-strategy, voice-assistant).
      name: 'chromium',
      testIgnore: ['**/smoke.spec.ts', '**/auth.setup.ts', '**/ambient.spec.ts'],
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
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: false,
      },
    },
    {
      // Authenticated tests — depend on setup, reuse stored session.
      name: 'authenticated',
      testMatch: ['**/ambient.spec.ts'],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SMOKE_BASE_URL,
        viewport: { width: 390, height: 844 },
        storageState: AUTH_STORAGE,
      },
    },
  ],
});
