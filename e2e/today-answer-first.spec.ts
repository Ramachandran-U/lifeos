/**
 * Answer-first Today (today_answer_first_v1 + install_prompt_v2) — Wave 3
 * PR-B, docs/design-deep-dive/01-today-hero.md.
 *
 * Covers the e2e halves of Acceptance C1-1, C1-2, C1-3, C1-4, C1-5, C1-7,
 * C1-11 and C1-12 against the web build, with BOTH flags forced ON for the
 * test persona (the shipped fallbacks are false; the cohort flip happens via
 * the Worker /v1/config — these tests stand in for that cohort).
 *
 * Belongs to the `chromium` project: self-seeding via seedAuthedUser, no
 * Supabase session. Flags are forced two ways, both required:
 *   1. the persisted zustand flag store (lifeos_flags_v4) — the immediate
 *      boot value, and
 *   2. a **\/v1\/config** route stub — boot calls fetchFlags({ force: true }),
 *      which bypasses the staleness window, so the persisted value alone
 *      would be overwritten by the real fetch (or by FALLBACK_FLAGS when no
 *      proxy URL is configured). The dev server must run with a non-empty
 *      EXPO_PUBLIC_AI_PROXY_URL (e2e.yml already does) for the stub to fire.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedAuthedUser, holdToComplete, type SeedBlock } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.use({ viewport: { width: 390, height: 844 } });

// 844px viewport minus the ~80px tab bar — the first-viewport budget the
// criteria pin (C1-1 / C1-11).
const USABLE = 764;

// Android Chrome — an installable A2HS browser, so the install_prompt_v2
// surfaces (InstallSheet, Profile row) are live. The legacy banner would also
// have rendered on this UA, which makes the C1-3 zero-match assertion real.
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// Mirror of FALLBACK_FLAGS in src/store/useFlagStore.ts with the two W3 flags
// forced on. Keep in sync when fallbacks change — the seed must carry every
// fallback so a missing key can't shadow a default-on feature.
const FLAGS_ON: Record<string, unknown> = {
  discovery_import_enabled: true,
  chatbot_beta: false,
  gmail_finance_enabled: true,
  evening_reflect_enabled: true,
  polymath_enabled: true,
  onboarding_v2: true,
  mutation_log_enabled: true,
  sync_engine_enabled: false,
  compaction_enabled: false,
  backup_enabled: false,
  agent_goal_decomp: false,
  agent_what_next: false,
  ai_coach_actions: true,
  explore_chasing: true,
  explore_agentic_thread: true,
  explore_frontier: true,
  rabbit_hole_tree_map: true,
  streak_protection_v1: false,
  quests_v2: false,
  variable_rewards_v1: false,
  companion_v1: false,
  comeback_v1: false,
  cold_start_v1: true,
  today_answer_first_v1: true,
  install_prompt_v2: true,
};

async function seedFlagsOn(page: Page) {
  // Persisted store shape: { state: { flags, fetchedAt }, version: 0 } under
  // the lifeos_flags_v4 key (see useFlagStore's persist config). fetchedAt is
  // stamped fresh so any non-forced read treats it as recent.
  await page.addInitScript((flags) => {
    localStorage.setItem(
      'lifeos_flags_v4',
      JSON.stringify({ state: { flags, fetchedAt: Date.now() }, version: 0 }),
    );
  }, FLAGS_ON);
  // Boot's forced refetch — serve the same flags from the stubbed Worker.
  await page.route('**/v1/config**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ flags: FLAGS_ON }),
    }),
  );
}

/** Override the seeded user's display name (runs after seedAuthedUser). */
async function seedName(page: Page, name: string) {
  await page.addInitScript((n) => {
    const raw = localStorage.getItem('lifeos_users');
    if (!raw) return;
    const users = JSON.parse(raw) as Array<{ name?: string }>;
    if (users[0]) users[0].name = n;
    localStorage.setItem('lifeos_users', JSON.stringify(users));
  }, name);
}

// Week-2 active persona: 2 of 5 done, next upcoming is a career block.
const WEEK2_BLOCKS: SeedBlock[] = [
  { id: 'w3b-done-1', startTime: '06:30', endTime: '07:00', title: 'Morning run', module: 'health', status: 'completed' },
  { id: 'w3b-done-2', startTime: '07:30', endTime: '08:00', title: 'Breakfast', module: 'meal', status: 'completed' },
  { id: 'w3b-up-1', startTime: '09:00', endTime: '10:00', title: 'Deep work sprint', module: 'career' },
  { id: 'w3b-up-2', startTime: '18:00', endTime: '18:30', title: 'Wind down', module: 'rest' },
  { id: 'w3b-up-3', startTime: '20:00', endTime: '20:30', title: 'Read one chapter', module: 'polymath' },
];

