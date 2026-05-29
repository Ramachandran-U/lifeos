/**
 * Fresh-user onboarding E2E.
 *
 * Walks an ephemeral Supabase user through the full Day 1 flow:
 *   day1-vision → day1-career → day1-routine → /(tabs)
 *
 * Requires:
 *   - SUPABASE_SERVICE_ROLE_KEY in the runner's env (admin user creation +
 *     cleanup; see e2e/ephemeralUser.ts).
 *   - The web build must be compiled with EXPO_PUBLIC_USE_AI_MOCK=true so
 *     decomposeGoal / analyseSkillGap / generateRoutine return their static
 *     mocks instead of hitting the Cloudflare Worker. CI sets this already
 *     (see .github/workflows/e2e.yml); for local runs rebuild dist with the
 *     env var set.
 *
 * This spec deliberately doesn't reuse the persistent test user — that user
 * is already onboarded (see auth.setup.ts seeding) and the onboarding screens
 * can't be re-entered.
 */
import { test, expect } from '@playwright/test';
import { createEphemeralUser, type EphemeralUser } from './ephemeralUser';

test.describe('Fresh-user onboarding', () => {
  test('day1-vision → career → routine → Today', async ({ browser }) => {
    let user: EphemeralUser | null = null;
    try {
      user = await createEphemeralUser();

      // Fresh context — no storage state, no seeded localStorage.
      const ctx = await browser.newContext();
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

      // Guard routes a fresh user to day1-vision.
      await page.waitForURL(/day1-vision/, { timeout: 15_000 });

      // ── Day 1 — vision ────────────────────────────────────────────────
      await expect(page.getByText("What's your vision for your life?")).toBeVisible({
        timeout: 10_000,
      });
      await page
        .getByPlaceholder(/I want to lead a product team/i)
        .fill('Ship a B2B SaaS, stay strong, and have time for family.');
      await page.getByPlaceholder('28').fill('30');
      await page.getByText('Build my plan', { exact: true }).click();

      // Mock AI returns instantly. Preview cards appear; the confirm button
      // is rendered last.
      await expect(page.getByText('YOUR LIFE PLAN')).toBeVisible({ timeout: 10_000 });
      await page.getByText('This looks right', { exact: true }).click();

      // ── Day 1 — career ────────────────────────────────────────────────
      await page.waitForURL(/day1-career/, { timeout: 10_000 });
      await page.getByPlaceholder('e.g. Software Engineer').fill('Backend Engineer');
      await page.getByPlaceholder('e.g. Senior Product Manager').fill('Engineering Manager');
      // Skip adding skills — analyseSkillGap doesn't require them.
      await page.getByText('Analyse my skill gaps', { exact: true }).click();
      await expect(page.getByText('Start building these skills', { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByText('Start building these skills', { exact: true }).click();

      // ── Day 1 — routine ───────────────────────────────────────────────
      await page.waitForURL(/day1-routine/, { timeout: 10_000 });
      await expect(page.getByText('Build your daily routine')).toBeVisible({ timeout: 10_000 });
      // Defaults (wake/sleep/work times) are fine — just generate.
      await page.getByText('Generate my routine', { exact: true }).click();
      await expect(page.getByText('Save my routine', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByText('Save my routine', { exact: true }).click();

      // ── Lands on Today ────────────────────────────────────────────────
      // router.replace('/(tabs)') in day1-routine.tsx. URL ends up at root
      // or /(tabs). Today renders the aurora background; we already
      // exercise stricter Today assertions in other specs.
      await page.waitForURL((url) => !url.pathname.includes('day1-'), { timeout: 15_000 });
      await expect(page.locator('[data-testid="aurora-bg"]').first()).toBeVisible({
        timeout: 10_000,
      });

      await ctx.close();
    } finally {
      if (user) await user.cleanup();
    }
  });
});
