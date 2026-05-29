/**
 * Post sign-in routing E2E.
 *
 * Two cases the route guard in src/utils/routeGuard.ts decides between:
 *   - onboardingStage >= 100  → /(tabs) (Today)
 *   - onboardingStage <  100  → /(onboarding)/day1-vision
 *
 * The "onboarded" case is implicitly proved by auth.setup.ts. We strengthen
 * it here with an explicit URL assertion, and add the "fresh user" case
 * which the setup spec can't reach (the persistent test user is already
 * onboarded forever).
 */
import { test, expect } from '@playwright/test';
import { createEphemeralUser, type EphemeralUser } from './ephemeralUser';

// This spec uses the storage state from auth.setup.ts for the onboarded
// case, then a fresh browser context for the ephemeral case. Using both
// projects' patterns in one file keeps the assertion local to the unit of
// behavior under test.

test.describe('Post sign-in routing', () => {
  test('onboarded user lands on Today, not onboarding', async ({ page }) => {
    // Storage state already authenticates us. Going to root should resolve
    // to /(tabs) via the guard, never to /day1-vision.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="aurora-bg"]').first()).toBeVisible({
      timeout: 15_000,
    });
    // URL stays at root (or rewrites to /(tabs) — we just assert no
    // onboarding path leaked through).
    expect(page.url()).not.toMatch(/day1-vision|onboarding/);
  });

  test('fresh user is routed to day1-vision after sign-in', async ({ browser }) => {
    let user: EphemeralUser | null = null;
    try {
      user = await createEphemeralUser();

      // Fresh browser context — no stored auth, no seeded localStorage.
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';

      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.getByText('Sign in', { exact: true }).first().click();
      await page.waitForTimeout(1500);

      await page.getByPlaceholder('you@example.com').fill(user.email);
      await page.getByPlaceholder('Your password').fill(user.password);
      await page.getByText('Sign in', { exact: true }).last().click();

      // A user with no local SQLite row defaults to onboardingStage=0
      // (see app/(auth)/sign-in.tsx line 60). The route guard then sends
      // them to /(onboarding)/day1-vision.
      await page.waitForURL(/day1-vision/, { timeout: 15_000 });
      expect(page.url()).toMatch(/day1-vision/);

      await ctx.close();
    } finally {
      if (user) await user.cleanup();
    }
  });
});
