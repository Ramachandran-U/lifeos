/**
 * Goals "Today's Tasks" completion flow — #77 coverage.
 *
 * #77 made goal nodes feed the Life Score on completion. A daily goal renders in
 * the "Today's Tasks" list on the Goals tab; tapping it calls handleCompleteTask
 * → updateGoalStatus(..., 'completed') → completeGoalNode(...) → reload. The task
 * then drops out of the active "Today's Tasks" list (filter is level==='daily' &&
 * status==='active'). This spec seeds a daily task, taps it, and asserts it both
 * does NOT crash and leaves the active list.
 *
 * `chromium` project — seeds its own localStorage, real tap interaction.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser, captureErrors, assertNotBlank, type SeedGoal } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

const GOALS: SeedGoal[] = [
  // A top-level life goal so the tree (and TrajectoryCard) renders, exercising
  // the goal-card render path #77 touched.
  { id: 'e2e-goal-life', title: 'Become a polymath', goalType: 'personal', level: 'life' },
  // The daily task under test — must be level 'daily' + status 'active' to land
  // in the "Today's Tasks" list.
  { id: 'e2e-task-1', title: 'Read 20 pages', goalType: 'learning', level: 'daily' },
  { id: 'e2e-task-2', title: 'Log a workout', goalType: 'health', level: 'daily' },
];

test.describe("Goals — complete a Today's Task [#77]", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { goals: GOALS });
  });

  test('tap a daily task → it completes and leaves the active list, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    // Bootstrap at root so auth settles, then go to the Goals tab.
    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);
    await page.goto('/(tabs)/goals');

    // Module header + the seeded task render.
    await expect(page.getByText('Goals').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Today's Tasks")).toBeVisible({ timeout: 10_000 });

    const task = page.getByText('Read 20 pages');
    await expect(task).toBeVisible();
    await task.click();

    // After completion the task drops out of the active "Today's Tasks" list.
    await expect(page.getByText('Read 20 pages')).toHaveCount(0, { timeout: 8_000 });

    // The second daily task is still there (we only completed one) — proves the
    // list re-rendered rather than blanking.
    await expect(page.getByText('Log a workout')).toBeVisible();

    // No crash signals.
    const childCount = await assertNotBlank(page);
    expect(childCount, 'Goals screen should not be blank after completing a task').toBeGreaterThan(20);
    expect(pageErrors, `completing a daily task threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
