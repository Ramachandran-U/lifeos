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
    },
    { user: USER, userId: USER_ID },
  );
}
