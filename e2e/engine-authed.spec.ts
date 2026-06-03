/**
 * Authenticated test user — engine data renders on Today [B-P0].
 *
 * Runs under the `authenticated` project (real Supabase session via auth.setup.ts
 * storageState). Seeds the fully-loaded fixture keyed to the LIVE session id,
 * reloads, and asserts the signed-in persistent test user sees engine data on
 * Today without crashing. This is the real-session counterpart to the chromium
 * with-data specs — it exercises the test-user credentials path end to end.
 *
 * Only runs in CI when the PLAYWRIGHT_TEST_* secrets are configured (the
 * authenticated project depends on `setup`); locally via `npm run e2e:auth`.
 */
import { test, expect } from '@playwright/test';
import { captureErrors, assertNotBlank } from './helpers';
import { seedFixtureForSession } from './seedTestUser';

test.describe('Authenticated test user — engine data on Today [B-P0]', () => {
  test('fully-loaded fixture renders for the signed-in test user', async ({ page }) => {
    const { pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Seed keyed to the live session id (set on sign-in), then reload so the app
    // reads it. Mirrors auth.setup.ts's post-sign-in localStorage injection.
    await seedFixtureForSession(page, 'fullyLoaded');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Greeting proves an onboarded, authenticated Today render with data present.
    await expect(page.getByText('Good ').first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => {
        try { return (JSON.parse(localStorage.getItem('lifeos_routine_blocks') || '[]') as unknown[]).length; } catch { return -1; }
      }), { timeout: 8_000 })
      .toBeGreaterThan(0);

    const childCount = await assertNotBlank(page);
    expect(childCount, 'authed Today should not be blank with seeded data').toBeGreaterThan(20);
    // pageErrors only (a real session may surface benign network console errors
    // not in the shared ignore list).
    expect(pageErrors, `authed Today threw:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});
