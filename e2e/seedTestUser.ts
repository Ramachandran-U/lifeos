/**
 * Deterministic test-user data fixtures for Playwright (B-P0 of the test-coverage
 * plan). Two entry points share one browser-side builder:
 *
 *   - seedFixtureInitScript(page, name) — for the `chromium` project (no real
 *     session). Runs as an addInitScript BEFORE the app boots, under a fixed
 *     'e2e-user-1' id, and also writes the users+session rows (superset of the
 *     legacy seedAuthedUser).
 *   - seedFixtureForSession(page, name) — for the `authenticated` project (real
 *     Supabase session). Runs as a page.evaluate AFTER sign-in, keyed to the live
 *     `lifeos_session` id, so the persistent test user is loaded with the same
 *     deterministic data. Does NOT touch the users/session rows (auth.setup owns
 *     those).
 *
 * Fixtures:
 *   - fresh        — onboarded user, zero domain data (clean-slate render paths).
 *   - midOnboarding— partially-onboarded (onboardingStage 3), minimal data.
 *   - fullyLoaded  — every engine populated (goals, routine, health, finance,
 *                    explore, social, gamification, domain history) for assertions.
 *
 * All values are obviously fake (CLAUDE.md PII rule). Row shapes mirror the web
 * data layer in src/db/webStorage/* exactly so the app's read paths surface them.
 */
import { Page } from '@playwright/test';

export type FixtureName = 'fresh' | 'midOnboarding' | 'fullyLoaded';

interface SeedArg {
  name: FixtureName;
  mode: 'init' | 'session';
}

/**
 * Browser-side seed builder. Self-contained (references only its arg + browser
 * globals) so Playwright can serialize it for both addInitScript and evaluate.
 */
