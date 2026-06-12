/**
 * Module-screen hierarchy (module_hierarchy_v1) — Ink + Signal Cluster 4,
 * docs/design-deep-dive/04-module-screens.md.
 *
 * The wave-level e2e halves of C4-1 (hero-first order), C4-2 (first-viewport
 * elements), C4-5 (banned-strings sweep), C4-6 (Connections last), C4-9
 * (social snooze), C4-10 (reduced-motion stillness), C4-13 (finance trust
 * note) and C4-14 (Explore hero settles with the AI proxy blocked).
 *
 * Belongs to the `chromium` project: self-seeding via seedAuthedUser, no
 * Supabase session. The flag is forced two ways, both required (the
 * today-answer-first.spec.ts pattern): the persisted lifeos_flags_v4 store for
 * the boot value, and a **\/v1\/config** route stub because boot re-fetches
 * with force: true.
 *
 * Seeding gaps (documented skips, see the per-test comments):
 *  - Explore EMPTY `Add an interest`: unreachable end-to-end — generateDailySpark
 *    never rejects (curated fallback), so the hero always resolves to a spark.
 *  - Career SEEDED `Skill gaps`: state C needs an in-memory AI analysis.
 *  - Finance CONNECTED-with-transactions (spending-mix bar): transactions live
 *    in Dexie/IndexedDB, which the localStorage helpers cannot seed.
 *  - C4-9 day-advance re-appearance: Playwright cannot move the wall clock past
 *    the localStorage'd local-date cleanly; the unit test covers it.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedAuthedUser, type SeedOptions } from './helpers';

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.use({ viewport: { width: 390, height: 844 } });

// First-viewport budget pinned by C4-2 (§3.1 "content window ≈ 717pt").
const FOLD_Y = 717;

// Hero must sit directly under the ModuleHeader (C4-1): scroll gap is 16pt,
// budgeted with margin. Finance gets a second budget for the kept tab bar.
const HERO_GAP_BUDGET = 60;

// Mirror of FALLBACK_FLAGS in src/store/useFlagStore.ts with module_hierarchy_v1
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
  progress_map_v1: false,
  module_hierarchy_v1: true,
  cold_start_v1: true,
  today_answer_first_v1: false,
  install_prompt_v2: false,
};

async function seedFlagsOn(page: Page) {
  await page.addInitScript((flags) => {
    localStorage.setItem(
      'lifeos_flags_v4',
      JSON.stringify({ state: { flags, fetchedAt: Date.now() }, version: 0 }),
    );
  }, FLAGS_ON);
  await page.route('**/v1/config**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ flags: FLAGS_ON }),
    }),
  );
}

// ─── Seed fixtures ─────────────────────────────────────────────────────────────

const ZERO_STREAKS = {
  workout: { count: 0, lastDate: null, graceUsed: false },
  learning: { count: 0, lastDate: null, graceUsed: false },
  foodTracking: { count: 0, lastDate: null, graceUsed: false },
  journaling: { count: 0, lastDate: null, graceUsed: false },
  social: { count: 0, lastDate: null, graceUsed: false },
};

/** Day-1 persona: nothing logged anywhere. */
const EMPTY_SEED: SeedOptions = {
  blocks: [],
  gamification: { totalXP: 0, streaks: ZERO_STREAKS },
};

/** Seeded persona — everything the localStorage helpers can reach. */
const SEEDED_SEED: SeedOptions = {
  blocks: [],
  // Health populated: heightCm on the user + a weight log → hasBaseline.
  userFields: { heightCm: 175, age: 30 },
  weightLogs: [{ daysAgo: 1, weightKg: 70 }],
  // Social: Maya is overdue (cadence 7, last contact 30d > 7 * 1.2); Sam is
  // comfortably in cadence so the tier sections render too.
  contacts: [
    { id: 'e2e-ct-overdue', name: 'Maya Chen', relationshipType: 'inner_circle', preferredCadenceDays: 7, lastContactDaysAgo: 30 },
    { id: 'e2e-ct-ok', name: 'Sam Lee', relationshipType: 'mentor', preferredCadenceDays: 30, lastContactDaysAgo: 2 },
  ],
  // Explore: one interest + a deterministic today-spark (no generation race).
  interests: [{ id: 'e2e-int-1', name: 'Woodworking', category: 'craft' }],
  sparkToday: {
    id: 'e2e-spark-1',
    title: 'Joinery as compression',
    body: 'A dovetail is information about load paths, carved into the wood itself — the joint stores the engineering.',
    threadStarter: 'Which joint in your last build was doing silent structural work?',
    seedInterest: 'Woodworking',
    adjacentField: 'information theory',
  },
  // Finance: connected, nothing ingested yet (transactions live in Dexie and
  // cannot be seeded from localStorage — documented gap).
  gmailConnected: true,
};

