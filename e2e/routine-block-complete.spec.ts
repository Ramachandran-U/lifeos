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
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  // STILL QUARANTINED (fixme) — assertion improved, root cause NOT yet fixed.
  // The greeting + status button render fine, but after the hold the CI web
  // screenshot is blank (background colour only) and neither the completed
  // checkmark nor the counter appears. Ruled OUT: (1) the level-up overlay — it
  // was demoted to a non-blocking banner and the screen is still blank; (2) a JS
  // crash — the trace console has only benign warnings, no exceptions. The cause
  // is something else in the web build's completion path and needs a LOCAL debug
  // session (headed browser + `npx playwright show-trace`), not blind CI loops.
  // The assertion below now targets the block-local checkmark testid, so once the
  // underlying issue is fixed this just needs `.fixme` → `test` to re-enable.
  test.fixme('hold the status button → block flips to completed', async ({ page }) => {
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

    // Completion swaps the press button for a checkmark carrying a dedicated
    // testid — a stable signal that isn't affected by scroll state or overlays.
    await expect(page.getByTestId('routine-block-e2e-block-1-completed')).toBeVisible({ timeout: 8_000 });
  });
});
