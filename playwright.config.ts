import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Auto-load .env.test if present so the authenticated project picks up
// PLAYWRIGHT_TEST_EMAIL/PASSWORD without requiring dotenv-cli. Tiny manual
// parser keeps us off another npm dependency.
const envTestPath = path.join(__dirname, '.env.test');
if (fs.existsSync(envTestPath)) {
  for (const line of fs.readFileSync(envTestPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

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
      // Default project — non-auth e2e suites (career-strategy, voice-assistant,
      // notifications-prefs, routine-block-complete). These build/seed their own
      // state and don't need a real Supabase session.
      name: 'chromium',
      testIgnore: [
        '**/smoke.spec.ts',
        '**/auth.setup.ts',
        '**/ambient.spec.ts',
        // Session/admin-dependent specs belong ONLY to the `authenticated`
        // project (storageState + service-role env). Running them here too —
        // without a session — was the root cause of the red CI builds.
        '**/auth-routing.spec.ts',
        '**/auth-signout.spec.ts',
        '**/onboarding-fresh.spec.ts',
        // Real-session engine spec — needs storageState + a live session id, so
        // it belongs only to the `authenticated` project (would throw under
        // chromium with no session).
        '**/engine-authed.spec.ts',
      ],
      // routine-block-complete uses a press-and-hold gesture that can race on
      // slow CI runners; one retry absorbs the flake without masking real breaks.
      retries: process.env.CI ? 1 : 0,
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
      // Mobile-viewport smoke — same routes, iPhone 13-sized viewport. Catches
      // layout regressions that desktop smoke can't see (collapsed nav, sticky
      // composers overlapping content, off-screen CTAs). Since most LifeOS
      // users are on mobile, this is the more representative pass.
      name: 'smoke-mobile',
      testMatch: ['**/smoke.spec.ts'],
      retries: 1,
      use: {
        ...devices['iPhone 13'],
        baseURL: SMOKE_BASE_URL,
        ignoreHTTPSErrors: false,
      },
    },
    {
      // Authenticated tests — depend on setup, reuse stored session.
      name: 'authenticated',
      testMatch: [
        '**/ambient.spec.ts',
        '**/auth-signout.spec.ts',
        '**/auth-routing.spec.ts',
        '**/onboarding-fresh.spec.ts',
        '**/engine-authed.spec.ts',
      ],
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