/** Social C4-9 persona: EXACTLY one overdue contact, nobody else. */
const ONE_OVERDUE_SEED: SeedOptions = {
  blocks: [],
  contacts: [
    { id: 'e2e-ct-only', name: 'Maya Chen', relationshipType: 'inner_circle', preferredCadenceDays: 7, lastContactDaysAgo: 30 },
  ],
};

const SCREENS = [
  { name: 'health', path: '/health' },
  { name: 'explore', path: '/explore' },
  { name: 'career', path: '/career' },
  { name: 'social', path: '/social' },
  { name: 'finance', path: '/finance' },
] as const;

async function openScreen(page: Page, path: string, settleMs = 1_200) {
  await page.goto(path);
  await expect(page.getByTestId('module-header').first()).toBeVisible({ timeout: 15_000 });
  // Let the hero-budget entering animation (520ms) land before measuring.
  await page.waitForTimeout(settleMs);
}

// ─── C4-1 — one hero per screen, position 1 under the ModuleHeader ───────────

test.describe('C4-1 — {screen}-hero exists and is the first element below the ModuleHeader', () => {
  for (const [stateName, seed] of [['empty', EMPTY_SEED], ['seeded', SEEDED_SEED]] as const) {
    test(`${stateName} state: all five heroes present, directly under the header`, async ({ page }) => {
      await seedFlagsOn(page);
      await seedAuthedUser(page, seed);

      for (const screen of SCREENS) {
        await openScreen(page, screen.path);

        const headerBox = await page.getByTestId('module-header').first().boundingBox();
        expect(headerBox, `${screen.name}: module header box`).not.toBeNull();
        const headerBottom = headerBox!.y + headerBox!.height;

        // Absence is a failure, not a skip (§4 trap 9).
        const hero = page.getByTestId(`${screen.name}-hero`);
        await expect(hero, `${screen.name}-hero must exist (${stateName})`).toHaveCount(1);

        const heroBox = await hero.boundingBox();
        expect(heroBox, `${screen.name}-hero box (${stateName})`).not.toBeNull();
        expect(heroBox!.y, `${screen.name}: hero below header`).toBeGreaterThanOrEqual(headerBottom - 2);

        if (screen.name === 'finance') {
          // §3.5: the kept inner tab bar sits between header and hero — the
          // hero is position 1 *inside the Overview tab*, directly under it.
          const tabText = await page.getByText('Transactions', { exact: true }).boundingBox();
          expect(tabText, 'finance: tab bar present').not.toBeNull();
          expect(tabText!.y).toBeGreaterThanOrEqual(headerBottom - 2);
          expect(
            heroBox!.y,
            'finance: hero directly under the inner tab bar — nothing in between',
          ).toBeLessThanOrEqual(tabText!.y + tabText!.height + HERO_GAP_BUDGET);
        } else {
          expect(
            heroBox!.y,
            `${screen.name}: hero directly under the header — nothing in between`,
          ).toBeLessThanOrEqual(headerBottom + HERO_GAP_BUDGET);
        }
      }
    });
  }
});

// ─── C4-2 — committed first-viewport element per screen/state ────────────────

