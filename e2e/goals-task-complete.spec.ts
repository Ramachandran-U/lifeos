/**
 * Daily-task completion flow — #77 coverage, relocated to Today's hero.
 *
 * today_answer_first_v1 DELETED the Goals-tab "YOUR NEXT MOVE" card; the
 * answer now lives on Today as NextMoveHero (testIDs next-move-hero /
 * next-move-primary). A daily goal (level 'daily' + status 'active') becomes
 * the hero's next move once no upcoming block outranks it — blocks are seeded
 * EMPTY for exactly that reason (useNextMove resolves block → task → dayDone
 * → plan). Completing it runs the same #77 pipeline the Goals tab used:
 * updateGoalStatus(..., 'completed') → completeGoalNode(...) → reload. This
 * spec seeds two daily tasks, completes the hero one, and asserts it both
 * does NOT crash and leaves the active queue (next task takes the hero,
 * persisted status flips to 'completed').
 *
 * `chromium` project — seeds its own localStorage, real tap interaction.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser, captureErrors, assertNotBlank, type SeedGoal } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

const GOALS: SeedGoal[] = [
  // A top-level life goal so the goal hierarchy data path #77 touched stays
  // exercised (the daily tasks live alongside it in the same store).
  { id: 'e2e-goal-life', title: 'Become a polymath', goalType: 'personal', level: 'life' },
  // The daily task under test — must be level 'daily' + status 'active' to
  // resolve as the hero's next move.
  { id: 'e2e-task-1', title: 'Read 20 pages', goalType: 'learning', level: 'daily' },
  { id: 'e2e-task-2', title: 'Log a workout', goalType: 'health', level: 'daily' },
];

test.describe("Goals — complete a daily task via Today's hero [#77]", () => {
  test.beforeEach(async ({ page }) => {
    // blocks: [] — an upcoming block would outrank the daily task in the hero.
    await seedAuthedUser(page, { goals: GOALS, blocks: [] });
  });

  test('tap a daily task → it completes and leaves the active list, no crash', async ({ page }) => {
    const { consoleErrors, pageErrors } = captureErrors(page);

    // Bootstrap at root so auth settles; the hero lives on Today itself.
    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => undefined);

    // §3.2: daily tasks are surfaced in Today's NextMoveHero.
    const hero = page.getByTestId('next-move-hero');
    await expect(hero).toBeVisible({ timeout: 15_000 });

    // The first seeded daily task appears as the next-move title, sourced
    // from the goals queue (eyebrow reads NEXT · GOALS).
    await expect(hero.getByText('Read 20 pages')).toBeVisible({ timeout: 10_000 });
    await expect(hero.getByText('NEXT · GOALS')).toBeVisible();

    // Completion is via the hero's primary ("Mark done"), not a tap on the title.
    await page.getByTestId('next-move-primary').click();

    // After completion the task leaves the hero — the next task takes over.
    await expect(hero.getByText('Log a workout')).toBeVisible({ timeout: 8_000 });

    // The completed task is no longer anywhere on Today (it left the active
    // queue — the hero only renders active daily goals).
    await expect(page.getByText('Read 20 pages')).toHaveCount(0, { timeout: 8_000 });

    // And the completion PERSISTED — the #77 outcome (status flip feeding the
    // Life Score), not merely a hidden card.
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const goals = JSON.parse(localStorage.getItem('lifeos_goals') ?? '[]') as Array<{ id: string; status: string }>;
          return goals.find((g) => g.id === 'e2e-task-1')?.status ?? null;
        } catch { return null; }
      }), { timeout: 8_000 })
      .toBe('completed');

    // No crash signals.
    const childCount = await assertNotBlank(page);
    expect(childCount, 'Today should not be blank after completing a task').toBeGreaterThan(20);
    expect(pageErrors, `completing a daily task threw:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
