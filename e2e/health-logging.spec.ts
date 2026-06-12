/**
 * Health quick-logging flows — #72 / #74 / #75 coverage (water + energy).
 *
 * module_hierarchy_v1 recomposed Health hero-first: the legacy HYDRATION /
 * ENERGY cards are now plain hairline ROWS under the `Today` SectionTitle.
 * Water logs one 250 ml glass per "+ glass" tap; Energy opens an inline 1–5
 * pill picker. Each tap writes a health_log row (waterMl / energyLevel) and
 * the parent reloads, re-rendering the row with the new total/selection.
 * These are the mutate-then-re-render flows unit tests can't catch. No AI,
 * both rows render on first paint.
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

    // Health tab mounts; the V1 hero is the stable anchor.
    await expect(page.getByText('Health').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('health-hero')).toBeVisible({ timeout: 10_000 });

    // ── Water: starts at 0 ml. One glass = 250 ml; two taps → 500 ml. ──
    // The default seed has no weight baseline, so the goal is the 2500 ml
    // fallback and the row re-renders "250 / 2500 ml" then "500 / 2500 ml" —
    // proof each log persisted and the row re-rendered.
    const addGlass = page.getByRole('button', { name: 'Add a glass of water' });
    await expect(addGlass).toBeVisible({ timeout: 10_000 });
    await addGlass.click();
    await expect(page.getByText('250 / 2500 ml')).toBeVisible({ timeout: 8_000 });
    await addGlass.click();
    await expect(page.getByText('500 / 2500 ml')).toBeVisible({ timeout: 8_000 });

    // The persisted water rows are summed for today. 2 × 250 ml = 500 ml.
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
      .toBe(500);

    // ── Energy: open the inline 1–5 pill picker via the row's Log action,
    // pick level 4. The picker closes and the row shows the logged value. ──
    await page.getByRole('button', { name: 'Log energy' }).click();
    const pill4 = page.getByRole('button', { name: 'Energy 4 of 5', exact: true });
    await expect(pill4).toBeVisible({ timeout: 8_000 });
    await pill4.click();

    // Selecting an energy level persists energyLevel=4 and re-renders the row
    // ("4 / 5", relabelled for re-logging).
    await expect(
      page.getByRole('button', { name: 'Energy 4 of 5, tap to change' }),
    ).toBeVisible({ timeout: 8_000 });
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