async function expectAboveFold(page: Page, text: string, label: string) {
  const el = page.getByText(text, { exact: true }).first();
  await expect(el, label).toBeVisible();
  const box = await el.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.y, `${label}: starts on-screen`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label}: fully above y=${FOLD_Y}`).toBeLessThanOrEqual(FOLD_Y);
}

test.describe('C4-2 — first-viewport elements (390×844, fully above y=717)', () => {
  test('empty states: Health / Career / Social / Finance committed CTAs', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, EMPTY_SEED);

    await openScreen(page, '/health');
    await expectAboveFold(page, 'Add height & weight', 'Health empty CTA');

    await openScreen(page, '/career');
    await expectAboveFold(page, 'Map my path', 'Career empty CTA');

    await openScreen(page, '/social');
    await expectAboveFold(page, 'Add someone', 'Social empty CTA');

    await openScreen(page, '/finance');
    await expectAboveFold(page, 'Connect Gmail', 'Finance disconnected CTA');
  });

  test('explore zero-interest state: the hero action lands above the fold', async ({ page }) => {
    // DOCUMENTED DEVIATION from the criterion's literal `Add an interest`:
    // generateDailySpark NEVER rejects — on any failure it returns a curated
    // fallback spark (src/explore/spark.ts buildMockSpark, "never show
    // nothing"), so the §3.2 EmptyState branch is unreachable end-to-end.
    // The de-facto first-run hero is the curated spark; its primary action
    // (`Pull thread`) is the element that must clear the fold.
    await seedFlagsOn(page);
    await seedAuthedUser(page, EMPTY_SEED);
    await openScreen(page, '/explore', 2_000);
    await expectAboveFold(page, 'Pull thread', 'Explore zero-interest hero action');
  });

  test('seeded states: Health `Log a meal`, Explore `Pull thread`, Social `Say hello`', async ({ page }) => {
    // Career seeded (`Skill gaps`) is SKIPPED: state C requires an in-memory
    // AI analysis (analyseSkillGap result) that no localStorage seed can
    // produce — reaching it needs a mocked AI round-trip through the setup
    // sheet, which is career-strategy.spec.ts territory.
    // Finance connected-with-transactions (the spending-mix bar) is SKIPPED:
    // transactions live in Dexie/IndexedDB, out of the helpers' reach.
    await seedFlagsOn(page);
    await seedAuthedUser(page, SEEDED_SEED);

    await openScreen(page, '/health');
    await expectAboveFold(page, 'Log a meal', 'Health seeded CTA');

    await openScreen(page, '/explore');
    await expectAboveFold(page, 'Pull thread', 'Explore seeded spark action');

    await openScreen(page, '/social');
    await expectAboveFold(page, 'Say hello', 'Social seeded CTA');
  });
});

// ─── C4-5 — the §5.5 banned-strings sweep ─────────────────────────────────────

// The §5 AC5 list, verbatim. Case-sensitive containment over body.innerText
// (sheets closed), so sentence-case survivors ("Strategy", "Blood reports")
// can never mask a caps regression.
const BANNED_STRINGS = [
  'IMPORT FROM YOUTUBE',
  'IMPORT FROM GOOGLE CONTACTS',
  'GOOGLE FIT',
  'GMAIL CONNECTED',
  'THIS MONTH SO FAR',
  'SPENDING MIX',
  'TOP CATEGORIES',
  'TRUE SAVINGS RATE',
  'STRATEGY',
  'WEEKLY TIPS',
  'NEW CAREER PATH',
  'ELITE STRATEGIST',
  'YOUR PATH',
  "TODAY'S SPARK",
  'PULL THE THREAD',
  'THIS WEEK',
  'YOUR MAPS',
  'YOUR INTERESTS',
  'YOUR CONSTELLATION',
  'ACTIVE EXPEDITIONS',
  'CHASING NOW',
  'THE FRONTIER',
  'CROSS-DISCIPLINE',
  'STREAKS',
  'CALORIE TRACKING',
  'BLOOD REPORTS',
  'MEAL IDEAS',
  'BLOOD REPORT',
  'SUBSCRIPTIONS & BILLS',
  'MILESTONES',
  'WEEKLY INSIGHT',
  'UPCOMING BIRTHDAYS',
  'Overdue',
] as const;

async function sweepBannedStrings(page: Page, label: string) {
  const text = await page.locator('body').innerText();
  for (const banned of BANNED_STRINGS) {
    expect(text, `${label}: banned string "${banned}" must not render`).not.toContain(banned);
  }
}

test.describe('C4-5 — §5.5 banned strings absent on all five screens', () => {
  for (const [stateName, seed] of [['empty', EMPTY_SEED], ['seeded', SEEDED_SEED]] as const) {
    test(`${stateName} state: zero banned strings, sheets closed`, async ({ page }) => {
      await seedFlagsOn(page);
      await seedAuthedUser(page, seed);
      if (stateName === 'seeded') {
        // Exercise the Goals inner tab's populated path too: a financial goal
        // + milestones (the persisted half of that tab) — MILESTONES et al.
        await page.addInitScript(() => {
          const now = new Date().toISOString();
          localStorage.setItem('lifeos_financial_goals', JSON.stringify([
            { id: 'e2e-fgoal', title: 'Emergency Fund', goalType: 'emergency_fund', targetAmount: 500000, monthlySavings: 20000, incomeBracket: '', riskProfile: 'moderate', targetDate: '2028-06-01', status: 'active', createdAt: now, updatedAt: now },
          ]));
          const ms = (id: string, title: string, done: boolean) => ({ id, goalId: 'e2e-fgoal', title, targetAmount: 125000, targetDate: '2027-06-01', createdAt: now, ...(done ? { completedAt: now } : {}) });
          localStorage.setItem('lifeos_finance_milestones', JSON.stringify([
            ms('e2e-m1', 'First quarter saved', true),
            ms('e2e-m2', 'Halfway there', false),
          ]));
        });
      }

      for (const screen of SCREENS) {
        await openScreen(page, screen.path);
        await sweepBannedStrings(page, `${screen.name} (${stateName})`);

        if (screen.name === 'finance') {
          // The inner tabs are part of the finance screen's scroll content.
          await page.getByText('Transactions', { exact: true }).click();
          await page.waitForTimeout(600);
          await sweepBannedStrings(page, `finance/transactions (${stateName})`);

          await page.getByText('Goals', { exact: true }).click();
          await page.waitForTimeout(600);
          await sweepBannedStrings(page, `finance/goals (${stateName})`);
        }
      }
    });
  }
});

// ─── C4-6 — every connect row under a LAST `Connections` SectionTitle ────────

// The SectionTitles each screen can render ABOVE Connections — used to assert
// "Connections is the LAST SectionTitle in the scroll" mechanically.
const EARLIER_SECTION_TITLES: Record<string, string[]> = {
  health: ['Today', 'Calories', 'Blood reports'],
  explore: ['Expeditions', 'Chasing now', 'Constellation', 'Your maps', 'Your interests'],
  social: ['Coming up', 'Reach out', 'Inner circle', 'Close friend', 'Family', 'Mentor', 'Colleague', 'Acquaintance'],
  finance: ['Where it went'],
};

test.describe('C4-6 — Connections is last; rows sit below their hero', () => {
  test('health / explore / social / finance rows render under the final Connections title', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, SEEDED_SEED);

    const rows: Array<{ screen: 'health' | 'explore' | 'social' | 'finance'; path: string; rowId: string }> = [
      { screen: 'health', path: '/health', rowId: 'connect-row-fit' },
      { screen: 'explore', path: '/explore', rowId: 'connect-row-youtube' },
      { screen: 'social', path: '/social', rowId: 'connect-row-contacts' },
      { screen: 'finance', path: '/finance', rowId: 'connect-row-gmail' },
    ];

    for (const { screen, path, rowId } of rows) {
      await openScreen(page, path);

      // Absence is a failure, not a skip (§4 trap 9).
      const row = page.getByTestId(rowId);
      await expect(row, `${rowId} must exist`).toHaveCount(1);

      const heroBox = await page.getByTestId(`${screen}-hero`).boundingBox();
      const rowBox = await row.boundingBox();
      const connectionsBox = await page.getByText('Connections', { exact: true }).boundingBox();
      expect(heroBox, `${screen}: hero box`).not.toBeNull();
      expect(rowBox, `${rowId}: box`).not.toBeNull();
      expect(connectionsBox, `${screen}: Connections title`).not.toBeNull();

      // Row below the hero, under its Connections title (§4 trap 3).
      expect(rowBox!.y, `${rowId}: y exceeds the hero's y`).toBeGreaterThan(heroBox!.y);
      expect(rowBox!.y, `${rowId}: sits under the Connections title`).toBeGreaterThan(connectionsBox!.y);

      // Connections is the LAST SectionTitle in the scroll content.
      for (const title of EARLIER_SECTION_TITLES[screen]) {
        const earlier = page.getByText(title, { exact: true }).first();
        if ((await earlier.count()) === 0) continue; // data-gated title not present
        const earlierBox = await earlier.boundingBox();
        if (!earlierBox) continue;
        expect(
          connectionsBox!.y,
          `${screen}: Connections renders below "${title}"`,
        ).toBeGreaterThan(earlierBox.y);
      }
    }
  });

  test('career renders no connect row and no Connections section (§3.3)', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, SEEDED_SEED);
    await openScreen(page, '/career');
    await expect(page.locator('[data-testid^="connect-row-"]')).toHaveCount(0);
    await expect(page.getByText('Connections', { exact: true })).toHaveCount(0);
  });
});

