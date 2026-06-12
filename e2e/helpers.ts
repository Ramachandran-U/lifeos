import { Page } from '@playwright/test';

const USER_ID = 'e2e-user-1';
const NOW = new Date().toISOString();

const USER = {
  id: USER_ID,
  email: 'e2e@lifeos.test',
  passwordHash: 'x',
  passwordSalt: 'x',
  name: 'E2E User',
  onboardingStage: 100,
  primaryDomains: ['health', 'career', 'goals', 'finance'],
  installDate: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

/** A routine block as persisted in the web (`lifeos_routine_blocks`) store. */
export interface SeedBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  /** goal/health/finance/career/social/polymath OR non-domain rest/meal/work. */
  module: string;
  status?: string;
}

/** A goal node as persisted in the web (`lifeos_goals`) store. */
export interface SeedGoal {
  id: string;
  title: string;
  goalType: string;
  level: string;
  status?: string;
  parentId?: string;
}

export interface SeedGameState {
  /** Starting XP total. Default 0. */
  totalXP?: number;
  /** Per-domain scores 0–100. Defaults to realistic mid-game values. */
  domainScores?: Partial<Record<string, number>>;
  /**
   * Streak map override. When provided it REPLACES the default mid-game
   * streaks (workout 3 / learning 5 / foodTracking 2 / social 1) — e.g. the
   * cold-start suite seeds all-zero streaks. Additive: callers that omit it
   * are unchanged.
   */
  streaks?: Record<
    string,
    { count: number; lastDate: string | null; graceUsed: boolean; best?: number }
  >;
}

/** A contact row as persisted in the web (`lifeos_contacts`) store. */
export interface SeedContact {
  id: string;
  name: string;
  /** inner_circle / close_friend / family / mentor / colleague / acquaintance. */
  relationshipType: string;
  preferredCadenceDays: number;
  /**
   * Days since last contact. computeOverdue flags a contact when
   * daysSince > preferredCadenceDays * 1.2 — e.g. cadence 7 + lastContact 30
   * days ago = overdue. Omit for "never contacted" (anchor = createdAt, today).
   */
  lastContactDaysAgo?: number;
  /** YYYY-MM-DD; optional. */
  birthday?: string;
}

/** An interest row as persisted in the web (`lifeos_interests`) store. */
export interface SeedInterest {
  id: string;
  name: string;
  category: string;
  weeklyMinutesTarget?: number;
}

/** A today-spark as persisted in the web (`lifeos_sparks`) store. */
export interface SeedSpark {
  id: string;
  title: string;
  body: string;
  threadStarter: string;
  seedInterest: string;
  adjacentField: string;
  /** new / seen / saved / explored / dismissed. Default 'new'. */
  status?: string;
}

/** Persisted shape of usePreferencesStore (localStorage 'lifeos_preferences_v1'). */
export interface SeedPreferences {
  theme?: 'dark' | 'light';
  density?: 'compact' | 'cozy' | 'spacious';
  motionIntensity?: 'off' | 'subtle' | 'normal' | 'bold';
  gamification?: 'full' | 'minimal' | 'off';
  narrationEnabled?: boolean;
  soundEnabled?: boolean;
}

