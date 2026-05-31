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

export interface SeedOptions {
  /**
   * Routine blocks to seed for *today*. When provided, these REPLACE the single
   * default 'e2e-block-1' rest block. Dates/createdAt/updatedAt are filled in.
   */
  blocks?: SeedBlock[];
  /** Goal rows to seed under the e2e user. Defaults to none ([]). */
  goals?: SeedGoal[];
}

export async function seedAuthedUser(page: Page, options: SeedOptions = {}) {
  await page.addInitScript(
    ({ user, userId, options }) => {
      localStorage.setItem('lifeos_users', JSON.stringify([user]));
      localStorage.setItem('lifeos_session', userId);
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      // Goals — caller-supplied rows (e.g. a daily "Today's Task"). The web
      // store filters on userId, so every row is stamped with the e2e user.
      const goals = (options.goals ?? []).map((g) => ({
        userId,
        description: undefined,
        parentId: g.parentId,
        timeline: undefined,
        status: g.status ?? 'active',
        aiGenerated: false,
        createdAt: now,
        updatedAt: now,
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
        createdAt: now,
        updatedAt: now,
        ...b,
      }));
      localStorage.setItem('lifeos_routine_blocks', JSON.stringify(blocks));

      // Seed two days of domain history. Today's React #185 bug only fired
      // when yesterdaySnapshot() returned a non-null object — which requires
      // ≥2 entries per domain. Without this seed the smoke would have passed
      // and we would have shipped the loop again. zustand-persist shape:
      // { state: { entries }, version: 0 }.
      const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
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
    },
    { user: USER, userId: USER_ID, options },
  );
}

/**
 * Press-and-HOLD a routine block's status control past the commit window so it
 * flips to completed. A plain click is too fast — RoutineBlock arms a timer on
 * pressIn (HOLD_MS=250, or 80ms under reduced motion) and only commits on
 * timeout. We dispatch real mouse down → wait → up. 600ms clears both windows
 * with margin for slow CI runners.
 */
export async function holdToComplete(page: Page, blockId: string, holdMs = 600) {
  const statusBtn = page.getByTestId(`routine-block-${blockId}-status`);
  await statusBtn.scrollIntoViewIfNeeded();
  const box = await statusBtn.boundingBox();
  if (!box) throw new Error(`status button for ${blockId} has no bounding box`);
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