test.describe('C1-1 / C1-11 — hero action and radar in the first viewport', () => {
  test('week-2 persona: next-move primary fully inside 764px with zero scroll, height ≥ 56', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });
    await page.goto('/');

    const primary = page.getByTestId('next-move-primary');
    await expect(primary).toBeVisible({ timeout: 15_000 });
    // Let entry animations land before measuring.
    await page.waitForTimeout(1_200);

    const box = await primary.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(USABLE);
    expect(box!.height).toBeGreaterThanOrEqual(56);

    // C1-11 — the radar hero is fully inside the first viewport too.
    const hero = await page.getByTestId('today-hero-radar').boundingBox();
    expect(hero).not.toBeNull();
    expect(hero!.y).toBeGreaterThanOrEqual(0);
    expect(hero!.y + hero!.height).toBeLessThanOrEqual(USABLE);
  });

  test('day-1 persona: plan state, label "Plan my day", same viewport budget', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: [] });
    await page.goto('/');

    const primary = page.getByTestId('next-move-primary');
    await expect(primary).toBeVisible({ timeout: 15_000 });
    await expect(primary).toHaveText('Plan my day');
    await page.waitForTimeout(1_200);

    const box = await primary.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(USABLE);
    expect(box!.height).toBeGreaterThanOrEqual(56);

    const hero = await page.getByTestId('today-hero-radar').boundingBox();
    expect(hero).not.toBeNull();
    expect(hero!.y).toBeGreaterThanOrEqual(0);
    expect(hero!.y + hero!.height).toBeLessThanOrEqual(USABLE);
  });
});

test.describe('C1-2 — the greeting never wraps', () => {
  for (const name of ['Al', 'Maya Chen']) {
    test(`greeting bounding-box height ≤ 33px for "${name}"`, async ({ page }) => {
      await seedFlagsOn(page);
      await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });
      await seedName(page, name);
      await page.goto('/');

      const greeting = page.getByTestId('today-greeting');
      await expect(greeting).toBeVisible({ timeout: 15_000 });
      const box = await greeting.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThanOrEqual(33);
    });
  }
});

test.describe('C1-3 — no install chrome anywhere with install_prompt_v2 on', () => {
  test.use({ userAgent: ANDROID_UA });

  test('the five tab routes render zero INSTALL LIFEOS matches', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });

    for (const route of ['/', '/goals', '/health', '/finance', '/profile']) {
      await page.goto(route);
      // Anchor on the app having rendered before asserting absence.
      const anchored = await page.waitForFunction(
        () => (document.getElementById('root')?.querySelectorAll('*').length ?? 0) > 10,
        undefined,
        { timeout: 15_000 },
      );
      expect(anchored).toBeTruthy();
      // exact: case-sensitive — the criterion targets the legacy banner's caps
      // literal; the spec-required Profile row ("Install LifeOS") must NOT trip it.
      await expect(page.getByText('INSTALL LIFEOS', { exact: true })).toHaveCount(0);
    }
  });
});

test.describe('C1-4 — install trigger discipline (event-triggered sheet)', () => {
  test.use({ userAgent: ANDROID_UA });

  test('sheet absent on Today load; present after one completion + 2s', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });
    await page.goto('/');

    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('install-sheet')).toHaveCount(0);

    await holdToComplete(page, 'w3b-up-1');
    await expect(page.getByTestId('routine-block-w3b-up-1-completed')).toBeVisible({ timeout: 8_000 });

    // Trigger fires at +1780ms (reward beat budget) — 2s covers it.
    await page.waitForTimeout(2_000);
    await expect(page.getByTestId('install-sheet')).toBeVisible();
  });
});

test.describe('C1-5 — Goals tab carries no second answer (flag-on persona)', () => {
  test('text query for YOUR NEXT MOVE on Goals returns 0 matches', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, {
      blocks: WEEK2_BLOCKS,
      goals: [{ id: 'w3g-daily-1', title: 'Email the venue', goalType: 'goal', level: 'daily' }],
    });
    await page.goto('/goals');

    // Anchor on the screen having mounted via its R1 header. (Flag-on, a
    // parentless daily goal renders nowhere on Goals — its only surface was
    // the card this flag removes; the task now lives on Today's hero.)
    await expect(page.getByTestId('module-header').getByText('Goals', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('YOUR NEXT MOVE')).toHaveCount(0);
  });
});

test.describe('C1-7 — radar hub states (e2e half)', () => {
  test('day-1: hub reads DAY 1 / PICK YOUR FIRST WIN', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: [] });
    await page.goto('/');

    await expect(page.getByTestId('radar-hub')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('DAY 1', { exact: true })).toBeVisible();
    await expect(page.getByText('PICK YOUR FIRST WIN', { exact: true })).toBeVisible();
  });

  test('mid-day: hub reads 2/5 / BLOCKS DONE', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });
    await page.goto('/');

    await expect(page.getByTestId('radar-hub')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2/5', { exact: true })).toBeVisible();
    await expect(page.getByText('BLOCKS DONE', { exact: true })).toBeVisible();
  });
});

test.describe('C1-12 — header hygiene', () => {
  test('voice button sits inside the header; feedback row sits below Today\'s flow', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, { blocks: WEEK2_BLOCKS });
    await page.goto('/');

    const header = page.getByTestId('today-header');
    await expect(header).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_200);

    const headerBox = await header.boundingBox();
    const voiceBox = await page.getByTestId('voice-open').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(voiceBox).not.toBeNull();
    expect(voiceBox!.x).toBeGreaterThanOrEqual(headerBox!.x);
    expect(voiceBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
    expect(voiceBox!.x + voiceBox!.width).toBeLessThanOrEqual(headerBox!.x + headerBox!.width + 1);
    expect(voiceBox!.y + voiceBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height + 1);

    const flowBox = await page.getByText("Today's flow").boundingBox();
    const feedbackBox = await page.getByTestId('feedback-open').boundingBox();
    expect(flowBox).not.toBeNull();
    expect(feedbackBox).not.toBeNull();
    expect(feedbackBox!.y).toBeGreaterThan(flowBox!.y);
  });
});