export interface SeedOptions {
  /**
   * Routine blocks to seed for *today*. When provided, these REPLACE the single
   * default 'e2e-block-1' rest block. Dates/createdAt/updatedAt are filled in.
   */
  blocks?: SeedBlock[];
  /** Goal rows to seed under the e2e user. Defaults to none ([]). */
  goals?: SeedGoal[];
  /** Gamification state. Defaults to zeroed-out XP and mid-game domain scores. */
  gamification?: SeedGameState;
  /**
   * Optional usePreferencesStore seed ('lifeos_preferences_v1'), e.g.
   * { gamification: 'off' } for the gamification-off persona. Default: unset
   * (store defaults apply). Additive — existing callers unchanged.
   */
  preferences?: SeedPreferences;
  /**
   * Seed an empty user-profile row ('lifeos_user_profiles') so the
   * firstBlockCompletedAt stamp guard on Today is live (it requires an
   * existing profile). Default false — existing callers unchanged.
   */
  profile?: boolean;
  /**
   * Extra fields merged onto the seeded user row (e.g. { heightCm: 175,
   * age: 30 }) — the Health hero's hasBaseline needs heightCm on the user.
   * Additive — existing callers unchanged.
   */
  userFields?: Record<string, unknown>;
  /**
   * Weight logs ('lifeos_health_logs'). Together with userFields.heightCm this
   * flips the Health hero to its populated state. Additive.
   */
  weightLogs?: { daysAgo: number; weightKg: number }[];
  /** Contact rows ('lifeos_contacts') under the e2e user. Additive. */
  contacts?: SeedContact[];
  /** Interest rows ('lifeos_interests') under the e2e user. Additive. */
  interests?: SeedInterest[];
  /**
   * A spark dated *today* ('lifeos_sparks') so Explore's hero renders the
   * seeded spark instead of generating one. Additive.
   */
  sparkToday?: SeedSpark;
  /**
   * Seed a fake Gmail token ('lifeos_gmail_tokens') + a last-sync stamp so the
   * Finance Overview renders its connected state. Transactions live in
   * Dexie/IndexedDB and are NOT seeded by this helper — the connected state is
   * "connected, nothing ingested yet". Additive.
   */
  gmailConnected?: boolean;
}

