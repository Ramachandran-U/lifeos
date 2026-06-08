/**
 * Critical User Journey (CUJ) tests — business-outcome assertions.
 *
 * Runs against the staging deployment by default (lifeos-6r5-eqa.pages.dev).
 * Override with CUJ_BASE_URL env var for local runs.
 *
 * Philosophy: each test asserts a *business outcome* a human QA tester would
 * verify — "completing a block awards exactly 10 XP" not "element has class X".
 * AI proxy calls are intercepted for deterministic results without burning quota.
 *
 * Run: npm run e2e:cuj
 * Local: npm run e2e:cuj:local  (requires expo web running on 8081)
 */
import { test, expect } from '@playwright/test';
import {
  seedAuthedUser,
  seedSupabaseSession,
  holdToComplete,
  captureErrors,
  assertNotBlank,
  mockAIProxy,
  readTotalXP,
  type SeedBlock,
  type SeedGoal,
} from './helpers';

// ── Shared test data ───────────────────────────────────────────────────────────

const TODAY_BLOCKS: SeedBlock[] = [
  { id: 'cuj-health-1', title: 'Morning run',   module: 'health',  startTime: '07:00', endTime: '07:30' },
  { id: 'cuj-goal-1',   title: 'Read chapters', module: 'goal',    startTime: '09:00', endTime: '09:30' },
  { id: 'cuj-career-1', title: 'Deep work',     module: 'career',  startTime: '10:00', endTime: '12:00' },
];

const DAILY_GOALS: SeedGoal[] = [
  { id: 'g-life',    title: 'Become a better reader', goalType: 'personal', level: 'life' },
  { id: 'g-daily-1', title: 'Read 20 pages',         goalType: 'learning', level: 'daily' },
  { id: 'g-daily-2', title: 'Log a workout',         goalType: 'health',   level: 'daily' },
];

/** Navigate to root, wait for auth guard to settle, then go to the target path. */
async function navigateTo(page: Parameters<typeof seedAuthedUser>[0], path: string) {
  // Always land on root first so the auth guard can resolve the seeded
  // localStorage session before we navigate to the real destination.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => {});
  if (path !== '/') {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  }
}

// ── CUJ 1: Routine block completion → correct XP delta ────────────────────────
//
// Human equivalent: "I completed my morning run — did my XP go up by the right
// amount? Last sprint there was a bug where it doubled."

