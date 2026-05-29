/**
 * Sign-out E2E.
 *
 * Real-auth path only — proves the Log out button actually clears the
 * Supabase session, not just the in-memory zustand store. A regression here
 * would mean a user can "sign out" and still have their JWT in localStorage
 * (security + demo embarrassment).
 *
 * Storage state from auth.setup.ts puts us in an authenticated session.
 */
import { test, expect } from '@playwright/test';

test.describe('Sign out — real auth', () => {
  test('Log out clears Supabase session and routes to sign-in', async ({ page }) => {
    // Land on Today via the stored auth session.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="aurora-bg"]').first()).toBeVisible({
      timeout: 15_000,
    });

    // Before logout: Supabase persists its session under a key prefixed
    // with `sb-` and ending in `-auth-token`. Confirm one exists, so the
    // post-logout assertion is meaningful.
    const tokenKeyBefore = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return k;
      }
      return null;
    });
    expect(tokenKeyBefore, 'expected a Supabase token in localStorage before logout').not.toBeNull();

    // Go to Profile and wait for it to fully render. Without this wait the
    // Log out node gets re-rendered between locator resolution and the
    // click, producing "Element is not attached to the DOM".
    await page.goto('/(tabs)/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('APPEARANCE')).toBeVisible({ timeout: 10_000 });

    // Profile is a ScrollView (RN). Web maps that to a div with overflow,
    // not native page scroll — so scrollIntoViewIfNeeded won't help. Scroll
    // the inner container programmatically until the button is in view.
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent === 'Log out',
      );
      el?.scrollIntoView({ block: 'center' });
    });

    // Click with a longer timeout — Playwright auto-retries on detach.
    await page.getByText('Log out', { exact: true }).click({ timeout: 15_000 });

    // Should land on /sign-in (handleLogout in profile.tsx routes there
    // directly via router.replace).
    await page.waitForURL(/\/sign-in/, { timeout: 10_000 });

    // The Supabase auth token must be gone. If it isn't, signOut() either
    // didn't run or didn't await before navigation.
    const tokenAfter = await page.evaluate((key) => localStorage.getItem(key), tokenKeyBefore!);
    expect(tokenAfter, 'Supabase token should be cleared after logout').toBeNull();

    // Reload — we must stay at the auth screen, not bounce back into the app.
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(page.url()).toMatch(/\/sign-in|\/welcome/);
  });
});
