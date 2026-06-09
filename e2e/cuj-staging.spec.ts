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

// ── CUJ 7: Completing a task is reflected on the Rewards tab ───────────────────
//
// Human equivalent: "I finished my morning run — when I open Rewards, my XP went
// up and the progress graph moved. It shouldn't say 0 with a flat line."
//
// Regression guard for the shipped bug where Rewards showed 0 / a flat XP graph
// after completing a task. Navigation MUST be a client-side tab tap, not a
// reload — a reload re-runs the seed and would reset XP to 0 (and mask the bug).

test.describe('CUJ 7 — Rewards reflects a completed task (XP + non-flat graph)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page, { blocks: [TODAY_BLOCKS[0]], gamification: { totalXP: 0 } });
  });

  test('after completing a block, Rewards shows the earned XP and a non-flat XP graph', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Morning run').first()).toBeVisible({ timeout: 10_000 });

    await holdToComplete(page, 'cuj-health-1');
    await expect(page.getByTestId('routine-block-cuj-health-1-completed')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400); // let the store write + XP snapshot settle

    // Client-side tab navigation — a page.goto reload would re-run the seed and
    // reset gamification to 0, hiding exactly the bug we're guarding.
    await page.getByRole('tab', { name: /rewards/i }).or(page.getByText('Rewards', { exact: true })).first().click();

    // Business outcome 1: the earned XP is on the Rewards hero (was "shows 0").
    await expect(page.getByText(/\b10 \/ \d+ XP to Level/i)).toBeVisible({ timeout: 10_000 });

    // Business outcome 2: the 7-DAY XP graph is NOT a flat horizontal line.
    const points = await page.getByTestId('rewards-xp-sparkline').locator('polyline').getAttribute('points');
    const ys = (points ?? '').trim().split(/\s+/).map((p) => parseFloat(p.split(',')[1])).filter((n) => !Number.isNaN(n));
    expect(ys.length, 'XP sparkline should render at least two points').toBeGreaterThan(1);
    expect(Math.max(...ys) - Math.min(...ys), 'XP sparkline must not be a flat line after earning XP').toBeGreaterThan(1);

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 8: Rabbit hole — going deeper yields new content each level ────────────
//
// Human equivalent: "I keep pulling the thread deeper and each step is a NEW
// idea — not the same card over and over."
//
// Regression guard for the shipped bug where the curated fallback node was
// derived only from the anchor, so every depth rendered an identical card. With
// no Supabase session the live thread call throws and the generator falls back
// to that curated node — exactly the path that was broken.

test.describe('CUJ 8 — Rabbit hole: consecutive "go deeper" nodes differ', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page); // session only; no Supabase token → generator uses the curated fallback
  });

  test('two consecutive deeper nodes have different titles (not the same card)', async ({ page }) => {
    const { pageErrors } = captureErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => !url.pathname.includes('/(auth)/sign'), { timeout: 10_000 }).catch(() => {});
    await page.goto(
      '/rabbit-hole?seedTitle=The%20hidden%20grammar%20of%20chess&seedInterest=chess&seedAdjacent=linguistics',
      { waitUntil: 'domcontentloaded' },
    );

    const titleEl = page.getByTestId('rabbit-hole-node-title');
    await expect(titleEl).toBeVisible({ timeout: 15_000 });
    const goDeeper = () => page.getByText('GO DEEPER', { exact: false }).first();

    // Depth 1 (root seed) → 2
    const t1 = (await titleEl.innerText()).trim();
    await goDeeper().click();
    await expect.poll(async () => (await titleEl.innerText()).trim(), { timeout: 12_000 }).not.toBe(t1);
    const t2 = (await titleEl.innerText()).trim();

    // Depth 2 → 3
    await goDeeper().click();
    await expect.poll(async () => (await titleEl.innerText()).trim(), { timeout: 12_000 }).not.toBe(t2);
    const t3 = (await titleEl.innerText()).trim();

    // The regression: depth-2 and depth-3 were byte-identical (anchor-only mock).
    expect(t3, 'consecutive deeper nodes must differ — identical text is the depth bug').not.toBe(t2);
    expect(t2.length, 'a generated node should have a real title').toBeGreaterThan(3);
    expect(pageErrors).toEqual([]);
  });
});

