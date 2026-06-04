/**
 * Fresh-user onboarding E2E.
 *
 * Walks an ephemeral Supabase user through the current fast-path onboarding:
 *   sign in → welcome-intent (pick 1–3 focus areas) → "Build my day" → /(tabs)
 *
 * The guard sends a stage-0 user to /welcome-intent (src/utils/routeGuard.ts);
 * the legacy day1-vision → career → routine walk is only reachable at stage
 * 1–99 and is no longer the fresh-sign-up entry, so this spec exercises the
 * welcome-intent screen.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the runner's env (admin user creation +
 * cleanup; see e2e/ephemeralUser.ts). welcome-intent makes no AI calls, so the
 * AI-mock build flag isn't needed for this path.
 *
 * This spec deliberately doesn't reuse the persistent test user — that user
 * is already onboarded (see auth.setup.ts seeding) and onboarding can't be
 * re-entered.
 */
import { test, expect } from '@playwright/test';
import { createEphemeralUser, type EphemeralUser } from './ephemeralUser';

test.describe('Fresh-user onboarding', () => {
  test('welcome-intent → pick focus areas → Today', async ({ browser }) => {
    let user: EphemeralUser | null = null;
    try {
      user = await createEphemeralUser();

      // Fresh context — no storage state, no seeded localStorage. The explicit
      // empty storageState stops this context inheriting the authenticated
      // project's saved session (.auth/user.json); otherwise the app boots
      // signed-in as the persistent test user and never shows the welcome
      // "Sign in" link, so the onboarding walk can't start.
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';

      // ── Sign in as the ephemeral user ────────────────────────────────
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.getByText('Sign in', { exact: true }).first().click();
      await page.waitForTimeout(1500);
      await page.getByPlaceholder('you@example.com').fill(user.email);
      await page.getByPlaceholder('Your password').fill(user.password);
      await page.getByText('Sign in', { exact: true }).last().click();

      // Guard routes a fresh user (onboardingStage 0) to the welcome-intent
      // screen — the current fast-path onboarding entry (src/utils/routeGuard.ts).
      await page.waitForURL(/welcome-intent/, { timeout: 15_000 });

      // ── Welcome-intent: pick 1–3 focus areas, then build the day ───────
      await expect(page.getByText('What matters most this season', { exact: false })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByText('Ship a big goal', { exact: true }).click();
      await page.getByText('Feel strong', { exact: true }).click();

      // "Build my day" seeds a starter routine, marks onboarding complete, and
      // router.replace('/(tabs)') → Today (welcome-intent.tsx handleContinue).
      await page.getByText('Build my day', { exact: true }).click();

      // ── Lands on Today ────────────────────────────────────────────────
      await page.waitForURL((url) => !url.pathname.includes('welcome-intent'), { timeout: 15_000 });
      await expect(page.locator('[data-testid="aurora-bg"]').first()).toBeVisible({
        timeout: 10_000,
      });

      await ctx.close();
    } finally {
      if (user) await user.cleanup();
    }
  });
});
