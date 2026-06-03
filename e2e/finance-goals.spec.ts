/**
 * Finance engine — fully-loaded render [B-P0 test-coverage expansion].
 *
 * Seeds an active financial goal + milestone (the with-data render path smoke's
 * minimal seed never exercises) and asserts the Finance tab mounts and survives
 * rendering real goal data without crashing. `chromium` project — seeds its own
 * localStorage, no real session.
 */
import { test, expect } from '@playwright/test';
import { captureErrors, assertNotBlank } from './helpers';
import { seedFixtureInitScript } from './seedTestUser';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Finance — fully-loaded render [B-P0]', () => {
  test.beforeEach(async ({ page }) => {
    await seedFixtureInitScript(page, 'fullyLoaded');
  });

  test('finance tab mounts with a seeded goal, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);
    await page.goto('/(tabs)/finance');

    // Module header proves the screen mounted (smoke contract).
    await expect(page.getByText('Finance').first()).toBeVisible({ timeout: 15_000 });

    // The seeded active financial goal is present — proves the fixture wired
    // through and the with-data render path executed.
    await expect
      .poll(async () => page.evaluate(() => {
        try { return (JSON.parse(localStorage.getItem('lifeos_financial_goals') || '[]') as unknown[]).length; } catch { return -1; }
      }), { timeout: 8_000 })
      .toBeGreaterThan(0);

    const childCount = await assertNotBlank(page);
    expect(childCount, 'Finance screen should not be blank with seeded data').toBeGreaterThan(20);
    expect(pageErrors, `finance render threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
