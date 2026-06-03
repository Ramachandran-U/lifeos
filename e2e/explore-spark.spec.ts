/**
 * Explore (Curiosity/Polymath) engine — fully-loaded render [B-P0].
 *
 * Seeds a today spark + an in-progress expedition and asserts the Explore tab
 * mounts and renders with curiosity data present (the constellation/spark/
 * expedition render path smoke's empty seed never reaches). `chromium` project.
 */
import { test, expect } from '@playwright/test';
import { captureErrors, assertNotBlank } from './helpers';
import { seedFixtureInitScript } from './seedTestUser';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Explore — fully-loaded render [B-P0]', () => {
  test.beforeEach(async ({ page }) => {
    await seedFixtureInitScript(page, 'fullyLoaded');
  });

  test('explore tab mounts with a seeded spark + expedition, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);
    await page.goto('/(tabs)/explore');

    await expect(page.getByText('Explore').first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const sparks = (JSON.parse(localStorage.getItem('lifeos_sparks') || '[]') as unknown[]).length;
          const exps = (JSON.parse(localStorage.getItem('lifeos_expeditions') || '[]') as unknown[]).length;
          return sparks + exps;
        } catch { return -1; }
      }), { timeout: 8_000 })
      .toBeGreaterThan(0);

    const childCount = await assertNotBlank(page);
    expect(childCount, 'Explore screen should not be blank with seeded data').toBeGreaterThan(20);
    expect(pageErrors, `explore render threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