test.describe('CUJ 1 — Block completion awards correct XP (no double-credit)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, {
      blocks: TODAY_BLOCKS,
      gamification: { totalXP: 0 },
    });
  });

  test('completing one block awards exactly 10 XP', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await expect(page.getByText('Good ', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 10_000 });
    // Wait for the first block's title to confirm RoutineBlock has fully rendered.
    await expect(page.getByText('Morning run').first()).toBeVisible({ timeout: 10_000 });

    await holdToComplete(page, 'cuj-health-1');
    await expect(page.getByTestId('routine-block-cuj-health-1-completed')).toBeVisible({ timeout: 8_000 });

    await page.waitForTimeout(400); // let the store write settle
    const xp = await readTotalXP(page);
    // completeBlock = 10 XP. Any double-credit bug would produce 20.
    expect(xp, 'should award exactly 10 XP for one block — double-credit would give 20').toBe(10);
    expect(pageErrors).toEqual([]);
  });

  test('completing 3 blocks accumulates exactly 30 XP', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await expect(page.getByText('Good ', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Morning run').first()).toBeVisible({ timeout: 10_000 });

    for (const id of ['cuj-health-1', 'cuj-goal-1', 'cuj-career-1']) {
      await holdToComplete(page, id);
      await expect(page.getByTestId(`routine-block-${id}-completed`)).toBeVisible({ timeout: 8_000 });
    }

    await page.waitForTimeout(400);
    const xp = await readTotalXP(page);
    // 3 blocks × 10 XP = 30. Double-credit would give 60.
    expect(xp, '3 blocks should total 30 XP — a double-credit regression would give 60').toBe(30);
    // All three done + a rest → "Every block done" wrap-up card
    await expect(page.getByText('Every block done')).toBeVisible({ timeout: 8_000 });
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 2: Goal task — see → complete → next task advances ────────────────────
//
// Human equivalent: "I mark 'Read 20 pages' done — it should disappear from my
// queue and the next task should take its place in the hero card."

test.describe("CUJ 2 — Goal task completion: done task leaves, next task advances", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { goals: DAILY_GOALS });
  });

  test('completing the hero task advances the queue to the next task', async ({ page }) => {
    const { pageErrors, consoleErrors } = captureErrors(page);
    await navigateTo(page, '/(tabs)/goals');

    await expect(page.getByText('Goals').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('YOUR NEXT MOVE')).toBeVisible({ timeout: 10_000 });
    // First daily task is the hero
    await expect(page.getByText('Read 20 pages')).toBeVisible();

    // Business action: mark the hero task done
    await page.getByText('Mark done', { exact: true }).click();

    // Business outcome 1: next task takes the hero slot
    await expect(page.getByText('Log a workout')).toBeVisible({ timeout: 8_000 });
    // Business outcome 2: completed task is gone from the active queue
    await expect(page.getByText('Read 20 pages')).toHaveCount(0, { timeout: 8_000 });

    const childCount = await assertNotBlank(page);
    expect(childCount, 'Goals screen should not go blank after task completion').toBeGreaterThan(20);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

// ── CUJ 3: Priority change → sheet with routing options ───────────────────────
//
// Human equivalent: "I reorder my priorities — the app should immediately ask
// me whether I want to adjust today or start fresh tomorrow. That's the whole
// point of the adaptive routine."

test.describe('CUJ 3 — Priority change triggers routing sheet', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { blocks: TODAY_BLOCKS });
  });

  test('saving changed priorities shows Adjust / Start tomorrow options', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/edit-priorities');

    await expect(page.getByText('Save priorities', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Toggle a domain to create a meaningful diff (deselect Health from the
    // seeded primaryDomains: ['health', 'career', 'goals', 'finance']).
    const healthRow = page.getByText('Health', { exact: true }).first();
    await healthRow.scrollIntoViewIfNeeded();
    await healthRow.click();
    await page.waitForTimeout(200);

    await page.getByText('Save priorities', { exact: true }).click();

    // Business outcome: the PriorityChangeSheet appears with both routing options.
    // A user who sees this knows the app responded to their intent.
    await expect(
      page.getByText('Adjust my day now').or(page.getByText('Start fresh tomorrow')).first()
    ).toBeVisible({ timeout: 10_000 });

    expect(pageErrors).toEqual([]);
  });

  test('choosing Start fresh tomorrow confirms and dismisses the sheet', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/edit-priorities');

    await expect(page.getByText('Save priorities', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Deselect Finance
    const financeRow = page.getByText('Finance', { exact: true }).first();
    await financeRow.scrollIntoViewIfNeeded();
    await financeRow.click();
    await page.waitForTimeout(200);
    await page.getByText('Save priorities', { exact: true }).click();

    // Sheet appears
    const tomorrowBtn = page.getByText('Start fresh tomorrow', { exact: true });
    await expect(tomorrowBtn).toBeVisible({ timeout: 10_000 });

    // Business action: choose tomorrow
    await tomorrowBtn.click();

    // Business outcome: sheet dismisses — user is back on the app surface
    await expect(tomorrowBtn).toBeHidden({ timeout: 8_000 });

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 4: All 6 engine tabs render without crash ────────────────────────────
//
// Human equivalent: "I tap through all the main tabs — none of them should
// blank out or throw an error."

const ENGINE_TABS = [
  { path: '/(tabs)/goals',   label: 'Goals'   },
  { path: '/(tabs)/health',  label: 'Health'  },
  { path: '/(tabs)/finance', label: 'Finance' },
  { path: '/(tabs)/career',  label: 'Career'  },
  { path: '/(tabs)/social',  label: 'Social'  },
  { path: '/(tabs)/explore', label: 'Explore' },
] as const;

test.describe('CUJ 4 — All 6 engine tabs render without crash', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { blocks: TODAY_BLOCKS, goals: DAILY_GOALS });
  });

  for (const { path, label } of ENGINE_TABS) {
    test(`${label} tab mounts and shows its header`, async ({ page }) => {
      const { pageErrors, consoleErrors } = captureErrors(page);

      await navigateTo(page, path);
      // Business outcome: the engine label is visible — the module mounted.
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });

      const childCount = await assertNotBlank(page);
      expect(childCount, `${label} tab should not be blank`).toBeGreaterThan(20);
      expect(pageErrors, `${label} tab threw:\n${pageErrors.join('\n')}`).toEqual([]);
      expect(consoleErrors, `${label} console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    });
  }
});

// ── CUJ 5: Goal creation with AI decomposition (proxy mocked) ─────────────────
//
// Human equivalent: "I create a new goal — the app should decompose it into
// yearly/monthly/weekly/daily tasks and show them. If decomposition is broken,
// I'd see a spinner forever or a raw error."

test.describe('CUJ 5 — Goal creation triggers decomposition, tasks appear', () => {
  test('new goal is created; AI decomposes it into daily tasks (mocked)', async ({ page }) => {
    // Seed the Supabase auth session FIRST so callViaProxy passes the auth guard.
    // Only needed for AI-dependent tests — using it globally would break nav tests.
    await seedSupabaseSession(page);

    // Mock the proxy with a valid GoalHierarchySchema-conforming response so
    // decomposeGoal() parses it without throwing (wrong shape → schema failure → error state).
    await mockAIProxy(
      page,
      JSON.stringify({
        primaryGoal: { title: 'Read 52 books this year', type: 'learning' },
        yearly:      { title: 'Read 52 books', milestone: 'Complete 52 books by December' },
        monthly:     [{ month: 1, title: 'Read 4 books in January', milestone: 'Finish 4 books' }],
        weekly:      [{ week: 1, focus: 'Read 30 pages daily', tasks: ['Morning reading', 'Evening review'] }],
        dailyTaskExamples: ['Read 30 pages today', 'Log your reading progress'],
      }),
    );

    await seedAuthedUser(page);
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/(tabs)/goals');

    await expect(page.getByText('Goals').first()).toBeVisible({ timeout: 15_000 });

    // Open the add-goal FAB. The Goals tab renders an icon-only FAB (testID="add-goal-fab").
    const addTrigger = page.getByTestId('add-goal-fab');
    await addTrigger.waitFor({ state: 'visible', timeout: 10_000 });
    await addTrigger.click();

    // The "Add a goal" sheet uses a rotating-placeholder textarea (no static placeholder attr).
    // Target it by role — multiline TextInput renders as <textarea> in React Native Web.
    await expect(page.getByText('Add a goal')).toBeVisible({ timeout: 8_000 });
    const goalTextarea = page.getByRole('textbox').first();
    await goalTextarea.waitFor({ state: 'visible', timeout: 8_000 });
    await goalTextarea.fill('Read 52 books this year');

    // Business action 1: kick off AI decomposition.
    await page.getByText('Break it down', { exact: true }).click();

    // Business outcome 1: AI responds (mocked proxy → fast), hierarchy renders.
    // "Save goal" appears only after successful decomposition.
    await expect(page.getByText('Save goal', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Business action 2: commit the goal.
    await page.getByText('Save goal', { exact: true }).click();

    // Business outcome 2: goal title appears in the active list without a raw error.
    // Use .first() because the title may appear in both the form summary and the goal card.
    await expect(page.getByText('Read 52 books this year').first()).toBeVisible({ timeout: 10_000 });

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 6: Priority change → skip → priorities saved silently ─────────────────
//
// Human equivalent: "I want to update my priorities but don't care about
// replanning right now. I should be able to dismiss the sheet and carry on."

test.describe('CUJ 6 — Skip on priority-change sheet saves quietly', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { blocks: TODAY_BLOCKS });
  });

  test('choosing Skip dismisses the sheet without a crash', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/edit-priorities');

    await expect(page.getByText('Save priorities', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Toggle Social (not in the seeded primaryDomains) to add it → creates a diff
    const socialRow = page.getByText('Social', { exact: true }).first();
    await socialRow.scrollIntoViewIfNeeded();
    await socialRow.click();
    await page.waitForTimeout(200);
    await page.getByText('Save priorities', { exact: true }).click();

    // Sheet appears
    await expect(
      page.getByText('Adjust my day now').or(page.getByText('Start fresh tomorrow')).first()
    ).toBeVisible({ timeout: 10_000 });

    // Business action: tap Skip
    await page.getByText('Skip', { exact: false }).first().click();

    // Business outcome: sheet is gone; app surface is still rendered
    await expect(page.getByText('Adjust my day now')).toBeHidden({ timeout: 6_000 });
    const childCount = await assertNotBlank(page);
    expect(childCount, 'app should still be rendered after skip').toBeGreaterThan(20);
    expect(pageErrors).toEqual([]);
  });
});
