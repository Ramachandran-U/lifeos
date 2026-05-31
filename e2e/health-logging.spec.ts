/**
 * Health quick-logging flows — #72 / #74 / #75 coverage (water + energy).
 *
 * The Health tab ships always-visible WaterCard and EnergyCard quick-loggers.
 * Each tap writes a health_log row (waterMl / energyLevel) and the parent
 * reloads, re-rendering the card with the new total/selection. These are the
 * mutate-then-re-render flows unit tests can't catch. No AI, no flags, no
 * collapsible — both cards render on first paint.
 *
 * `chromium` project — seeds its own localStorage, real tap interactions.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser, captureErrors, assertNotBlank } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Health — water & energy quick-log [#72/#74/#75]', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('log water → total increments; log energy → selection reflects, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);
    await page.goto('/(tabs)/health');

    // Health tab mounts; HYDRATION card is a stable anchor.
    await expect(page.getByText('Health').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('HYDRATION')).toBeVisible({ timeout: 10_000 });

    // ── Water: starts at 0.0 L. Adding 500ml twice → 1.0 L (goal 2.5 L). ──
    // The "0 / 2.5 L" total is rendered as separate text nodes, so assert via
    // the accessible add buttons instead. After two adds the Undo affordance
    // (only shown when totalMl > 0) must appear — proof the log persisted and
    // the card re-rendered.
    const add500 = page.getByRole('button', { name: 'Add 500 millilitres of water' });
    await expect(add500).toBeVisible();
    await add500.click();
    await add500.click();

    // Undo only renders once totalMl > 0 → confirms the increment took effect.
    await expect(page.getByRole('button', { name: 'Undo last water' })).toBeVisible({ timeout: 8_000 });

    // The persisted water rows are summed for today. 2 × 500ml = 1000ml.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          try {
            const logs = JSON.parse(localStorage.getItem('lifeos_health_logs') || '[]') as Array<{ date: string; waterMl?: number }>;
            const today = new Date().toISOString().slice(0, 10);
            return logs.filter((l) => l.date === today).reduce((s, l) => s + (l.waterMl ?? 0), 0);
          } catch {
            return -1;
          }
        }), { timeout: 8_000 })
      .toBe(1000);

    // ── Energy: tap "Good" (level 4). The header then shows the level label. ──
    const energyGood = page.getByRole('button', { name: 'Energy Good' });
    await expect(energyGood).toBeVisible();
    await energyGood.click();

    // Selecting an energy level persists energyLevel=4 and re-renders the header
    // with the matching label.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          try {
            const logs = JSON.parse(localStorage.getItem('lifeos_health_logs') || '[]') as Array<{ date: string; energyLevel?: number }>;
            const today = new Date().toISOString().slice(0, 10);
            return logs.filter((l) => l.date === today && l.energyLevel != null).map((l) => l.energyLevel).pop() ?? null;
          } catch {
            return null;
          }
        }), { timeout: 8_000 })
      .toBe(4);

    // No crash signals across both mutations.
    const childCount = await assertNotBlank(page);
    expect(childCount, 'Health screen should not be blank after logging').toBeGreaterThan(20);
    expect(pageErrors, `health logging threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