// ── Shared AI-proxy router for the AI-dependent CUJs below ─────────────────────
//
// The Worker returns { text, functionCalls?, model, usage } for /claude. `pick`
// decides the response per call from the request body (`task`) and the call
// index (the coach agent loops: function-call turn, then final-answer turn).
async function routeAI(
  page: Parameters<typeof seedAuthedUser>[0],
  pick: (body: { task?: string }, callIndex: number) => Record<string, unknown>,
) {
  let n = 0;
  await page.route('**/claude', async (route) => {
    let body: { task?: string } = {};
    try { body = route.request().postDataJSON() as { task?: string }; } catch { /* keep {} */ }
    const payload = pick(body ?? {}, n++);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ model: 'mock', usage: { input_tokens: 0, output_tokens: 0 }, ...payload }),
    });
  });
}

// ── CUJ 9: AI coach — propose → confirm → real mutation ───────────────────────
//
// Human equivalent: "I ask 'what should I do next?', the coach proposes adding a
// focus block, I confirm, and the block actually appears in my day."

test.describe('CUJ 9 — Coach proposes an action and confirming commits it', () => {
  test('confirming a proposed routine block creates it', async ({ page }) => {
    await seedSupabaseSession(page); // AI auth guard
    await seedAuthedUser(page, { blocks: TODAY_BLOCKS });
    // Under EXPO_PUBLIC_USE_AI_MOCK (how CI builds the bundle) the coach returns a
    // canned proposal titled "Focus session"; against a live target this route
    // drives the same shape. Either way the journey is propose → confirm → commit.
    await routeAI(page, (body, i) => {
      if (body.task === 'what_next' && i === 0) {
        return {
          text: '',
          functionCalls: [{
            name: 'proposeCreateRoutineBlock',
            args: { startTime: '14:00', endTime: '14:30', title: 'Focus session', module: 'goal' },
          }],
        };
      }
      return { text: 'Add a 30-minute focus block at 2pm — your highest-leverage move now.', functionCalls: [] };
    });

    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });

    await page.getByText('What should I do next?').first().click();

    // Business outcome 1: a proposal with a Confirm control appears.
    await expect(page.getByText('Confirm', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Confirm', { exact: true }).first().click();

    // Business outcome 2: the proposed block is actually committed to the day.
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const blocks = JSON.parse(localStorage.getItem('lifeos_routine_blocks') ?? '[]') as Array<{ title: string }>;
          return blocks.some((b) => b.title === 'Focus session');
        } catch { return false; }
      }), { timeout: 10_000 })
      .toBe(true);

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 10: Evening reflection → apply a tomorrow tweak → finish ───────────────
//
// Human equivalent: "I review my day, set my mood, the app suggests one tweak for
// tomorrow, I apply it, and I land back on Today — reflection done."

