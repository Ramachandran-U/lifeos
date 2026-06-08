/**
 * Visual regression — gradient progress bars + social score, against committed
 * screenshot baselines. Guards the Aurora "feel alive" work (DELTA Phase 10):
 * the gradient ProgressBar/XpBar fills and the domain-tinted cards. Uses
 * `seedVisualRich` (the test-suite mirror of the run-lifeos `--rich` seed) so the
 * bars render at fixed proportions — Career 75 %, Health 40 %, Social 60 %.
 *
 * Runs ONLY in the dedicated `visual` Playwright project (its own viewport +
 * screenshot config); it is intentionally NOT part of the blocking CI projects
 * because Playwright baselines are platform-specific (this repo's CI is Linux)
 * and must be generated in the target OS. See e2e/README.md § Visual regression.
 *
 * Targets /goals and /social only — both have time-stable headers (no
 * "Good morning/evening" greeting that would vary by run, unlike Today).
 *
 * Update baselines (in the same OS that will assert them):
 *   npm run visual:update
 */
import { test, expect } from '@playwright/test';
import { seedVisualRich } from './helpers';

// Let the 600 ms ProgressBar / 1000 ms XpBar fills (not motion-gated) finish
// before snapping, plus a margin for first-mount layout settle.
const SETTLE_MS = 1800;

const SHOT = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

test.describe('Visual regression — gradient bars [DELTA Phase 10]', () => {
  // No crash/console assertions here — that's the smoke suite's job, and the
  // app's benign offline-proxy fetch (no AI backend on a static serve) surfaces
  // as a pageerror that would falsely trip such a check. A broken screen would
  // fail the screenshot match anyway.
  test('goals — filled GoalCard gradient bars (Career 75% / Health 40%)', async ({ page }) => {
    await seedVisualRich(page);

    await page.goto('/goals');
    await expect(page.getByText('Goals').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ship the mobile app').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);

    await expect(page).toHaveScreenshot('goals-rich.png', SHOT);
  });

  test('social — SocialScoreCard gradient bar at 60/100', async ({ page }) => {
    await seedVisualRich(page);

    await page.goto('/social');
    await expect(page.getByText('Social').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('60').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);

    await expect(page).toHaveScreenshot('social-rich.png', SHOT);
  });
});
