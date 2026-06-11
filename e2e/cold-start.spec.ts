/**
 * Cold-start experience (cold_start_v1) — Wave 3 PR-A.
 *
 * Covers the binding acceptance criteria AC-1, AC-2, AC-5, AC-6, AC-7 and
 * AC-12 of docs/design-deep-dive/02-cold-start.md against the web build.
 *
 * Belongs to the `chromium` project: it seeds its own localStorage via
 * seedAuthedUser (the routine-completion-modules.spec.ts pattern) and needs
 * no Supabase session. The chromium project's Desktop Chrome default is not
 * 390×844, so the file pins the viewport itself.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedAuthedUser, holdToComplete, type SeedBlock } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.use({ viewport: { width: 390, height: 844 } });

/**
 * Pre-change radar position baseline (AC-7). Measured 2026-06-12 on the
 * pre-change build (trunk 4e9b367 web export), viewport 390×844, default e2e
 * seed (one upcoming rest block), networkidle + 3000ms settle: the radar
 * <svg> itself measured y=8; the Animated.View hero wrapper that receives
 * testID="today-hero-radar" measured y=0. The caption mounts AFTER <HexRadar/>
 * inside that wrapper, so the wrapper's y must not move by more than 1px.
 */
const RADAR_Y_BASELINE = 0;

const FLOOR_SCORES = { goals: 15, health: 15, finance: 15, career: 15, social: 15, polymath: 15 };

const ZERO_STREAKS = {
  workout: { count: 0, lastDate: null, graceUsed: false },
  learning: { count: 0, lastDate: null, graceUsed: false },
  foodTracking: { count: 0, lastDate: null, graceUsed: false },
  journaling: { count: 0, lastDate: null, graceUsed: false },
  social: { count: 0, lastDate: null, graceUsed: false },
};

// Two blocks so completing the FIRST one never trips the separate
// all-blocks-done dayComplete confetti — AC-5 isolates the firstWin beat.
const TWO_BLOCKS: SeedBlock[] = [
  { id: 'cs-block-1', startTime: '09:00', endTime: '09:30', title: 'First cold-start block', module: 'goal' },
  { id: 'cs-block-2', startTime: '18:00', endTime: '18:30', title: 'Second cold-start block', module: 'rest' },
];

/** Fresh account: totalXP 0, all-floor domain scores, no streak has ever run. */
async function seedFresh(page: Page, extra: Parameters<typeof seedAuthedUser>[1] = {}) {
  await seedAuthedUser(page, {
    gamification: { totalXP: 0, domainScores: FLOOR_SCORES, streaks: ZERO_STREAKS },
    ...extra,
  });
}

test.describe('Cold start — Rewards day-1 minimal mode', () => {
  test('AC-1: no zero ledger; first-win card present; CTA above the fold without scrolling', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/rewards');

    await expect(page.getByTestId('first-win-card')).toBeVisible({ timeout: 15_000 });

    for (const banned of ['+0', '0🔥', 'Best: 0', '0 / 300 XP', 'No streak shields banked']) {
      await expect(page.getByText(banned, { exact: false })).toHaveCount(0);
    }

    // The CTA's boundingBox fits inside the 844px viewport with NO scroll action.
    const cta = page.getByTestId('first-win-cta');
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test('AC-2: exactly the three top-level sections; ledger markers absent', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/rewards');

    await expect(page.getByTestId('rewards-hero')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('first-win-card')).toHaveCount(1);
    await expect(page.getByTestId('rewards-quests-section')).toHaveCount(1);
    await expect(page.getByTestId('rewards-hero')).toHaveCount(1);

    await expect(page.getByTestId('rewards-xp-sparkline')).toHaveCount(0);
    // Regexes: case-SENSITIVE so the caps SectionLabel text is hunted without
    // tripping on lowercase prose ("…badges and streaks…" in the card body).
    for (const absent of [/LIFE BALANCE/, /BADGES/, /STREAKS/, /WEEKLY QUEST/]) {
      await expect(page.getByText(absent)).toHaveCount(0);
    }
  });
});

test.describe('Cold start — first-win beat under reduce-motion (AC-5)', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('zero new canvases in the 2500ms after the first completion; block flips visibly', async ({ page }) => {
    await seedFresh(page, { blocks: TWO_BLOCKS, profile: true });
    await page.goto('/');
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });

    const canvasesBefore = await page.locator('canvas').count();
    await holdToComplete(page, 'cs-block-1');
    await expect(page.getByTestId('routine-block-cs-block-1-completed')).toBeVisible({ timeout: 8_000 });

    await page.waitForTimeout(2_500);
    const canvasesAfter = await page.locator('canvas').count();
    expect(canvasesAfter - canvasesBefore).toBeLessThanOrEqual(0);
  });
});