function seedBuilder(arg: SeedArg): void {
  const { name, mode } = arg;
  const userId = mode === 'init' ? 'e2e-user-1' : localStorage.getItem('lifeos_session');
  if (!userId) throw new Error('seedFixtureForSession: no lifeos_session in storage — call after sign-in');

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const set = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

  // In chromium (no real session) we own the users + session rows. In the
  // authenticated project auth.setup.ts already injected the onboarded row keyed
  // to the real Supabase id, so we leave it untouched.
  if (mode === 'init') {
    const onboardingStage = name === 'midOnboarding' ? 3 : 100;
    set('lifeos_users', [{
      id: userId,
      email: 'lifeos-e2e-test@example.com',
      passwordHash: 'x',
      passwordSalt: 'x',
      name: 'E2E Test User',
      onboardingStage,
      installDate: now,
      createdAt: now,
      updatedAt: now,
    }]);
    localStorage.setItem('lifeos_session', userId);
  }

  // Two days of domain history so Today's yesterdaySnapshot() path (≥2 entries
  // per domain) is exercised — the React #185 loop only fires with this present.
  set('lifeos_domain_history_v1', {
    state: {
      entries: {
        goals: [{ date: yesterday, score: 22 }, { date: today, score: 28 }],
        health: [{ date: yesterday, score: 35 }, { date: today, score: 40 }],
        finance: [{ date: yesterday, score: 18 }, { date: today, score: 21 }],
        career: [{ date: yesterday, score: 30 }, { date: today, score: 32 }],
        social: [{ date: yesterday, score: 12 }, { date: today, score: 14 }],
        mind: [{ date: yesterday, score: 25 }, { date: today, score: 30 }],
      },
    },
    version: 0,
  });

  if (name === 'fresh') {
    // Onboarded but empty — clear any engine data so clean-slate states render.
    for (const k of [
      'lifeos_goals', 'lifeos_routine_blocks', 'lifeos_health_logs', 'lifeos_financial_goals',
      'lifeos_finance_milestones', 'lifeos_sparks', 'lifeos_expeditions', 'lifeos_expedition_progress',
      'lifeos_contacts', 'lifeos_contact_interactions', 'lifeos_gamification',
    ]) set(k, []);
    return;
  }

  // ── Goals: one life goal + two daily tasks (level 'daily' + status 'active'
  //    land in Today's Tasks). Shape matches src/db/queries web branch. ──
  set('lifeos_goals', [
    { id: 'e2e-goal-life', userId, title: 'Become a polymath', goalType: 'personal', level: 'life', status: 'active', aiGenerated: false, createdAt: now, updatedAt: now },
    { id: 'e2e-task-read', userId, parentId: 'e2e-goal-life', title: 'Read 20 pages', goalType: 'learning', level: 'daily', status: 'active', aiGenerated: false, createdAt: now, updatedAt: now },
    { id: 'e2e-task-workout', userId, parentId: 'e2e-goal-life', title: 'Log a workout', goalType: 'health', level: 'daily', status: 'active', aiGenerated: false, createdAt: now, updatedAt: now },
  ]);

  if (name === 'midOnboarding') return; // partial: goals + history only

  // ── Routine: one block per module for today (status upcoming). ──
  const block = (id: string, startTime: string, endTime: string, title: string, module: string) =>
    ({ id, date: today, startTime, endTime, title, module, status: 'upcoming', createdAt: now, updatedAt: now });
  set('lifeos_routine_blocks', [
    block('e2e-block-goal', '08:00', '08:30', 'Deep work on vision', 'goal'),
    block('e2e-block-health', '09:00', '09:45', 'Morning workout', 'health'),
    block('e2e-block-finance', '12:00', '12:15', 'Review spending', 'finance'),
    block('e2e-block-career', '14:00', '15:00', 'Upskill: system design', 'career'),
    block('e2e-block-social', '18:00', '18:30', 'Call a friend', 'social'),
    block('e2e-block-polymath', '20:00', '20:30', 'Explore a spark', 'polymath'),
    block('e2e-block-rest', '22:00', '22:30', 'Wind down', 'rest'),
  ]);

  // ── Health: today (water + energy + sleep) and a prior weight log. ──
  set('lifeos_health_logs', [
    { id: 'e2e-hl-today', date: today, waterMl: 500, energyLevel: 3, sleepHours: 7, source: 'manual', createdAt: now },
    { id: 'e2e-hl-prev', date: yesterday, weight: 70, sleepHours: 6.5, source: 'manual', createdAt: now },
  ]);

  // ── Finance: an active goal + a milestone (web store filters status==='active'). ──
  set('lifeos_financial_goals', [
    { id: 'e2e-fin-1', title: 'Emergency Fund', goalType: 'saving', currency: 'INR', targetAmount: 100000, monthlySavings: 10000, status: 'active', createdAt: now, updatedAt: now },
  ]);
  set('lifeos_finance_milestones', [
    { id: 'e2e-fin-ms-1', goalId: 'e2e-fin-1', title: 'First 25k', targetAmount: 25000, targetDate: today, createdAt: now },
  ]);

  // ── Explore: a spark for today + an in-progress expedition. ──
  set('lifeos_sparks', [
    { id: 'e2e-spark-1', userId, date: today, title: 'Why do bees build hexagons?', body: 'Hexagonal packing minimises wax for maximal storage.', threadStarter: 'What other tilings appear in nature?', seedInterest: 'biology', adjacentField: 'geometry', status: 'active', threadId: null, createdAt: now },
  ]);
  set('lifeos_expeditions', [
    { id: 'e2e-exp-1', userId, title: 'Intro to Bayesian thinking', theme: 'probability', domain: 'mind', steps: JSON.stringify([{ title: 'Priors' }, { title: 'Likelihood' }, { title: 'Posterior' }]), totalSteps: 3, source: 'ai', seedSparkId: null, createdAt: now },
  ]);
  set('lifeos_expedition_progress', [
    { id: 'e2e-expprog-1', userId, expeditionId: 'e2e-exp-1', status: 'active', currentStep: 1, completedSteps: JSON.stringify([0]), startedAt: now, lastActivityAt: now, completedAt: null, updatedAt: now },
  ]);

  // ── Social: one contact (+ a logged interaction). ──
  set('lifeos_contacts', [
    { id: 'e2e-contact-1', userId, name: 'Alex Rivera', relationshipType: 'friend', preferredCadenceDays: 14, lastContactDate: yesterday, source: 'manual', createdAt: now, updatedAt: now, deletedAt: null },
  ]);
  set('lifeos_contact_interactions', [
    { id: 'e2e-int-1', contactId: 'e2e-contact-1', date: yesterday, type: 'call', notes: 'Caught up', createdAt: now },
  ]);

  // ── Gamification: XP/streaks/domain scores so the rewards surface renders. ──
  set('lifeos_gamification', [
    { id: 'e2e-gam-1', userId, domainScores: JSON.stringify({ goals: 28, health: 40, finance: 21, career: 32, social: 14, mind: 30 }), streaks: JSON.stringify({ workout: 3, learning: 5 }), badges: JSON.stringify(['first_blueprint']), totalXP: 1250, weeklyXP: 180, createdAt: now, updatedAt: now },
  ]);
}

/** Seed a fixture for the `chromium` project (no real session, fixed id). */
export async function seedFixtureInitScript(page: Page, name: FixtureName = 'fullyLoaded'): Promise<void> {
  const arg: SeedArg = { name, mode: 'init' };
  await page.addInitScript(seedBuilder, arg);
}

/** Seed a fixture for the `authenticated` project — call AFTER sign-in, then
 *  reload so the app reads it. Keys to the live `lifeos_session` id. */
export async function seedFixtureForSession(page: Page, name: FixtureName = 'fullyLoaded'): Promise<void> {
  const arg: SeedArg = { name, mode: 'session' };
  await page.evaluate(seedBuilder, arg);
}
