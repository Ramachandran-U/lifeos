/**
 * Today (home) — fully-loaded render [B-P0].
 *
 * The highest-value with-data render: Today folds routine blocks, two days of
 * domain history, and gamification together (the exact combination behind the
 * React #185 yesterdaySnapshot loop). Seeds the full fixture and asserts the home
 * screen mounts and stays rendered with rich data and no crash. `chromium` project.
 */
import { test, expect } from '@playwright/test';
import { captureErrors, assertNotBlank } from './helpers';
import { seedFixtureInitScript } from './seedTestUser';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Today — fully-loaded render [B-P0]', () => {
  test.beforeEach(async ({ page }) => {
    await seedFixtureInitScript(page, 'fullyLoaded');
  });

  test('home screen mounts with full multi-engine data, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);

    // The greeting proves Today mounted with the gamestore + colors hook
    // resolved (smoke's home contract). today_answer_first_v1 renders
    // "Morning/Afternoon/Evening, …" via TodayHeader — anchor on its testID
    // instead of the legacy "Good …" copy.
    await expect(page.getByTestId('today-greeting')).toBeVisible({ timeout: 15_000 });

    // Routine blocks were seeded for today — the with-data home path executed.
    await expect
      .poll(async () => page.evaluate(() => {
        try { return (JSON.parse(localStorage.getItem('lifeos_routine_blocks') || '[]') as unknown[]).length; } catch { return -1; }
      }), { timeout: 8_000 })
      .toBeGreaterThan(0);

    const childCount = await assertNotBlank(page);
    expect(childCount, 'Today should not be blank with full data (React #185 guard)').toBeGreaterThan(20);
    expect(pageErrors, `Today render threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