test.describe('CUJ 10 — Evening reflection completes and applies a tomorrow tweak', () => {
  test('review → mood → apply tweak → finish returns to Today', async ({ page }) => {
    await seedSupabaseSession(page);
    await seedAuthedUser(page, { blocks: TODAY_BLOCKS });
    await routeAI(page, (body) => {
      if (body.task === 'suggestTomorrowTweak') {
        return { text: JSON.stringify({
          kind: 'add', blockId: null,
          patch: { startTime: '08:00', endTime: '08:30', title: 'Morning stretch', module: 'health' },
          rationale: 'Start tomorrow with a gentle stretch to ease in.',
        }) };
      }
      if (body.task === 'generateTomorrowRoutine') {
        return { text: JSON.stringify({
          blocks: [{ startTime: '08:00', endTime: '08:30', title: 'Morning stretch', module: 'health' }],
          briefing: 'A calm, recovery-leaning day.',
        }) };
      }
      return { text: '{}' };
    });

    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await page.goto('/evening-reflect', { waitUntil: 'domcontentloaded' });

    // Step 1 — review at least one block, then continue.
    await expect(page.getByText('Morning run').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Did it', { exact: true }).first().click();
    await page.getByText('Continue', { exact: true }).click();

    // Step 2 — pick a mood, then continue.
    await page.getByText('Good', { exact: true }).click();
    await page.getByText('Continue', { exact: true }).click();

    // Step 3 — the AI tweak appears; apply it.
    await expect(page.getByText('Apply', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText('Apply', { exact: true }).click();

    // Finish (button text becomes "Finish" once the tweak is applied/dismissed).
    await page.getByText(/^Finish/, ).first().click();

    // Business outcome: back on the Today surface, reflection recorded.
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 11: Discovery fast-start — paste → extract → confirm → onboarded ───────
//
// Human equivalent: "I paste my notes, the app extracts a profile, I confirm, and
// I'm set up — goals and all — landing on Today."

const MOCK_EXTRACTION = {
  identity: { firstName: 'Sam', ageBand: '30-35', location: 'Bengaluru', seasonOfLife: 'Rebuilding.', confidence: 'medium' },
  goals: [
    { title: 'Ship a side project to 100 paying users', domain: 'career', horizon: '1y', why: 'Income beyond the day job.', quote: null, confidence: 'high' },
    { title: 'Lose 8 kg and hold it', domain: 'health', horizon: '1y', why: 'Energy dropped.', quote: null, confidence: 'high' },
  ],
  health: { conditions: [], constraints: ['bad left knee'], currentHabits: ['evening walks'], energyPattern: 'Sharp 8–11am.', confidence: 'medium' },
  finance: { currency: 'INR', monthlyIncomeBand: null, topGoals: ['emergency fund'], anxieties: ['job security'], confidence: 'medium' },
  career: { role: 'Senior PM', seniority: 'senior', aspirations: ['found a company'], skillsLearning: ['writing'], confidence: 'high' },
  relationships: { keyPeople: [{ firstName: 'Priya', role: 'partner', cadence: 'daily' }], socialEnergy: 'ambivert', confidence: 'medium' },
  curiosity: { activeInterests: ['essay writing', 'chess'], dormantInterests: ['piano'], confidence: 'medium' },
  values: ['honesty', 'craft'],
  workingStyle: { peakHours: 'early morning', focusBlocks: '90-minute blocks', restNeeds: 'one offline day', confidence: 'medium' },
  communication: { tone: 'direct', avoid: ['hype'], confidence: 'medium' },
  struggles: [{ area: 'consistency', description: 'Falls off after two weeks.', quote: null }],
  triedAlready: ['habit apps'],
  asks: ['help me finish what I start'],
};

test.describe('CUJ 11 — Discovery fast-start extracts a profile and onboards', () => {
  test('paste → extract → confirm lands on Today with the profile applied', async ({ page }) => {
    await seedSupabaseSession(page);
    await seedAuthedUser(page);
    await routeAI(page, (body) =>
      body.task === 'extractDiscoveryProfile'
        ? { text: JSON.stringify(MOCK_EXTRACTION) }
        : { text: '{}' },
    );

    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await page.goto('/(onboarding)/discovery-paste', { waitUntil: 'domcontentloaded' });

    // Paste ≥400 chars (the screen's MIN_CHARS gate) and extract.
    const blurb = 'I am a senior product manager in Bengaluru rebuilding after a hard year. '
      + 'I want to ship a side project to 100 paying users, lose 8 kg and keep it off, and build a six-month '
      + 'emergency fund because layoffs make me anxious. I have a bad knee so no high-impact running. I am '
      + 'sharpest in the early morning and crash after lunch. I keep starting things and not finishing them, '
      + 'and I want calm structure without hype or toxic positivity. My partner Priya and friend Arjun matter most.';
    const paste = page.getByPlaceholder('Paste here…');
    await expect(paste).toBeVisible({ timeout: 15_000 });
    await paste.fill(blurb);
    await page.getByText('Extract my profile', { exact: true }).click();

    // Business outcome 1: the confirm screen shows an extracted goal.
    await expect(page.getByText('Ship a side project to 100 paying users')).toBeVisible({ timeout: 15_000 });

    // Business action: accept the extracted profile.
    await page.getByText('Use this to set up LifeOS', { exact: true }).click();

    // Business outcome 2: onboarded — left the discovery flow onto the app, not blank.
    await page.waitForURL((url) => !url.pathname.includes('discovery'), { timeout: 15_000 });
    const childCount = await assertNotBlank(page);
    expect(childCount, 'app should render after discovery confirm').toBeGreaterThan(20);
    // The extracted goal is now in the user's goals store.
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const goals = JSON.parse(localStorage.getItem('lifeos_goals') ?? '[]') as Array<{ title: string }>;
          return goals.some((g) => /side project to 100/i.test(g.title ?? ''));
        } catch { return false; }
      }), { timeout: 10_000 })
      .toBe(true);
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 12: Meal suggestions render, and logging one records a food entry ──────
//
// Human equivalent: "On Health I tap 'Suggest meals', get real ideas, and tapping
// one logs it." Also guards the meal-ideas card surfacing its result at all.
// Under the AI-mock build (CI) the ideas are the canned MOCK_MEAL_SUGGESTION.

test.describe('CUJ 12 — Meal suggestions render and a meal can be logged', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('suggest meals shows ideas and logging one persists a food entry', async ({ page }) => {
    // Mode-agnostic: a mock build returns the canned suggestion; otherwise this
    // route supplies the same meal so the assertion holds either way.
    await seedSupabaseSession(page);
    await routeAI(page, (body) =>
      body.task === 'suggestMeals'
        ? { text: JSON.stringify({ meals: [
            { name: 'Grilled Chicken Salad with Quinoa', calories: 480, protein: 38, carbs: 42, fat: 16, description: 'Greens, grilled chicken, quinoa, and an olive-oil dressing.' },
          ] }) }
        : { text: '{}' },
    );
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/(tabs)/health');
    await expect(page.getByText('Health').first()).toBeVisible({ timeout: 15_000 });

    // The meal-ideas card lives inside the collapsible calorie section.
    await page.getByText('CALORIE TRACKING').first().click();
    await page.getByRole('button', { name: 'Suggest meals' }).or(page.getByText('Suggest meals')).first().click();

    // Business outcome 1: a concrete meal idea renders (canned mock under CI build).
    await expect(page.getByText('Grilled Chicken Salad with Quinoa')).toBeVisible({ timeout: 15_000 });

    // Business action: log it to the default (lunch) slot.
    await page.getByLabel('Log Grilled Chicken Salad with Quinoa to lunch').click();

    // Business outcome 2: a food entry is persisted.
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const entries = JSON.parse(localStorage.getItem('lifeos_food_entries') ?? '[]') as Array<{ foodName?: string }>;
          return entries.some((e) => e.foodName === 'Grilled Chicken Salad with Quinoa');
        } catch { return false; }
      }), { timeout: 10_000 })
      .toBe(true);

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 13: Annual review generates and renders the year in review ─────────────
//
// Human equivalent: "I open 'Your journey so far' and see a real year-in-review —
// a headline about me plus the win / growth / theme sections."

test.describe('CUJ 13 — Annual review renders all sections', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('annual review auto-generates with a headline and all sections', async ({ page }) => {
    // Mode-agnostic: a mock build returns the canned review; otherwise this route
    // supplies a valid review so the sections + headline render either way.
    await seedSupabaseSession(page);
    await routeAI(page, (body) =>
      body.task === 'generateAnnualReview'
        ? { text: JSON.stringify({
            headline: 'E2E User grew this year — steady progress across the board.',
            domains: [{ domain: 'Health', summary: '45h invested across the year.' }],
            biggestWin: 'You kept a 3-day streak alive.',
            growthArea: 'Spread your time more evenly next year.',
            themeForNextYear: 'Build on the momentum.',
          }) }
        : { text: '{}' },
    );
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await page.goto('/annual-review', { waitUntil: 'domcontentloaded' });

    // Auto-generates on mount; the stable section labels prove it rendered.
    await expect(page.getByText('BIGGEST WIN')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('GROWTH AREA')).toBeVisible();
    await expect(page.getByText('THEME FOR NEXT YEAR')).toBeVisible();
    // The headline is about the seeded user.
    await expect(page.getByText(/E2E User/).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 14: Blood report parses into rendered markers ─────────────────────────
//
// Human equivalent: "I upload my blood report and see my markers, flagged where
// they're out of range." Sensitive health flow — must surface a real result.

test.describe('CUJ 14 — Blood report parses and renders flagged markers', () => {
  test('uploading a report renders parsed markers with a flag', async ({ page }) => {
    await seedSupabaseSession(page);
    await seedAuthedUser(page);
    await routeAI(page, (body) =>
      body.task === 'parseBloodReport'
        ? { text: JSON.stringify({
            markers: [
              { marker: 'Vitamin D', value: 18, unit: 'ng/mL', referenceRange: '30-100', status: 'low' },
              { marker: 'Haemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.5-17.5', status: 'normal' },
            ],
            summary: 'Most markers are normal; Vitamin D is low.',
            suggestions: ['Start a Vitamin D supplement and get morning sunlight.'],
          }) }
        : { text: '{}' },
    );
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/(tabs)/health');
    await expect(page.getByText('Health').first()).toBeVisible({ timeout: 15_000 });

    // Open the blood-reports section and trigger a parse.
    await page.getByText('BLOOD REPORTS').first().click();
    await page.getByRole('button', { name: 'Upload Report' }).or(page.getByText('Upload Report')).first().click();

    // Business outcome: a parsed marker renders, flagged out-of-range. Exact match —
    // "Vitamin D" also appears in the summary + suggestions text.
    await expect(page.getByText('Vitamin D', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('low').first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 15: Progressive onboarding (Day 3 — Health) ───────────────────────────
//
// Human equivalent: "On day 3 I fill in my basics, hit save, and it drops me into
// the Health module ready to go." Pure form — no AI.

test.describe('CUJ 15 — Onboarding day 3 saves vitals and opens Health', () => {
  test('filling weight + goal and saving lands on Health with a weight log', async ({ page }) => {
    await seedAuthedUser(page); // stage 100 → progressive-onboarding routes are allowed
    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await page.goto('/(onboarding)/day3-health', { waitUntil: 'domcontentloaded' });

    const weight = page.getByPlaceholder('72.5');
    await expect(weight).toBeVisible({ timeout: 15_000 });
    await weight.fill('72.5');
    await page.getByText('Build strength').first().click();
    await page.getByRole('button', { name: 'Save & open Health' }).or(page.getByText('Save & open Health')).first().click();

    // Business outcome: lands on Health and the weight is logged.
    await page.waitForURL(/health/, { timeout: 15_000 });
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const logs = JSON.parse(localStorage.getItem('lifeos_health_logs') ?? '[]') as Array<{ weight?: number }>;
          return logs.some((l) => l.weight === 72.5);
        } catch { return false; }
      }), { timeout: 10_000 })
      .toBe(true);
    expect(pageErrors).toEqual([]);
  });
});

// ── Dexie seed helper — finance transactions live in IndexedDB, not localStorage.
// Seed AFTER the app has opened the Dexie DB (so the object store exists), by
// opening it WITHOUT a version (no upgrade) and putting records. The caller then
// reloads so the transaction store re-reads.
async function seedFinanceTx(
  page: Parameters<typeof seedAuthedUser>[0],
  records: Array<Record<string, unknown>>,
) {
  await page.evaluate(async (recs) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const dbExists = async () =>
      (await indexedDB.databases()).some((d) => d.name === 'lifeos_finance');
    // Wait for the app's Dexie to create lifeos_finance + its stores.
    for (let i = 0; i < 40 && !(await dbExists()); i++) await sleep(250);
    const db: IDBDatabase | null = await new Promise((resolve) => {
      const req = indexedDB.open('lifeos_finance'); // no version → current, no upgrade
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (!db || !db.objectStoreNames.contains('transactions')) {
      db?.close();
      throw new Error('lifeos_finance.transactions not ready');
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readwrite');
      for (const r of recs) tx.objectStore('transactions').put(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, records);
}

// ── CUJ 16: Monthly money review (finance) ────────────────────────────────────
//
// Human equivalent: "With transactions logged, I open the Monthly Money Review
// and get a real breakdown of where my money went."

test.describe('CUJ 16 — Monthly money review renders from seeded transactions', () => {
  // FIXME: the Dexie seed below puts a transaction into lifeos_finance.transactions
  // without error, but after reload the finance transaction store still reads
  // empty (Finance shows its no-transactions state), so the review entry point
  // never appears. Needs investigation into the store's load path (timing/filter)
  // or the Dexie version mapping. Helper + flow are kept as scaffolding.
  test.fixme('with a transaction present, the review generates and shows its sections', async ({ page }) => {
    await seedSupabaseSession(page);
    await seedAuthedUser(page);
    await routeAI(page, (body) =>
      body.task === 'generateMoneyReview'
        ? { text: JSON.stringify({
            headline: 'This month: spent ₹500 across 1 transaction.',
            wins: ['You logged your spending — the picture is clear.'],
            leaks: ['₹500 at Swiggy across 1 payment.'],
            oneAdjustment: 'Set a soft budget for food next month.',
          }) }
        : { text: '{}' },
    );

    const { pageErrors } = captureErrors(page);
    // Open Finance so the app creates the Dexie DB + stores, then seed a tx.
    await navigateTo(page, '/(tabs)/finance');
    await expect(page.getByText('Finance').first()).toBeVisible({ timeout: 15_000 });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await seedFinanceTx(page, [{
      id: 'cuj-tx-1', date: today, amount: 50000, direction: 'debit',
      merchant: 'Swiggy', category: 'food', source: 'manual',
      rawEmailId: 'cuj-1', confidence: 0.95, userCorrected: false,
    }]);
    // Reload so the transaction store picks up the seeded row.
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Business outcome 1: the review entry point appears (only shows when txns exist).
    await page.getByText('Monthly Money Review').click({ timeout: 15_000 });

    // Business outcome 2: the review renders its sections.
    await expect(page.getByText('Where your money went')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('WINS')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});

// ── CUJ 17: Intra-day replan — skip a block → "Re-plan" mutates the rest of today ─
//
// Human equivalent: "I skipped my morning deep-work block. I tap 'Re-plan' and
// LifeOS actually rebalances the rest of my day — it doesn't just say it did."
//
// This is the cognitive layer's signature move (replan rest of today). The Today
// CTA applies directly (no diff sheet): handleReplan → rebalanceRestOfToday →
// replanRemainingDay → applyReplan mutates the routine + surfaces a rationale.
//
// Mode-agnostic: in a mock build replanRemainingDay returns buildMockReplanRemainingDay
// (no /claude call); against a live target routeAI returns the SAME plan by reading
// the request's real block ids back. Seeding exactly ONE skipped block keeps
// `soften` false (isRecoveryLow needs ≥3), so both paths take the deterministic
// "retry the skipped block in the next slot" branch — one remaining block is
// retitled "<skipped title> (retry)". Upcoming blocks span the day so a "remaining"
// block exists for all but the last ~30s before midnight (clock is UTC-pinned).

const REPLAN_BLOCKS: SeedBlock[] = [
  { id: 'rp-skip',  title: 'Morning Deep Work', module: 'career', startTime: '07:00', endTime: '08:00', status: 'skipped' },
  { id: 'rp-up-1',  title: 'Afternoon Focus',   module: 'goal',   startTime: '13:00', endTime: '14:00' },
  { id: 'rp-up-2',  title: 'Evening Review',     module: 'goal',   startTime: '23:30', endTime: '23:59' },
];

test.describe('CUJ 17 — Re-plan rest of today mutates the routine and shows a rationale', () => {
  test('skipping a block then tapping Re-plan rebalances the remaining day', async ({ page }) => {
    await seedSupabaseSession(page);            // AI auth guard (live target)
    await seedAuthedUser(page, { blocks: REPLAN_BLOCKS });
    // handleReplan bails with "No profile yet" unless a user_profiles row exists.
    await page.addInitScript(() => {
      const profile = {
        version: 1,
        identity: { firstName: 'E2E', ageBand: null, seasonOfLife: null },
        vision: { statement: null, horizon: null, topGoals: [] },
        schedule: { wakeTime: '07:00', sleepTime: '23:00', workStartTime: '09:00', workEndTime: '17:00', fixedBlocks: [] },
        chronotype: 'morning',
        primaryDomains: ['health', 'career', 'goals'],
        habits: { current: [], aspirational: [] },
        constraints: [], struggles: [], values: [],
        communication: { tone: null, avoid: [] },
        confidence: { identity: 1, vision: 1, schedule: 1, chronotype: 1, habits: 1, constraints: 1, primaryDomains: 1, overall: 1 },
        inferredPreferences: { preferredBlockMinutes: null, productiveHours: [], droppedHabits: [], preferredRestDays: [] },
        source: 'form',
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem('lifeos_user_profiles', JSON.stringify([{ userId: 'e2e-user-1', profile }]));
    });

    // Mirror buildMockReplanRemainingDay exactly from the request body so the
    // outcome matches whether the build is mock (no /claude) or live (this route).
    await routeAI(page, (body) => {
      if (body.task !== 'replanRemainingDay') return {};
      type RB = { id: string; startTime: string; endTime: string; title: string; module: string };
      const b = body as { task?: string; messages?: Array<{ content?: string }> };
      let input: { remainingBlocks?: RB[]; skippedToday?: Array<{ id: string; title: string; module: string }>; softenForRecovery?: boolean } = {};
      try { input = JSON.parse(b.messages?.[0]?.content ?? '{}'); } catch { /* keep {} */ }
      const remaining = input.remainingBlocks ?? [];
      const skipped = input.skippedToday?.[0];
      let plan;
      if (input.softenForRecovery) {
        const heavy = remaining.filter((x) => x.title.toLowerCase().includes('workout') || x.module === 'career');
        plan = {
          drop: heavy.map((x) => x.id),
          edits: [],
          add: heavy.length ? [{ startTime: heavy[0].startTime, endTime: heavy[0].endTime, title: 'Easy walk + reset', module: 'rest', energyRequired: 'low' }] : [],
          rationale: 'Lower-energy day — swapped the hard blocks for a recovery walk.',
        };
      } else if (skipped && remaining[0]) {
        plan = {
          drop: [],
          edits: [{ id: remaining[0].id, title: `${skipped.title} (retry)` }],
          add: [],
          rationale: `Re-tried the ${skipped.title.toLowerCase()} you missed in the next slot.`,
        };
      } else {
        plan = { drop: [], edits: [], add: [], rationale: 'Day is on track — no changes.' };
      }
      return { text: JSON.stringify(plan) };
    });

    const { pageErrors } = captureErrors(page);
    await navigateTo(page, '/');
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });

    // The skip-driven CTA: "1 skipped — let me rebalance what's left." + "Re-plan".
    const replanBtn = page.getByText('Re-plan', { exact: true });
    await expect(replanBtn).toBeVisible({ timeout: 10_000 });
    await replanBtn.click();

    // Business outcome 1: a rationale replaces the CTA (proves the plan ran).
    await expect(page.getByText(/Re-tried the morning deep work/i)).toBeVisible({ timeout: 15_000 });

    // Business outcome 2: the routine is ACTUALLY mutated — one block now carries
    // the "(retry)" title written by applyReplan, not just a UI message.
    await expect
      .poll(async () => page.evaluate(() => {
        try {
          const blocks = JSON.parse(localStorage.getItem('lifeos_routine_blocks') ?? '[]') as Array<{ title?: string }>;
          return blocks.some((b) => b.title === 'Morning Deep Work (retry)');
        } catch { return false; }
      }), { timeout: 10_000 })
      .toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