export async function seedAuthedUser(page: Page, options: SeedOptions = {}) {
  await page.addInitScript(
    ({ user, userId, options }) => {
      // userFields (e.g. heightCm) merge onto the canonical row — additive.
      localStorage.setItem(
        'lifeos_users',
        JSON.stringify([{ ...user, ...(options.userFields ?? {}) }]),
      );
      localStorage.setItem('lifeos_session', userId);
      const now = new Date();
      // Use LOCAL date (matching date-fns `format(new Date(), 'yyyy-MM-dd')`) so
      // getRoutineBlocksByDate finds our seeded blocks and does NOT trigger
      // cloneRoutineToDate (which generates fresh nanoid IDs, breaking testID lookups).
      const pad = (n: number) => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const nowIso = now.toISOString();

      // Goals — caller-supplied rows (e.g. a daily "Today's Task"). The web
      // store filters on userId, so every row is stamped with the e2e user.
      const goals = (options.goals ?? []).map((g) => ({
        userId,
        description: undefined,
        parentId: g.parentId,
        timeline: undefined,
        status: g.status ?? 'active',
        aiGenerated: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...g,
      }));
      localStorage.setItem('lifeos_goals', JSON.stringify(goals));

      // Routine blocks for today. Either the caller's variety set, or one
      // default 'e2e-block-1' rest block so the "Today's flow" / Edit-routine
      // surface always renders (the original smoke contract).
      const sourceBlocks = options.blocks ?? [
        {
          id: 'e2e-block-1',
          startTime: '10:00',
          endTime: '10:30',
          title: 'E2E sample block',
          module: 'rest',
        },
      ];
      const blocks = sourceBlocks.map((b) => ({
        date: today,
        status: 'upcoming',
        createdAt: nowIso,
        updatedAt: nowIso,
        ...b,
      }));
      localStorage.setItem('lifeos_routine_blocks', JSON.stringify(blocks));

      // Seed two days of domain history. Today's React #185 bug only fired
      // when yesterdaySnapshot() returned a non-null object — which requires
      // ≥2 entries per domain. Without this seed the smoke would have passed
      // and we would have shipped the loop again. zustand-persist shape:
      // { state: { entries }, version: 0 }.
      const yest = new Date(now.getTime() - 86_400_000);
      const yesterdayDate = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
      const history = {
        state: {
          entries: {
            goals:   [{ date: yesterdayDate, score: 22 }, { date: today, score: 28 }],
            health:  [{ date: yesterdayDate, score: 35 }, { date: today, score: 40 }],
            finance: [{ date: yesterdayDate, score: 18 }, { date: today, score: 21 }],
            career:  [{ date: yesterdayDate, score: 30 }, { date: today, score: 32 }],
            social:  [{ date: yesterdayDate, score: 12 }, { date: today, score: 14 }],
            mind:    [{ date: yesterdayDate, score: 25 }, { date: today, score: 30 }],
          },
        },
        version: 0,
      };
      localStorage.setItem('lifeos_domain_history_v1', JSON.stringify(history));

      // Gamification row. The web app reads lifeos_gamification on mount via
      // getOrCreateGamification. Seeding a known totalXP lets CUJ tests assert
      // the exact delta after actions like block completion (should be +10, not +20).
      const scores = {
        goals: 40, health: 50, finance: 30, career: 35, social: 20, polymath: 25,
        ...(options.gamification?.domainScores ?? {}),
      };
      const gamif = {
        id: userId + '-game',
        userId,
        domainScores: JSON.stringify(scores),
        streaks: JSON.stringify(options.gamification?.streaks ?? {
          workout:      { count: 3, lastDate: yesterdayDate, graceUsed: false },
          learning:     { count: 5, lastDate: yesterdayDate, graceUsed: false },
          foodTracking: { count: 2, lastDate: yesterdayDate, graceUsed: false },
          journaling:   { count: 0, lastDate: null, graceUsed: false },
          social:       { count: 1, lastDate: yesterdayDate, graceUsed: false },
        }),
        badges: JSON.stringify([]),
        totalXP: options.gamification?.totalXP ?? 0,
        weeklyXP: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      localStorage.setItem('lifeos_gamification', JSON.stringify([gamif]));

      // Optional usePreferencesStore seed (e.g. gamification 'off' persona).
      if (options.preferences) {
        localStorage.setItem('lifeos_preferences_v1', JSON.stringify(options.preferences));
      }

      // ── W4 module-hierarchy seeds (all additive) ────────────────────────────

      // Weight logs → Health hero hasBaseline (with userFields.heightCm).
      if (options.weightLogs && options.weightLogs.length > 0) {
        const logs = options.weightLogs.map((w, i) => {
          const d = new Date(now.getTime() - w.daysAgo * 86_400_000);
          const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return {
            id: `e2e-hlog-${i}`,
            date,
            weight: w.weightKg,
            source: 'manual',
            createdAt: nowIso,
          };
        });
        localStorage.setItem('lifeos_health_logs', JSON.stringify(logs));
      }

      // Contacts → Social hero (overdue when daysSince > cadence * 1.2).
      if (options.contacts && options.contacts.length > 0) {
        const dateAgo = (n: number) => {
          const d = new Date(now.getTime() - n * 86_400_000);
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };
        const contacts = options.contacts.map((ct) => ({
          id: ct.id,
          userId,
          name: ct.name,
          nickname: null,
          relationshipType: ct.relationshipType,
          preferredCadenceDays: ct.preferredCadenceDays,
          lastContactDate: ct.lastContactDaysAgo != null ? dateAgo(ct.lastContactDaysAgo) : null,
          notes: null,
          birthday: ct.birthday ?? null,
          source: 'manual',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        }));
        localStorage.setItem('lifeos_contacts', JSON.stringify(contacts));
      }

      // Interests → Explore supporting cast + spark seeds.
      if (options.interests && options.interests.length > 0) {
        const interests = options.interests.map((it) => ({
          id: it.id,
          userId,
          name: it.name,
          category: it.category,
          weeklyMinutesTarget: it.weeklyMinutesTarget ?? 60,
          weeklyMinutesActual: 0,
          explorationDepth: 'taste',
          status: 'active',
          discoveredBy: 'user',
          timeProtected: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
        localStorage.setItem('lifeos_interests', JSON.stringify(interests));
      }

      // A today-spark → Explore hero renders it without touching generation.
      if (options.sparkToday) {
        const s = options.sparkToday;
        localStorage.setItem(
          'lifeos_sparks',
          JSON.stringify([
            {
              id: s.id,
              userId,
              date: today,
              title: s.title,
              body: s.body,
              threadStarter: s.threadStarter,
              seedInterest: s.seedInterest,
              adjacentField: s.adjacentField,
              status: s.status ?? 'new',
              threadId: null,
              createdAt: nowIso,
            },
          ]),
        );
      }

      // Gmail "connected" → Finance Overview connected state (token presence is
      // the whole check — isGmailConnected just reads this key).
      if (options.gmailConnected) {
        localStorage.setItem(
          'lifeos_gmail_tokens',
          JSON.stringify({
            access_token: 'e2e-fake-gmail-token',
            refresh_token: 'e2e-fake-gmail-refresh',
            expires_at: now.getTime() + 86_400_000,
          }),
        );
        localStorage.setItem('lifeos_last_sync', nowIso);
      }

      // Optional empty user-profile row so the first-block stamp guard is live
      // (web store returns the object as-is; only the native path Zod-parses).
      if (options.profile) {
        localStorage.setItem('lifeos_user_profiles', JSON.stringify([
          {
            userId,
            profile: {
              version: 1,
              identity: { firstName: 'E2E', ageBand: null, seasonOfLife: null },
              vision: { statement: null, horizon: null, topGoals: [] },
              schedule: { wakeTime: null, sleepTime: null, workStartTime: null, workEndTime: null, fixedBlocks: [] },
              chronotype: null,
              primaryDomains: [],
              habits: { current: [], aspirational: [] },
              constraints: [],
              struggles: [],
              values: [],
              communication: { tone: null, avoid: [] },
              confidence: {
                identity: 0, vision: 0, schedule: 0, chronotype: 0,
                habits: 0, constraints: 0, primaryDomains: 0, overall: 0,
              },
              inferredPreferences: {
                preferredBlockMinutes: null,
                productiveHours: [],
                droppedHabits: [],
                preferredRestDays: [],
              },
              source: 'form',
              lastUpdated: nowIso,
              firstBlockCompletedAt: null,
            },
          },
        ]));
      }
    },
    { user: USER, userId: USER_ID, options },
  );
}

/**
 * Seed a fake Supabase auth session so `callViaProxy` passes the client-side
 * auth guard (`supabase.auth.getSession()` must return a non-null session).
 *
 * Call this BEFORE `seedAuthedUser` in tests that exercise AI-dependent flows
 * (e.g. goal decomposition). Do NOT use it in tests that don't need AI — the
 * fake token can trigger Supabase's background validation, which fires a
 * SIGNED_OUT event that wipes the user store and breaks navigation tests.
 *
 * Why it works: `mockAIProxy` intercepts the network request before it reaches
 * the Worker, so the fake access_token is never validated server-side.
 * `expires_at: 9999999999` suppresses Supabase's auto-refresh timer.
 */
export async function seedSupabaseSession(page: Page) {
  await page.addInitScript(({ userId }) => {
    const fakeSession = {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtdXNlci0xIiwiZW1haWwiOiJlMmVAbGlmZW9zLnRlc3QiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9.e2e-fake-sig',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      refresh_token: 'e2e-fake-refresh',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'e2e@lifeos.test',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { name: 'E2E User' },
        created_at: '2024-01-01T00:00:00.000Z',
      },
    };
    // Supabase JS v2 reads from 'sb-{projectRef}-auth-token' (projectRef from URL).
    localStorage.setItem('sb-izojsgzlaehodwlqwyvf-auth-token', JSON.stringify(fakeSession));
  }, { userId: USER_ID });
}

/**
 * Seed a logged-in user with *filled* data tuned for visual-regression baselines
 * — the test-suite mirror of the run-lifeos driver's `--rich` flag (keep the two
 * in sync). Where `seedAuthedUser` leaves bars empty and `fullyLoaded` seeds
 * 0%-progress data, this produces the deterministic fill proportions the gradient
 * bars are meant to show: goals Career 75 % / Health 40 % (parent + children with
 * completions), finance 50 % (completed-milestone amount / target), social 60 %
 * (3 of 5 contacts inside cadence). Also forces reduce-motion so animated fills
 * jump to final state, and dismisses the Add-to-Home-Screen banner — both remove
 * non-determinism from the screenshot. Call before `page.goto()`.
 */
export async function seedVisualRich(page: Page) {
  await page.addInitScript(
    ({ user, userId }) => {
      const now = new Date().toISOString();
      const dateAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
      const today = now.slice(0, 10);
      const yesterday = dateAgo(1);
      const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

      set('lifeos_users', [user]);
      localStorage.setItem('lifeos_session', userId);

      // Deterministic rendering: reduce-motion (fills land instantly) + no A2HS banner.
      set('lifeos_preferences_v1', { theme: 'dark', density: 'cozy', motionIntensity: 'off', gamification: 'full', narrationEnabled: true });
      localStorage.setItem('lifeos_a2hs_dismissed', '1');

      // Goals: yearly parents + monthly children. Progress = completed / total
      // descendants → Career 3/4 = 75 %, Health 2/5 = 40 %.
      const g = (o: Record<string, unknown>) => ({ userId, status: 'active', aiGenerated: false, createdAt: now, updatedAt: now, ...o });
      set('lifeos_goals', [
        g({ id: 'vr-career', title: 'Ship the mobile app', goalType: 'career', level: 'yearly', priority: 0 }),
        g({ id: 'vr-career-1', title: 'Design system', goalType: 'career', level: 'monthly', parentId: 'vr-career', status: 'completed' }),
        g({ id: 'vr-career-2', title: 'Auth flow', goalType: 'career', level: 'monthly', parentId: 'vr-career', status: 'completed' }),
        g({ id: 'vr-career-3', title: 'Offline sync', goalType: 'career', level: 'monthly', parentId: 'vr-career', status: 'completed' }),
        g({ id: 'vr-career-4', title: 'App store launch', goalType: 'career', level: 'monthly', parentId: 'vr-career' }),
        g({ id: 'vr-health', title: 'Run a half marathon', goalType: 'health', level: 'yearly', priority: 1 }),
        g({ id: 'vr-health-1', title: 'Build a base', goalType: 'health', level: 'monthly', parentId: 'vr-health', status: 'completed' }),
        g({ id: 'vr-health-2', title: '10k race', goalType: 'health', level: 'monthly', parentId: 'vr-health', status: 'completed' }),
        g({ id: 'vr-health-3', title: 'Long runs', goalType: 'health', level: 'monthly', parentId: 'vr-health' }),
        g({ id: 'vr-health-4', title: 'Taper weeks', goalType: 'health', level: 'monthly', parentId: 'vr-health' }),
        g({ id: 'vr-health-5', title: 'Race day', goalType: 'health', level: 'monthly', parentId: 'vr-health' }),
      ]);

      // Finance: goal + milestones. Completed amount / target = 25000 / 50000 = 50 %.
      set('lifeos_financial_goals', [
        { id: 'vr-fgoal', title: 'Dream home down payment', goalType: 'home', targetAmount: 50000, currency: 'USD', monthlySavings: 1500, status: 'active', createdAt: now, updatedAt: now },
      ]);
      const ms = (id: string, title: string, done: boolean) => ({ id, goalId: 'vr-fgoal', title, targetAmount: 12500, targetDate: '2028-06-01', createdAt: now, ...(done ? { completedAt: now } : {}) });
      set('lifeos_finance_milestones', [ms('vr-m1', 'First 25%', true), ms('vr-m2', 'Halfway', true), ms('vr-m3', 'Three quarters', false), ms('vr-m4', 'Full deposit', false)]);

      // Contacts: 3 of 5 inside their cadence window → social score 60 %.
      const c = (id: string, name: string, rel: string, cadence: number, lastDays: number) => ({ id, userId, name, nickname: null, relationshipType: rel, preferredCadenceDays: cadence, lastContactDate: dateAgo(lastDays), notes: null, birthday: null, source: 'manual', createdAt: now, updatedAt: now, deletedAt: null });
      set('lifeos_contacts', [
        c('vr-c1', 'Alex Rivera', 'inner_circle', 7, 3),
        c('vr-c2', 'Sam Chen', 'close_friend', 14, 10),
        c('vr-c3', 'Jordan Lee', 'family', 14, 8),
        c('vr-c4', 'Priya Patel', 'colleague', 21, 40),
        c('vr-c5', 'Morgan Diaz', 'mentor', 30, 55),
      ]);

      // Two days of domain history so Today's yesterdaySnapshot path renders.
      set('lifeos_domain_history_v1', {
        state: { entries: {
          goals: [{ date: yesterday, score: 22 }, { date: today, score: 28 }],
          health: [{ date: yesterday, score: 35 }, { date: today, score: 40 }],
          finance: [{ date: yesterday, score: 18 }, { date: today, score: 21 }],
          career: [{ date: yesterday, score: 30 }, { date: today, score: 32 }],
          social: [{ date: yesterday, score: 12 }, { date: today, score: 14 }],
          mind: [{ date: yesterday, score: 25 }, { date: today, score: 30 }],
        } }, version: 0,
      });
    },
    { user: USER, userId: USER_ID },
  );
}

/**
 * Intercept all calls to the LifeOS AI proxy Worker and return a deterministic
 * response. Prevents real AI quota use and makes AI-dependent flows testable.
 *
 * Call before `page.goto()`. Pass `responseText` for the JSON text the proxy
 * would normally return (already-stringified JSON string, matching what callAI
 * returns as the `text` field).
 */
export async function mockAIProxy(page: Page, responseText: string) {
  await page.route('**/lifeos-ai-proxy**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: responseText, model: 'mock', usage: { input_tokens: 0, output_tokens: 0 } }),
    });
  });
}

