/**
 * Routine block complete E2E.
 *
 * Highest-ROI test of the app's core promise: a user hold-completes a routine
 * block on Today, the block flips to its completed state, and the "X of Y
 * done" counter increments. No AI, no network — pure UI + zustand + SQLite.
 *
 * The completion gesture is press-and-hold (250ms in RoutineBlock.tsx). We
 * dispatch mouse events directly because Playwright's locator.click() is too
 * fast to clear the hold window.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Routine block — hold to complete', () => {
  // Emulate reduce-motion so RoutineBlock uses its 80ms REDUCED_HOLD_MS window
  // instead of the 250ms default. The completion still fires via the same
  // press-and-hold → setTimeout(commit) path, but a 600ms hold now clears the
  // window by ~7.5x — removing the slow-CI timing flake without masking the
  // behaviour under test.
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('hold the status button → block flips to completed', async ({ page }) => {
    await page.goto('/');

    // Today screen mounts (greeting is the smoke selector and works here too).
    await expect(page.getByText('Good ', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // The seeded block has id 'e2e-block-1' (see e2e/helpers.ts).
    const statusBtn = page.getByTestId('routine-block-e2e-block-1-status');
    await expect(statusBtn).toBeVisible({ timeout: 10_000 });
    await statusBtn.scrollIntoViewIfNeeded();

    // Press and hold past the 250ms HOLD_MS window. 600ms gives generous margin
    // for slow CI environments without making the test slow.
    const box = await statusBtn.boundingBox();
    if (!box) throw new Error('status button has no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    // The completed state replaces the press button with a checkmark icon.
    // The block container stays mounted; the title gets a line-through. We
    // assert on the most observable signal: the "done" counter on the chip.
    // Seeded block count = 1, so after completion the visible chip text reads
    // "… · 1 of 1 done". Use a regex tolerant to surrounding metadata.
    await expect(page.getByText(/1 of 1 done/i)).toBeVisible({ timeout: 5_000 });
  });
});
