import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Voice Assistant E2E', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('opens voice sheet, sends text, receives mock response', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('voice-open').click();
    await expect(page.getByTestId('voice-sheet')).toBeVisible();

    await expect(page.getByText(/LISTENING|CONNECTING/)).toBeVisible();

    const input = page.getByTestId('voice-input');
    await input.fill('What should I do next?');
    await page.getByTestId('voice-send').click();

    await expect(page.getByTestId('voice-transcript')).toContainText(
      'What should I do next?',
      { timeout: 5000 },
    );

    await page.getByTestId('voice-close').click();
    await expect(page.getByTestId('voice-sheet')).not.toBeVisible();
  });
});
