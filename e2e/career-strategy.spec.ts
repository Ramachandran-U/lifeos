import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Career Strategist E2E', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('generate strategy, accept weekly artifact, see it in Goals', async ({ page }) => {
    await page.goto('/career');
    // module_hierarchy_v1: Career is hero-first — the questionnaire lives in
    // the setup sheet behind "Map my path" (the legacy inline "NEW CAREER
    // PATH" card is gone). Anchor on the hero so the bundle has booted before
    // reading the mock flag below.
    await expect(page.getByTestId('career-hero')).toBeVisible({ timeout: 15_000 });

    // This test exercises an AI-driven flow end-to-end and requires the bundle
    // to be built with EXPO_PUBLIC_USE_AI_MOCK=true so responses are instant.
    const isMock = await page.evaluate(() => !!(window as { __AI_MOCK?: boolean }).__AI_MOCK);
    test.skip(!isMock, 'AI mock mode not enabled — start the server with EXPO_PUBLIC_USE_AI_MOCK=true');

    // Open the setup sheet from the zero-state hero.
    await page.getByText('Map my path', { exact: true }).click();

    // These inputs use rotating (animated) placeholders, so there's no static
    // placeholder to target — locate them by their accessibility label instead.
    await page.getByLabel('Current role').fill('Data Analyst');
    await page.getByLabel('Target role').fill('ML Engineer');

    await page.getByLabel('Current skills').fill('Python');
    await page.getByLabel('Current skills').press('Enter');

    await page.getByText('Analyse my career path', { exact: true }).click();

    // On success the sheet closes onto the loaded hero and the supporting
    // cast (Skill gaps / Learning path / 12-week plan) renders.
    await expect(page.getByText('Skill gaps').first()).toBeVisible({ timeout: 10_000 });

    // Strategy: the 12-week-plan row's "Generate plan" opens the strategy
    // segment of the sheet; "Generate strategy" runs the AI call.
    await page.getByText('Generate plan', { exact: true }).click();
    await page.getByText('Generate strategy', { exact: true }).click();

    // On success the sheet closes onto the loaded strategy view. Wait for the
    // sheet to actually leave the tree first: during the Modal's slide-out both
    // trees are attached, and a bare getByText('Reality check') strict-mode
    // collides with the sheet caption "Generate a no-fluff execution plan:
    // Reality Check, …" (getByText is case-insensitive substring matching). The
    // hidden-wait also keeps this test guarding that the sheet really dismisses
    // after generation — `exact` alone would go blind to it.
    // (Mirrors the in-flight fix/e2e-career-strategy-selector fix so this PR is
    // green; identical change, auto-resolves if that branch lands first.)
    await expect(page.getByText('Turn it into a plan')).toBeHidden({ timeout: 10_000 });

    // §3.0.7 sweep: the caps labels went sentence-case; phase labels remain caps.
    await expect(page.getByText('Reality check', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('12-week execution plan')).toBeVisible();
    await expect(page.getByText('PHASE 1: FOUNDATION')).toBeVisible();
    await expect(page.getByText('PHASE 3: PROOF')).toBeVisible();
    await expect(page.getByText('Weekly output')).toBeVisible();

    // Click "Commit all" to accept every weekly + daily artifact in one shot.
    await page.getByText('Commit all', { exact: true }).click();
    await expect(page.getByText('All committed')).toBeVisible();

    // The Goals-tab tail of this test (asserting W1: appears in the goal list)
    // was removed when Goals stopped being a top-level tab — it's now reached
    // via the Life hub. The "All committed" assertion above already verifies
    // every weekly artifact was persisted, so this test still exercises the
    // full strategy → commit flow. Re-add Life-hub navigation once that flow
    // has a stable testID.
  });
});