// ─── C4-9 — social snooze (e2e half) ──────────────────────────────────────────

test.describe('C4-9 — one overdue contact: named hero, Not today snoozes for the local day', () => {
  test('hero names the person; snooze hides it through a full reload', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, ONE_OVERDUE_SEED);
    await openScreen(page, '/social');

    // The h1 carries the first name and no digit (compassion rule, AC9).
    const h1 = page.getByText(/would love to hear from you\.$/);
    await expect(h1).toBeVisible();
    const h1Text = (await h1.textContent()) ?? '';
    expect(h1Text).toMatch(/^\S+ would love to hear from you\.$/);
    expect(h1Text).not.toMatch(/\d/);
    expect(h1Text.startsWith('Maya')).toBe(true);
    await expect(page.getByText('Say hello', { exact: true })).toBeVisible();

    // Snooze.
    await page.getByText('Not today', { exact: true }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/would love to hear from you\.$/)).toHaveCount(0);
    await expect(page.getByText('Say hello', { exact: true })).toHaveCount(0);
    // The slot stays mounted (AC1) — just empty for the day.
    await expect(page.getByTestId('social-hero')).toHaveCount(1);

    // Full reload, same local day: the snooze persisted (lifeos_hero_snooze_v1).
    await page.reload();
    await expect(page.getByTestId('module-header').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await expect(page.getByText(/would love to hear from you\.$/)).toHaveCount(0);
    await expect(page.getByText('Say hello', { exact: true })).toHaveCount(0);

    // Day-advance re-appearance is covered by the unit half: Playwright cannot
    // move the wall clock past the persisted local-date cleanly in this build.
  });
});

