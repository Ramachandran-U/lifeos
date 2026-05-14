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

export async function seedAuthedUser(page: Page) {
  await page.addInitScript(
    ({ user, userId }) => {
      localStorage.setItem('lifeos_users', JSON.stringify([user]));
      localStorage.setItem('lifeos_session', userId);
      localStorage.setItem('lifeos_goals', JSON.stringify([]));
      // Seed one routine block for today so the "Today's flow" / Edit
      // routine surface renders. Without this, the Edit-routine smoke
      // navigation has no button to click.
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const block = {
        id: 'e2e-block-1',
        date: today,
        startTime: '10:00',
        endTime: '10:30',
        title: 'E2E sample block',
        module: 'rest',
        status: 'upcoming',
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem('lifeos_routine_blocks', JSON.stringify([block]));

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
    { user: USER, userId: USER_ID },
  );
}
