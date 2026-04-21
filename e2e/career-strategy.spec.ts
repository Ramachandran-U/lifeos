import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Career Strategist E2E', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('generate strategy, accept weekly artifact, see it in Goals', async ({ page }) => {
    await page.goto('/career');
    await expect(page.getByText('NEW CAREER PATH')).toBeVisible();

    await page.getByPlaceholder('e.g. Software Engineer').fill('Data Analyst');
    await page.getByPlaceholder('e.g. Engineering Manager').fill('ML Engineer');

    await page.getByPlaceholder('e.g. JavaScript').fill('Python');
    await page.getByPlaceholder('e.g. JavaScript').press('Enter');

    await page.getByText('Analyse my career path', { exact: true }).click();

    await expect(page.getByText('YOUR PATH')).toBeVisible();
    await expect(page.getByText('ELITE STRATEGIST')).toBeVisible();

    await page.getByText('Generate strategy', { exact: true }).click();

    await expect(page.getByText('REALITY CHECK')).toBeVisible();
    await expect(page.getByText('12-WEEK EXECUTION PLAN')).toBeVisible();
    await expect(page.getByText('PHASE 1: FOUNDATION')).toBeVisible();
    await expect(page.getByText('PHASE 3: PROOF')).toBeVisible();
    await expect(page.getByText('WEEKLY OUTPUT')).toBeVisible();

    // Click "Commit all" to accept every weekly + daily artifact in one shot.
    await page.getByText('Commit all', { exact: true }).click();
    await expect(page.getByText('All committed')).toBeVisible();

    await page.getByRole('tab', { name: /Goals/ }).click();
    await expect(page.getByText(/W1:/).first()).toBeVisible();
  });
});
