/**
 * Extended Critical User Journey tests — added in the 2026-06-13 QA pass.
 *
 * Two purposes:
 *  1. Cover journeys that cuj-staging.spec.ts does NOT touch (Life tab, Profile,
 *     Rewards-as-primary, Settings) — these were render-untested.
 *  2. Encode a CONFIRMED Critical defect as a tracked guard: signing out does not
 *     wipe sensitive on-device data (health / food / blood reports), so on a
 *     shared device the next account inherits the previous user's health data.
 *     See src/utils/signOut.ts — it clears only the session + OAuth tokens + the
 *     in-memory user store; the localStorage health tables survive.
 *
 * HOW TO RUN — this file is intentionally NOT matched by the `cuj` project (which
 * is pinned to cuj-staging.spec.ts), so run it explicitly under the chromium
 * project; the baseURL below points it at the same staging target:
 *
 *     npx playwright test e2e/cuj-extended.spec.ts
 *     CUJ_BASE_URL=http://localhost:4180 npx playwright test e2e/cuj-extended.spec.ts   # served dist
 *
 * Philosophy mirrors cuj-staging.spec.ts: assert a business outcome a human QA
 * tester would verify, and read persisted state (not just the UI) where it matters.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedAuthedUser, captureErrors, assertNotBlank } from './helpers';

test.use({ baseURL: process.env.CUJ_BASE_URL ?? 'https://lifeos-6r5-eqa.pages.dev' });

/** Land on root first so the auth guard resolves the seeded session, then go on. */
async function navigateTo(page: Page, path: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => {});
  if (path !== '/') await page.goto(path, { waitUntil: 'domcontentloaded' });
}

/**
 * Seed the sensitive, device-only tables the privacy contract (CLAUDE.md +
 * terms-privacy) says must never outlive the session on the device. seedAuthedUser
 * does not seed these, so we add them here. Keys mirror the web store
 * (src/db/webStorage/_keys.ts): health logs, food entries, blood reports.
 */
async function seedSensitiveLocalData(page: Page) {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    localStorage.setItem('lifeos_health_logs', JSON.stringify([
      { id: 'qa-hl-1', userId: 'e2e-user-1', date: today, weight: 72.5, createdAt: now, updatedAt: now },
    ]));
    localStorage.setItem('lifeos_food_entries', JSON.stringify([
      { id: 'qa-fe-1', userId: 'e2e-user-1', date: today, foodName: 'QA Oats', calories: 300, mealType: 'breakfast', createdAt: now, updatedAt: now },
    ]));
    localStorage.setItem('lifeos_blood_reports', JSON.stringify([
      { id: 'qa-br-1', userId: 'e2e-user-1', date: today, summary: 'QA report', parsedMarkers: '[]', createdAt: now, updatedAt: now },
    ]));
  });
}

// ── CUJ-EXT 1: Sign-out must wipe sensitive on-device data ─────────────────────
//
// Human equivalent: "I share a laptop. I log out, my partner logs into their own
// LifeOS account — they must NOT see my weight history, food log, or blood report."
//
// KNOWN DEFECT C1 (confirmed 2026-06-13): signOutEverything() does not clear these
// tables, so this assertion fails today. Marked test.fail() so CI stays green while
// it's an open bug AND flips red the moment it's fixed (signal to delete the
// annotation). Fix: have signOutEverything() clear every key in webStorage/_keys.ts
// plus the finance Dexie DB.

test.describe('CUJ-EXT 1 — Signing out wipes sensitive on-device data', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
    await seedSensitiveLocalData(page);
  });

  test('after logout, health / food / blood-report rows are gone from local storage', async ({ page }) => {
    // DEFECT C1 — FIXED IN SOURCE 2026-06-13 (signOutEverything → clearAllLocalData).
    // Was verified live on staging: after logout the health/food/blood rows remained
    // (Received {health:1,food:1,blood:1} vs Expected all-0). The CUJ project still
    // targets the staging deployment, which runs the OLD build until the next deploy,
    // so this stays expected-fail until then. Remove this line once the fix is
    // deployed (the guard will then go green and flag the stale annotation).
    test.fail();
    const { pageErrors } = captureErrors(page);
    // Land on Today, then TAP the Profile tab (client-side). A hard
    // page.goto('/(tabs)/profile') can race the auth-guard redirect on the static
    // export and abort the frame (net::ERR_ABORTED).
    await navigateTo(page, '/');
    await page.getByRole('tab', { name: /profile/i })
      .or(page.getByText('Profile', { exact: true })).first().click();

    // Sanity: the sensitive data is present while signed in.
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lifeos_health_logs') ?? '[]').length);
    expect(before, 'precondition: health data seeded').toBeGreaterThan(0);

    const logout = page.getByText('Log out', { exact: true }).first()
      .or(page.getByRole('button', { name: /log out/i }).first());
    await logout.scrollIntoViewIfNeeded().catch(() => {});
    await expect(logout).toBeVisible({ timeout: 15_000 });
    await logout.click();

    // Sign-out should drop us off the authed tab surface.
    await page.waitForURL((u) => u.pathname.includes('sign') || !u.pathname.includes('(tabs)'),
      { timeout: 15_000 }).catch(() => {});

    const remaining = await page.evaluate(() => ({
      health: JSON.parse(localStorage.getItem('lifeos_health_logs') ?? '[]').length,
      food: JSON.parse(localStorage.getItem('lifeos_food_entries') ?? '[]').length,
      blood: JSON.parse(localStorage.getItem('lifeos_blood_reports') ?? '[]').length,
    }));
    // The whole point: nothing sensitive may survive a sign-out.
    expect(remaining, 'sensitive health data must NOT survive sign-out').toEqual({ health: 0, food: 0, blood: 0 });
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ-EXT 2: Previously render-untested screens mount without crashing ───────
//
// CUJ 4 covers the six engine tabs. These four user-facing destinations had no
// crash/blank guard at all: the Life dashboard, Profile, Rewards (as a primary
// destination, not a post-action check), and Settings.

const UNCOVERED_SCREENS = [
  { path: '/(tabs)/life', label: 'Life' },
  { path: '/(tabs)/profile', label: 'Profile' },
  { path: '/(tabs)/rewards', label: 'Rewards' },
  { path: '/settings', label: 'Settings' },
] as const;

test.describe('CUJ-EXT 2 — Uncovered screens render without blanking or console errors', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  for (const { path, label } of UNCOVERED_SCREENS) {
    test(`${label} (${path}) mounts cleanly`, async ({ page }) => {
      const { pageErrors, consoleErrors } = captureErrors(page);
      await navigateTo(page, path);
      await page.waitForTimeout(1500); // let lazy sections + animations settle

      const childCount = await assertNotBlank(page);
      expect(childCount, `${label} should not be blank (React #130 white screen)`).toBeGreaterThan(20);
      expect(pageErrors, `${label} threw:\n${pageErrors.join('\n')}`).toEqual([]);
      expect(consoleErrors, `${label} console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    });
  }
});
