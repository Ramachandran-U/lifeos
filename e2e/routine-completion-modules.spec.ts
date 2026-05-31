/**
 * Routine block completion across ALL module types — the direct #78 regression.
 *
 * The production white-screen (React #130, PR #78) fired when a routine block
 * whose `module` was a NON-domain type (rest / meal / work) was completed:
 * a downstream glyph lookup (`DOMAIN_ICONS['rest']`) was undefined → React #130
 * → blank screen. The existing smoke suite never COMPLETED a block, so it sailed
 * past the bug. This spec seeds one block per module type — the six domains plus
 * the three non-domain types that caused the crash — hold-completes each, and
 * asserts the screen never goes blank and no pageerror is thrown.
 *
 * Belongs to the `chromium` project: it seeds its own localStorage and needs a
 * real press-and-hold interaction, no Supabase session.
 */
import { test, expect } from '@playwright/test';
import {
  seedAuthedUser,
  holdToComplete,
  captureErrors,
  assertNotBlank,
  type SeedBlock,
} from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

// One block per module. The non-domain trio (rest/meal/work) is the exact #78
// repro; the six domains guard against a regression in the other branch.
const MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'meal', 'work'] as const;

const BLOCKS: SeedBlock[] = MODULES.map((m, i) => {
  const hh = String(8 + i).padStart(2, '0'); // 08:00, 09:00, … staggered, all past-or-future is fine
  const eh = String(8 + i).padStart(2, '0');
  return {
    id: `e2e-mod-${m}`,
    startTime: `${hh}:00`,
    endTime: `${eh}:30`,
    title: `${m} block`,
    module: m,
  };
});

test.describe('Routine completion — every module type (no blank screen) [#78]', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { blocks: BLOCKS });
  });

  test('hold-complete each module, including non-domain rest/meal/work — no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    await page.goto('/');
    // Today mounts.
    await expect(page.getByText('Good ', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    // The flow header proves blocks rendered.
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 10_000 });

    for (const m of MODULES) {
      const id = `e2e-mod-${m}`;
      const status = page.getByTestId(`routine-block-${id}-status`);
      await expect(status, `status control for ${m} block should render`).toBeVisible({ timeout: 10_000 });

      await holdToComplete(page, id);

      // Completion swaps the press button for a checkmark with its own testid —
      // a stable signal not affected by scroll/overlays. If this appears, the
      // block re-rendered in its completed state without crashing.
      await expect(
        page.getByTestId(`routine-block-${id}-completed`),
        `${m} block should flip to completed without a blank screen`,
      ).toBeVisible({ timeout: 8_000 });

      // The app must NOT have gone blank — root still has a healthy child count.
      const childCount = await assertNotBlank(page);
      expect(childCount, `screen should not be blank after completing ${m} block`).toBeGreaterThan(20);

      // No uncaught exception (React #130 manifested as a pageerror).
      expect(pageErrors, `completing ${m} block threw:\n${pageErrors.join('\n')}`).toEqual([]);
    }

    // Whole-run console-error gate (filtered for benign web warnings).
    expect(consoleErrors, `console errors during run:\n${consoleErrors.join('\n')}`).toEqual([]);

    // All nine done → the "Every block done" wrap-up card surfaces, proving the
    // completed-count derivation survived the non-domain modules too.
    await expect(page.getByText('Every block done')).toBeVisible({ timeout: 8_000 });
  });
});