/**
 * Read the current totalXP for the seeded e2e user from localStorage.
 * Call after an action that should award XP and a brief settle delay.
 */
export async function readTotalXP(page: Page, userId = 'e2e-user-1'): Promise<number> {
  return page.evaluate((uid) => {
    try {
      const all = JSON.parse(localStorage.getItem('lifeos_gamification') ?? '[]') as Array<{ userId: string; totalXP: number }>;
      return all.find((g) => g.userId === uid)?.totalXP ?? 0;
    } catch { return 0; }
  }, userId);
}

/**
 * Press-and-HOLD a routine block's status control past the commit window so it
 * flips to completed. A plain click is too fast — RoutineBlock arms a timer on
 * pressIn (HOLD_MS=250, or 80ms under reduced motion) and only commits on
 * timeout. We dispatch real mouse down → wait → up. 600ms clears both windows
 * with margin for slow CI runners.
 *
 * Uses waitForSelector(attached) + JS scrollIntoView instead of Playwright's
 * scrollIntoViewIfNeeded, which can block indefinitely when Reanimated 4
 * entering-animation wrappers keep the element's stability check pending on
 * the static-export (Cloudflare Pages) build.
 */
export async function holdToComplete(page: Page, blockId: string, holdMs = 600) {
  const selector = `[data-testid="routine-block-${blockId}-status"]`;
  // Wait for the element to be in the DOM. State 'attached' has no
  // visibility/stability requirement, so Reanimated animations don't block it.
  await page.waitForSelector(selector, { state: 'attached', timeout: 30_000 });
  // Give FadeIn entering animations time to finish (420ms delay + 420ms duration
  // in index.tsx + 300ms in RoutineBlock = ~1140ms total), then scroll via JS
  // so we skip Playwright's stability-check loop entirely.
  await page.waitForTimeout(1300);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, selector);
  await page.waitForTimeout(100);
  const statusBtn = page.getByTestId(`routine-block-${blockId}-status`);
  const box = await statusBtn.boundingBox();
  if (!box) throw new Error(`status button for ${blockId} has no bounding box — element may be hidden by an animation`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

/**
 * Attach console-error / pageerror listeners and return the collected arrays.
 * Mirrors the smoke suite's capture so interaction specs can assert "no crash".
 * Benign warnings the app emits on web are filtered out.
 */
export function captureErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const IGNORE = [
    'Download the React DevTools',
    'ExpoFontLoader',
    'expo-font',
    'Reanimated',
    'useNativeDriver',
    '[Violation]',
    'ResizeObserver loop',
    'lifeos-ai-proxy',
    'blocked by CORS policy',
    'Failed to load resource',
    'Unknown event handler property',
    'Did not receive response to shouldStartLoad',
    'Tried to register two views with the same name',
  ];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE.some((p) => text.includes(p))) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}`);
  });
  return { consoleErrors, pageErrors };
}

/**
 * Assert the SPA root still has rendered children — i.e. the screen did NOT go
 * blank (the React #130 white-screen signature). React mounts into #root.
 */
export async function assertNotBlank(page: Page) {
  const childCount = await page.evaluate(() => {
    const root = document.getElementById('root') ?? document.body;
    return root ? root.querySelectorAll('*').length : 0;
  });
  return childCount;
}