test.describe('Cold start — gamification off persona (AC-5)', () => {
  test('off-variant first-win body; completion fires no canvas and no legacy-Confetti node', async ({ page }) => {
    await seedFresh(page, {
      blocks: TWO_BLOCKS,
      profile: true,
      preferences: { gamification: 'off' },
    });

    // FirstWinCard renders the exact 'off' body while totalXP === 0.
    await page.goto('/rewards');
    await expect(page.getByTestId('first-win-card')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("That's the whole job for day one. Tomorrow's plan builds on it."),
    ).toBeVisible();

    // Completing the first block: haptic + chip only — no celebration layer.
    await page.goto('/');
    await expect(page.getByText("Today's flow")).toBeVisible({ timeout: 15_000 });
    const canvasesBefore = await page.locator('canvas').count();
    await holdToComplete(page, 'cs-block-1');
    await expect(page.getByTestId('routine-block-cs-block-1-completed')).toBeVisible({ timeout: 8_000 });

    await page.waitForTimeout(2_500);
    expect((await page.locator('canvas').count()) - canvasesBefore).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('legacy-confetti')).toHaveCount(0);
  });
});

test.describe('Cold start — Profile (AC-6)', () => {
  test('fresh: one starter line, no zeros, no segmented control', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/profile');

    await expect(
      page.getByText('Your stats begin with your first completed block on Today.'),
    ).toHaveCount(1, { timeout: 15_000 });
    // /\b0 min/ — matches "0 min" but never "10 min"/"30 min".
    await expect(page.getByText(/\b0 min/)).toHaveCount(0);
    await expect(page.getByText('No activity tracked yet', { exact: false })).toHaveCount(0);
    // The Today/This-week segmented control is absent.
    await expect(page.getByText('This week')).toHaveCount(0);
  });

  test('after one completed block: stats row renders, active-minutes slot is an em-dash, never "0 min"', async ({ page }) => {
    // totalXP 10 / totalMinutes 0 — the state right after the first block.
    await seedAuthedUser(page, {
      gamification: { totalXP: 10, domainScores: FLOOR_SCORES, streaks: ZERO_STREAKS },
    });
    await page.goto('/profile');

    // Row is back: total XP shows the real first number…
    await expect(page.getByText('10', { exact: true })).toBeVisible({ timeout: 15_000 });
    // …and the never-nonzero slots render the em-dash (U+2014), not zeros.
    await expect(page.getByText('—', { exact: true })).toHaveCount(2);
    await expect(page.getByText(/\b0 min/)).toHaveCount(0);
    // Starter line is gone with the first XP.
    await expect(
      page.getByText('Your stats begin with your first completed block on Today.'),
    ).toHaveCount(0);
  });
});

test.describe('Cold start — Explore, Health, Today (AC-7)', () => {
  test('Explore: THIS WEEK starter line, no "0 min"', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/explore');

    await expect(
      page.getByText('Save a spark to start counting.', { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\b0 min/)).toHaveCount(0);
  });

  test('Health: STREAKS card renders the starter line and no zero numeral', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/health');

    const card = page.getByTestId('health-streaks-card');
    await expect(
      card.getByText('Streaks start with your first workout or logged meal.'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('0', { exact: false })).toHaveCount(0);
  });

  test('Today: header starter caption, radar caption, and the radar has not moved', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/');

    await expect(page.getByText('Your first block fills this bar.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0/300 XP', { exact: false })).toHaveCount(0);

    // Radar caption shows while all six scores equal DOMAIN_SCORE_FLOOR.
    await expect(
      page.getByText('Your life in six directions', { exact: false }),
    ).toBeVisible();

    // Position lock: same measurement conditions as the committed baseline.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);
    const box = await page.getByTestId('today-hero-radar').boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.y - RADAR_Y_BASELINE)).toBeLessThanOrEqual(1);
  });
});

test.describe('Cold start — radar caption visibility contract (AC-12)', () => {
  test('all-floor domain scores → caption visible', async ({ page }) => {
    await seedFresh(page);
    await page.goto('/');
    await expect(
      page.getByText('Your life in six directions', { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('one diverged domain (goals 16) → caption absent from the DOM', async ({ page }) => {
    await seedAuthedUser(page, {
      gamification: {
        totalXP: 0,
        domainScores: { ...FLOOR_SCORES, goals: 16 },
        streaks: ZERO_STREAKS,
      },
    });
    await page.goto('/');
    // Anchor on the screen having mounted before asserting absence.
    await expect(page.getByTestId('today-hero-radar')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Your life in six directions', { exact: false }),
    ).toHaveCount(0);
  });
});