// ─── C4-10 — reduced motion: two screenshots 600ms apart, pixel-identical ────

test.describe('C4-10 — reduced motion renders a still page on every screen', () => {
  test('600ms-apart full-page screenshots are byte-identical per screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedFlagsOn(page);
    await seedAuthedUser(page, SEEDED_SEED);

    for (const screen of SCREENS) {
      await page.goto(screen.path);
      await expect(page.getByTestId('module-header').first()).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      // Settle: under reduce-motion every duration is 0, but async data
      // (stores, spark read) still needs a beat to land.
      await page.waitForTimeout(1_500);

      const first = await page.screenshot({ fullPage: true });
      await page.waitForTimeout(600);
      const second = await page.screenshot({ fullPage: true });
      expect(
        first.equals(second),
        `${screen.name}: zero entering/ambient motion under reduced-motion`,
      ).toBe(true);
    }
  });
});

// ─── C4-13 — finance disconnected: lock icon + exact trust note ───────────────

const TRUST_NOTE = 'Only transaction emails are scanned — nothing is uploaded.';

test.describe('C4-13 — the trust note renders verbatim beside the lock glyph', () => {
  test('disconnected web Overview: exact trustNote string + adjacent Ionicons glyph', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, EMPTY_SEED);
    await openScreen(page, '/finance');

    await expect(page.getByText(TRUST_NOTE, { exact: true })).toBeVisible();
    await expect(page.getByText('Connect your inbox', { exact: true })).toBeVisible();

    // The lock-closed-outline glyph sits in the same trust row (§3.0.4): the
    // note's parent row carries an Ionicons-font sibling. The exact icon NAME
    // is pinned by the FinanceHero/EmptyState unit halves.
    const hasIconSibling = await page.evaluate((note) => {
      const leaves = Array.from(document.querySelectorAll('div,span')).filter(
        (el) => el.childElementCount === 0 && el.textContent === note,
      );
      return leaves.some((leaf) => {
        const row = leaf.closest('div')?.parentElement;
        if (!row) return false;
        return Array.from(row.querySelectorAll('*')).some((el) =>
          getComputedStyle(el).fontFamily.toLowerCase().includes('ionicons'),
        );
      });
    }, TRUST_NOTE);
    expect(hasIconSibling, 'an Ionicons glyph renders adjacent to the trust note').toBe(true);

    // (Finance native title `Finance lives on the web for now` = unit test.)
  });
});

// ─── C4-14 — Explore hero settles with the AI proxy blocked ──────────────────

test.describe('C4-14 — AI proxy 500: the Explore hero settles, no skeleton remains', () => {
  test('hero resolves within 10.5s of focus and renders settled content', async ({ page }) => {
    await seedFlagsOn(page);
    await seedAuthedUser(page, EMPTY_SEED);
    // Block the model endpoint (§3.0.1 route pattern). In this harness the
    // client already fails fast (no Supabase session), but the stub pins the
    // behaviour for environments that do carry one.
    await page.route('**/claude', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/explore');
    await expect(page.getByTestId('module-header').first()).toBeVisible({ timeout: 15_000 });

    // §3.2 chain note: generateDailySpark resolves to a CURATED spark on AI
    // failure ("never show nothing"), so the settled state here is the spark
    // hero — strictly better than the criterion's Frontier/EmptyState/empty
    // floor. The binding clock is unchanged: settled within 10.5s of focus.
    const hero = page.getByTestId('explore-hero');
    await expect(hero).toHaveCount(1);
    await expect(
      hero.getByText('Pull thread', { exact: true }),
      'hero settles to actionable content within the 10.5s budget',
    ).toBeVisible({ timeout: 10_500 });

    // No Skeleton remains: the chain renders exactly one branch, and the
    // settled branch carries real text (a skeleton has none).
    const heroText = await hero.innerText();
    expect(heroText.length).toBeGreaterThan(0);
  });
});
