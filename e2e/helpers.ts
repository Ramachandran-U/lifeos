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
    },
    { user: USER, userId: USER_ID },
  );
}
