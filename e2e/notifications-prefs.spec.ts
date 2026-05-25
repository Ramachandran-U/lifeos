/**
 * Notification preferences E2E.
 *
 * Regression test for the silent storage bug on mobile (Platform.OS !== 'web'
 * guard was inverted, so toggles appeared to persist within a session but
 * reset every cold start). The fix mirrors the cross-platform pattern from
 * utils/feedback.ts: localStorage on web, AsyncStorage on native.
 *
 * On web (this runner) we assert localStorage roundtrip. The native path
 * needs a separate mobile-runner test, but the codepaths share enough that
 * this catches the inverted-guard regression specifically.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

const STORAGE_KEY = 'lifeos.notifications.prefs';

test.describe('Notifications settings — toggle persistence', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
    // Wipe any leftover prefs from a previous test so we always start at
    // defaults (all-on) rather than inherited state.
    await page.addInitScript((key: string) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
  });

  test('toggle off → reload → still off', async ({ page }) => {
    await page.goto('/notifications-settings');

    // Wait for the screen to hydrate (header is the most reliable anchor).
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

    // Defaults are all-on. Flip "Morning routine" off.
    const morningSwitch = page.getByRole('switch').first();
    await expect(morningSwitch).toBeVisible();
    await morningSwitch.click();

    // Verify storage write happened.
    const after = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(after).toBeTruthy();
    const parsed = JSON.parse(after as string);
    expect(parsed.daily_routine).toBe(false);

    // Reload and confirm the toggle came back off — this is what the
    // previous bug would have got wrong on native (toggle reset to true).
    await page.reload();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
    const afterReload = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    const reparsed = JSON.parse(afterReload as string);
    expect(reparsed.daily_routine).toBe(false);
  });
});
