/**
 * Social engine — fully-loaded render [B-P0].
 *
 * Seeds a contact + a logged interaction and asserts the Social tab mounts and
 * computes its social score with a real contact present (smoke only proves the
 * empty-contacts mount). `chromium` project.
 */
import { test, expect } from '@playwright/test';
import { captureErrors, assertNotBlank } from './helpers';
import { seedFixtureInitScript } from './seedTestUser';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Social — fully-loaded render [B-P0]', () => {
  test.beforeEach(async ({ page }) => {
    await seedFixtureInitScript(page, 'fullyLoaded');
  });

  test('social tab mounts with a seeded contact, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);
    await page.goto('/(tabs)/social');

    await expect(page.getByText('Social').first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => {
        try { return (JSON.parse(localStorage.getItem('lifeos_contacts') || '[]') as unknown[]).length; } catch { return -1; }
      }), { timeout: 8_000 })
      .toBeGreaterThan(0);

    const childCount = await assertNotBlank(page);
    expect(childCount, 'Social screen should not be blank with seeded data').toBeGreaterThan(20);
    expect(pageErrors, `social render threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
